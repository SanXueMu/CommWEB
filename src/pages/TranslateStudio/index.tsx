/**
 * 翻译工作台（视图 'translate.studio'）——还原 Translee 一站式体验：
 * 翻译模版侧栏（语言对/术语表/模型）→ 传文件（按扩展名自动路由到对应流）→ 开始翻译（步骤跟踪 + Token 用量）→
 * 任务列表（进度/统计/产物/再运行/取消/删除 + 详情日志）→ 资料库（术语表 / 已译字典 / 模板管理）+ 任务浮窗。
 * 纯壳准则：业务数据（流 ID/路由/语言候选/模板 id）全部来自声明 props；本组件零业务知识。
 *
 * 声明 props：
 *  flow_prefix?: string
 *  routes?: { ext: string[]; flow: string }[]   // 后缀 → 流
 *  templatesPath?: string                        // 翻译模板端点（默认 /translate/templates）
 *  dictPath?: string                             // 字典浏览端点（默认 /translate/dict）
 *  languages?: { value: string; label: string }[]
 *  description?: string
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Badge, Button, Card, Descriptions, Drawer, Empty, Flex, Form, Input, List, Modal,
  Popconfirm, Progress, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { viewPathByType } from '@/transfer/siteManifest'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type {
  PipelineRun, RunEvent, RunSummary, Task, TranslateDictEntry, TranslateTemplate,
} from '@/api/types'
import { FileUpload } from '@/components/FileUpload'
import { DownloadButton } from '@/components/DownloadButton'
import { StepTrack } from '@/components/StepTrack'
import { StatusBadge } from '@/components/StatusBadge'
import { SettingsKeys } from '@/components/SettingsKeys'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const RUNNING = new Set(['running', 'pending', 'queued', 'paused'])

interface Route { ext: string[]; flow: string }
interface Language { value: string; label: string }
interface TranslateStudioProps {
  flow_prefix?: string
  routes?: Route[]
  templatesPath?: string
  dictPath?: string
  languages?: Language[]
  description?: string
}

/** 按文件扩展名路由到流（声明驱动，不写死流 ID）。 */
function pickFlow(file: string | undefined, routes: Route[]): string | undefined {
  if (!file) return undefined
  const lower = file.toLowerCase()
  return routes.find((r) => r.ext.some((e) => lower.endsWith(e.toLowerCase())))?.flow
}

function baseName(p?: unknown): string {
  const s = String(p ?? '')
  return s.split('/').pop() || s
}

/** 聚合一次运行的翻译产物统计（步骤 output 的 usage/totals）。 */
function aggregate(run?: PipelineRun) {
  const byModel: Record<string, { calls: number; prompt_tokens: number; completion_tokens: number }> = {}
  let calls = 0, cache = 0, review = 0, ok = 0
  const artifacts: { name: string; path: string }[] = []
  for (const task of run?.tasks ?? []) {
    const out = (task.output ?? {}) as Record<string, unknown>
    const ubm = out.usage_by_model as Record<string, { calls: number; prompt_tokens: number; completion_tokens: number }> | undefined
    if (ubm) {
      for (const [m, v] of Object.entries(ubm)) {
        const slot = byModel[m] ?? (byModel[m] = { calls: 0, prompt_tokens: 0, completion_tokens: 0 })
        slot.calls += v.calls ?? 0
        slot.prompt_tokens += v.prompt_tokens ?? 0
        slot.completion_tokens += v.completion_tokens ?? 0
      }
    }
    calls += Number(out.calls ?? 0)
    cache += Number(out.cache_hits ?? 0)
    review += Number(out.review_count ?? 0)
    const st = out.statuses as string[] | undefined
    if (Array.isArray(st)) ok += st.filter((s) => s === 'ok').length
    if (typeof out.file === 'string' && out.file) artifacts.push({ name: baseName(out.file), path: out.file })
    if (typeof out.path === 'string' && out.path) artifacts.push({ name: String(out.name ?? baseName(out.path)), path: out.path })
  }
  return { byModel, calls, cache, review, ok, artifacts }
}

/** 任务浮窗：右下角常驻，显示进行中的翻译作业。 */
function TaskFloat({ runs, onOpen }: { runs: RunSummary[]; onOpen: (id: string) => void }) {
  if (runs.length === 0) return null
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, width: 300, zIndex: 1000 }}>
      <Card size="small" title={`翻译进行中（${runs.length}）`} styles={{ body: { padding: 8, maxHeight: 260, overflow: 'auto' } }}>
        {runs.map((r) => {
          const s = r.summary
          const done = s?.steps_done ?? 0
          const total = s?.steps_total ?? 0
          return (
            <div key={r.id} style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => onOpen(r.id)}>
              <Flex justify="space-between">
                <Typography.Text ellipsis style={{ maxWidth: 170, fontSize: 12 }}>{baseName(r.input?.file)}</Typography.Text>
                <StatusBadge value={r.status} />
              </Flex>
              <Progress percent={total ? Math.round((done / total) * 100) : undefined} size="small" status="active" />
            </div>
          )
        })}
      </Card>
    </div>
  )
}

export function TranslateStudio() {
  const props = useViewProps() as TranslateStudioProps
  const pid = useActivePid()
  const api = apiFor(pid)
  const { site } = useSiteCatalog()
  const qc = useQueryClient()
  const t = useTranslateText()

  const routes = props.routes ?? []
  const templatesPath = props.templatesPath ?? '/translate/templates'
  const dictPath = props.dictPath ?? '/translate/dict'
  const languages = props.languages ?? []

  // ── 表单元状态 ──
  const [templateId, setTemplateId] = useState<string>()
  const [file, setFile] = useState<string>()
  const [keyName, setKeyName] = useState<string>()
  const [model, setModel] = useState<string>('')
  const [sourceLang, setSourceLang] = useState<string>('')
  const [targetLang, setTargetLang] = useState<string>('Chinese')
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [detailRun, setDetailRun] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTpl, setEditTpl] = useState<TranslateTemplate | null>(null)
  const [keysOpen, setKeysOpen] = useState(false)
  const [dictQ, setDictQ] = useState('')
  const [dictStatus, setDictStatus] = useState<string>()
  const [dictModel, setDictModel] = useState<string>()
  const [dictPage, setDictPage] = useState(1)
  const [libTab, setLibTab] = useState('glossary')
  const [editorForm] = Form.useForm()

  // ── 查询 ──
  const flows = useQuery({ queryKey: ['provider', pid, 'translate-flows'], queryFn: () => api.listPipelines() })
  const flowIds = useMemo(
    () => (flows.data?.pipelines ?? []).filter((p) => p.id.startsWith(props.flow_prefix ?? '')).map((p) => p.id),
    [flows.data, props.flow_prefix],
  )
  const templates = useQuery({
    queryKey: ['provider', pid, 'translate-templates'],
    queryFn: () => api.get<{ templates: TranslateTemplate[] }>(`${templatesPath}?limit=200`),
  })
  const keys = useQuery({ queryKey: ['provider', pid, 'keys'], queryFn: () => api.listKeys() })
  const runs = useQuery({
    queryKey: ['provider', pid, 'translate-runs', flowIds.join(',')],
    queryFn: () => api.listRuns(undefined, 100),
    enabled: flowIds.length > 0,
    refetchInterval: 3000,
  })
  const runList = useMemo(
    () => (runs.data?.runs ?? []).filter((r) => r.pipeline_id && flowIds.includes(r.pipeline_id)),
    [runs.data, flowIds],
  )
  const runningRuns = runList.filter((r) => RUNNING.has(r.status))

  const activeDetail = useQuery({
    queryKey: ['provider', pid, 'studio-run', activeRun],
    queryFn: () => api.getPipelineRun(activeRun!),
    enabled: Boolean(activeRun),
    refetchInterval: (q) => (RUNNING.has(q.state.data?.run.status ?? '') ? 2000 : false),
  })
  const detailDetail = useQuery({
    queryKey: ['provider', pid, 'run-detail', detailRun],
    queryFn: () => api.getPipelineRun(detailRun!),
    enabled: Boolean(detailRun),
    refetchInterval: (q) => (RUNNING.has(q.state.data?.run.status ?? '') ? 2000 : false),
  })
  const detailLogs = useQuery({
    queryKey: ['provider', pid, 'run-logs', detailRun],
    queryFn: () => api.listRunEvents(detailRun!, 200),
    enabled: Boolean(detailRun),
    refetchInterval: (q) => (q.state.data?.events.length ? false : 2000),
  })
  const dict = useQuery({
    queryKey: ['provider', pid, 'translate-dict', dictQ, dictStatus, dictModel, dictPage],
    queryFn: () => {
      const params = new URLSearchParams()
      if (dictQ) params.set('q', dictQ)
      if (dictStatus) params.set('status', dictStatus)
      if (dictModel) params.set('model', dictModel)
      params.set('limit', '50')
      params.set('offset', String((dictPage - 1) * 50))
      return api.get<{ rows: TranslateDictEntry[]; total: number; stats: { ok: number; review: number } }>(`${dictPath}?${params.toString()}`)
    },
    enabled: libTab === 'dict',
  })

  const tplList = templates.data?.templates ?? []
  const tplDetailQuery = useQuery({
    queryKey: ['translate', 'tpl', pid, templateId],
    enabled: Boolean(templateId),
    queryFn: () => api.get<TranslateTemplate>(`${templatesPath}/${encodeURIComponent(templateId!)}`),
  })
  const selectedTemplate = tplDetailQuery.data ?? tplList.find((x) => x.id === templateId)
  const flow = pickFlow(file, routes)
  const busy = Boolean(activeRun && RUNNING.has(activeDetail.data?.run.status ?? ''))

  // ── 变更 ──
  const runMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.runPipeline(flow!, input),
    onSuccess: (created) => { setActiveRun(created.run_id); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }) },
    onError: (e) => message.error(`${t.startFailed}${errMsg(e)}`),
  })
  const startTranslate = () => {
    if (!flow) { message.warning(t.noRoute); return }
    runMutation.mutate({
      file,
      key_name: keyName,
      model: model || null,
      source_lang: sourceLang || null,
      target_lang: targetLang || null,
      terms: selectedTemplate?.terms ?? [],
    })
  }
  const rerunMutation = useMutation({
    mutationFn: (id: string) => api.rerunRun(id),
    onSuccess: (r) => { setActiveRun(r.run_id); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }) },
    onError: (e) => message.error(`${t.rerunFailed}${errMsg(e)}`),
  })
  const abortMutation = useMutation({
    mutationFn: (id: string) => api.abortRun(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }),
    onError: (e) => message.error(`${t.abortFailed}${errMsg(e)}`),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRun(id),
    onSuccess: () => { setDetailRun(null); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }) },
    onError: (e) => message.error(`${t.deleteFailed}${errMsg(e)}`),
  })
  const saveTplMutation = useMutation({
    mutationFn: (template: TranslateTemplate) => api.send(templatesPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template }),
    }),
    onSuccess: () => { setEditorOpen(false); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-templates'] }) },
    onError: (e) => message.error(`${t.saveFailed}${errMsg(e)}`),
  })
  const delTplMutation = useMutation({
    mutationFn: (id: string) => api.send(`${templatesPath}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-templates'] }),
    onError: (e) => message.error(`${t.deleteFailed}${errMsg(e)}`),
  })

  const openEditor = (tpl: TranslateTemplate | null) => {
    setEditTpl(tpl)
    editorForm.setFieldsValue({
      id: tpl?.id ?? '',
      name: tpl?.name ?? '',
      desc: tpl?.desc ?? '',
      source_lang: tpl?.source_lang ?? 'English',
      target_lang: tpl?.target_lang ?? 'Chinese',
      model: tpl?.model ?? '',
      terms: (tpl?.terms ?? []).map(([a, b]) => `${a} => ${b}`).join('\n'),
    })
    setEditorOpen(true)
  }
  const submitEditor = async () => {
    const v = await editorForm.validateFields()
    const terms = String(v.terms ?? '')
      .split('\n').map((line: string) => line.split('=>').map((s) => s.trim()))
      .filter((p: string[]) => p.length === 2 && p[0] && p[1]) as [string, string][]
    saveTplMutation.mutate({
      id: v.id, name: v.name, desc: v.desc || null,
      source_lang: v.source_lang || null, target_lang: v.target_lang || null,
      model: v.model || null, terms,
    })
  }

  const selectTemplate = (tpl: TranslateTemplate) => {
    setTemplateId(tpl.id)
    setModel(tpl.model ?? '')
    setSourceLang(tpl.source_lang ?? '')
    setTargetLang(tpl.target_lang ?? 'Chinese')
  }

  const activeUsage = aggregate(activeDetail.data)
  const activeStatus = activeDetail.data?.run.status
  const steps = useMemo(
    () => (activeDetail.data?.tasks ?? []).map((task: Task, i) => ({
      step_index: i, tool: task.tool_id,
      latest: { step_index: i, handle: task.handle, status: task.status, attempt: 1, input: task.input, output: task.output },
    })),
    [activeDetail.data],
  )
  const settingsPath = viewPathByType(site, 'settings.keys')
  const canStart = Boolean(file && flow) && !busy && !runMutation.isPending
  const dictModels = useMemo(
    () => Array.from(new Set((dict.data?.rows ?? []).map((r) => r.model).filter(Boolean))) as string[],
    [dict.data],
  )

  return (
    <Card
      title={t.title}
      extra={
        <Space>
          <Typography.Text type="secondary">{t.topTemplate}</Typography.Text>
          <Select
            style={{ minWidth: 220 }} placeholder={t.templatePlaceholder} value={templateId}
            loading={templates.isLoading}
            options={tplList.map((x) => ({ value: x.id, label: `${x.name}${x.builtin ? t.builtinTag : ''}` }))}
            onChange={(id) => { const tpl = tplList.find((x) => x.id === id); if (tpl) selectTemplate(tpl) }}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={() => openEditor(null)}>{t.newTemplate}</Button>
          {settingsPath && <Button size="small" icon={<KeyOutlined />} onClick={() => setKeysOpen(true)}>{t.keys}</Button>}
        </Space>
      }
    >
      {props.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>{props.description}</Typography.Paragraph>
      )}
      <Flex gap={16} align="stretch" style={{ minHeight: 480 }}>
        {/* 模板侧栏 */}
        <Card size="small" title={t.sidebar} style={{ width: 260, flexShrink: 0 }} styles={{ body: { padding: 0 } }}>
          <List
            size="small" loading={templates.isLoading} dataSource={tplList}
            locale={{ emptyText: t.sidebarEmpty }}
            renderItem={(tpl) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '8px 12px', background: tpl.id === templateId ? 'rgba(91,141,239,0.10)' : undefined }}
                onClick={() => selectTemplate(tpl)}
                actions={[
                  <EditOutlined key="e" onClick={(e) => { e.stopPropagation(); openEditor(tpl) }} />,
                  <Popconfirm key="d" title={t.confirmDeleteTpl} onConfirm={() => delTplMutation.mutate(tpl.id)} onCancel={(e) => e?.stopPropagation()}>
                    <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<Typography.Text ellipsis style={{ maxWidth: 150 }}>{tpl.name}</Typography.Text>}
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {tpl.source_lang}→{tpl.target_lang} · {(tpl.terms_count ?? tpl.terms?.length ?? 0)}{t.termUnit}
                      {tpl.model ? ` · ${tpl.model}` : ''}
                    </Typography.Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Tabs
          style={{ flex: 1, minWidth: 0 }}
          items={[
            {
              key: 'translate', label: t.tabTranslate,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title={t.runConfig}>
                    <FileUpload value={file ?? undefined} onChange={setFile} />
                    <Form layout="vertical" style={{ marginTop: 12 }}>
                      <Flex gap={12} wrap="wrap">
                        <Form.Item label={t.keyLabel} style={{ minWidth: 200 }}>
                          <Select
                            allowClear placeholder={t.keyPlaceholder} value={keyName} loading={keys.isLoading}
                            options={(keys.data?.keys ?? []).map((k) => ({ value: k.name, label: `${k.name}${k.is_default ? t.defaultTag : ''}` }))}
                            onChange={setKeyName}
                          />
                        </Form.Item>
                        <Form.Item label={t.modelLabel} style={{ minWidth: 220 }}>
                          <Input placeholder={t.modelPlaceholder} value={model} onChange={(e) => setModel(e.target.value)} />
                        </Form.Item>
                        <Form.Item label={t.sourceLabel} style={{ minWidth: 160 }}>
                          <Select allowClear placeholder={t.autoLang} value={sourceLang || undefined}
                            options={languages.map((l) => ({ value: l.value, label: l.label }))} onChange={(v) => setSourceLang(v ?? '')} />
                        </Form.Item>
                        <Form.Item label={t.targetLabel} style={{ minWidth: 160 }}>
                          <Select value={targetLang} options={languages.map((l) => ({ value: l.value, label: l.label }))} onChange={setTargetLang} />
                        </Form.Item>
                      </Flex>
                    </Form>
                    {selectedTemplate && (selectedTemplate.terms?.length ?? 0) > 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t.termsFromTpl}（{selectedTemplate.name}）：{selectedTemplate.terms!.map(([a]) => a).join('、')}
                      </Typography.Text>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <Space wrap>
                        <Button type="primary" size="large" loading={busy || runMutation.isPending} disabled={!canStart} onClick={startTranslate}>
                          {t.start}
                        </Button>
                        {file && flow && <Tag>{flow}</Tag>}
                        {file && !flow && <Typography.Text type="warning">{t.noRoute}</Typography.Text>}
                      </Space>
                    </div>
                  </Card>
                  {activeRun && activeStatus && (
                    <Card size="small" title={t.runStatus}>
                      <StepTrack runId={activeRun} steps={steps} runStatus={activeStatus} />
                      {activeStatus === 'failed' && (
                        <Alert type="error" showIcon style={{ marginTop: 8 }}
                          message={(activeDetail.data?.run.error as { message?: string } | null)?.message ?? t.runFailed} />
                      )}
                      <UsagePanel usage={activeUsage} t={t} />
                    </Card>
                  )}
                </Space>
              ),
            },
            {
              key: 'tasks', label: t.tabTasks,
              children: (
                <Card size="small" extra={<Button size="small" onClick={() => runs.refetch()}>{t.refresh}</Button>}>
                  <Table
                    size="small" rowKey="id" loading={runs.isLoading}
                    dataSource={runList}
                    locale={{ emptyText: t.tasksEmpty }}
                    pagination={{ size: 'small', pageSize: 20, showSizeChanger: false }}
                    columns={[
                      { title: t.colStatus, dataIndex: 'status', width: 110, render: (v: string) => <StatusBadge value={v} /> },
                      { title: t.colFile, key: 'file', ellipsis: true, render: (_: unknown, r: RunSummary) => baseName(r.input?.file) },
                      { title: t.colFlow, dataIndex: 'pipeline_id', width: 170, ellipsis: true },
                      {
                        title: t.colProgress, key: 'progress', width: 130,
                        render: (_: unknown, r: RunSummary) => {
                          const done = r.summary?.steps_done ?? 0
                          const total = r.summary?.steps_total ?? 0
                          return <Progress percent={total ? Math.round((done / total) * 100) : 0} size="small" status={RUNNING.has(r.status) ? 'active' : 'normal'} />
                        },
                      },
                      {
                        title: t.colStats, key: 'stats', width: 180,
                        render: (_: unknown, r: RunSummary) => {
                          const s = r.summary
                          if (!s) return '—'
                          return (
                            <Space size={4}>
                              <Tag color="green">✓{s.ok_count ?? 0}</Tag>
                              <Tag color="blue">⚡{s.cache_hits ?? 0}</Tag>
                              <Tag color="orange">⚠{s.review_count ?? 0}</Tag>
                            </Space>
                          )
                        },
                      },
                      { title: t.colCreated, dataIndex: 'created_at', width: 160, render: (v: string) => (v ? v.replace('T', ' ').slice(0, 19) : '—') },
                      {
                        title: t.colActions, key: 'actions', width: 200,
                        render: (_: unknown, r: RunSummary) => (
                          <Space size={4}>
                            <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => setDetailRun(r.id)}>{t.detail}</Button>
                            <Button size="small" type="link" onClick={() => rerunMutation.mutate(r.id)}>{t.rerun}</Button>
                            {RUNNING.has(r.status)
                              ? <Button size="small" type="link" danger onClick={() => abortMutation.mutate(r.id)}>{t.abort}</Button>
                              : <Popconfirm title={t.confirmDeleteRun} onConfirm={() => deleteMutation.mutate(r.id)}>
                                  <Button size="small" type="link" danger>{t.remove}</Button>
                                </Popconfirm>}
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'library', label: t.tabLibrary,
              children: (
                <Tabs
                  activeKey={libTab} onChange={setLibTab} size="small"
                  items={[
                    {
                      key: 'glossary', label: t.libGlossary,
                      children: selectedTemplate ? (
                        (selectedTemplate.terms?.length ?? 0) === 0
                          ? <Empty description={t.noTerms} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          : <Table
                              size="small" rowKey={(_, i) => String(i)} pagination={false}
                              dataSource={selectedTemplate.terms!.map(([s, tg]) => ({ source: s, target: tg }))}
                              columns={[{ title: t.colSource, dataIndex: 'source' }, { title: t.colTarget, dataIndex: 'target' }]}
                            />
                      ) : <Empty description={t.selectTemplateHint} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                    },
                    {
                      key: 'dict', label: t.libDict,
                      children: (
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Space wrap>
                            <Input.Search style={{ width: 260 }} placeholder={t.dictSearch} allowClear onSearch={(v) => { setDictQ(v); setDictPage(1) }} />
                            <Select allowClear style={{ width: 140 }} placeholder={t.colStatus} value={dictStatus} onChange={(v) => { setDictStatus(v); setDictPage(1) }}
                              options={[{ value: 'ok', label: t.statOk }, { value: 'review', label: t.statReview }]} />
                            <Select allowClear style={{ width: 160 }} placeholder={t.colModel} value={dictModel} onChange={(v) => { setDictModel(v); setDictPage(1) }}
                              options={dictModels.map((m) => ({ value: m, label: m }))} />
                            {dict.data?.stats && <Typography.Text type="secondary">{t.statOk} {dict.data.stats.ok} · {t.statReview} {dict.data.stats.review}</Typography.Text>}
                          </Space>
                          <Table
                            size="small" rowKey={(_, i) => String(i)} loading={dict.isLoading}
                            dataSource={dict.data?.rows ?? []}
                            locale={{ emptyText: t.dictEmpty }}
                            pagination={{
                              size: 'small', current: dictPage, pageSize: 50, total: dict.data?.total ?? 0,
                              showSizeChanger: false, onChange: setDictPage, showTotal: (n) => `${n} 条`,
                            }}
                            columns={[
                              { title: t.colSource, dataIndex: 'source', ellipsis: true },
                              { title: t.colTarget, dataIndex: 'translated', ellipsis: true },
                              { title: t.colModel, dataIndex: 'model', width: 160, ellipsis: true },
                              { title: t.colStatus, dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'ok' ? 'green' : 'orange'}>{v}</Tag> },
                            ]}
                          />
                        </Space>
                      ),
                    },
                    {
                      key: 'templates', label: t.libTemplates,
                      children: (
                        <Card size="small" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => openEditor(null)}>{t.newTemplate}</Button>}>
                          <Table
                            size="small" rowKey="id" dataSource={tplList} pagination={false}
                            columns={[
                              { title: t.colName, dataIndex: 'name' },
                              { title: t.colLangPair, key: 'lang', width: 140, render: (_: unknown, r: TranslateTemplate) => `${r.source_lang}→${r.target_lang}` },
                              { title: t.colTermsCount, key: 'terms', width: 100, render: (_: unknown, r: TranslateTemplate) => r.terms_count ?? r.terms?.length ?? 0 },
                              { title: t.colModel, dataIndex: 'model', width: 180, render: (v: string | null) => v ?? '—' },
                              {
                                title: t.colActions, key: 'actions', width: 140,
                                render: (_: unknown, r: TranslateTemplate) => (
                                  <Space size={4}>
                                    <Button size="small" type="link" onClick={() => openEditor(r)}>{t.edit}</Button>
                                    <Popconfirm title={t.confirmDeleteTpl} onConfirm={() => delTplMutation.mutate(r.id)}>
                                      <Button size="small" type="link" danger>{t.remove}</Button>
                                    </Popconfirm>
                                  </Space>
                                ),
                              },
                            ]}
                          />
                        </Card>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Flex>

      {/* 任务详情抽屉 */}
      <Drawer title={t.detailTitle} width={720} open={Boolean(detailRun)} onClose={() => setDetailRun(null)}>
        {detailDetail.data && <RunDetail run={detailDetail.data} logs={detailLogs.data?.events ?? []} t={t} />}
      </Drawer>

      {/* 模板编辑 */}
      <Modal title={editTpl ? t.editTemplate : t.newTemplate} open={editorOpen} onOk={submitEditor}
        confirmLoading={saveTplMutation.isPending} onCancel={() => setEditorOpen(false)} okText={t.save}>
        <Form form={editorForm} layout="vertical">
          <Form.Item name="id" label="ID" rules={[{ required: true, pattern: /^[a-z][a-z0-9_.]{2,63}$/, message: t.idRule }]}>
            <Input disabled={Boolean(editTpl)} placeholder="tpl.translate.xxx" />
          </Form.Item>
          <Form.Item name="name" label={t.colName} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="desc" label={t.colDesc}><Input /></Form.Item>
          <Flex gap={12} wrap="wrap">
            <Form.Item name="source_lang" label={t.sourceLabel} style={{ minWidth: 180 }}>
              <Select options={languages.map((l) => ({ value: l.value, label: l.label }))} />
            </Form.Item>
            <Form.Item name="target_lang" label={t.targetLabel} style={{ minWidth: 180 }}>
              <Select options={languages.map((l) => ({ value: l.value, label: l.label }))} />
            </Form.Item>
            <Form.Item name="model" label={t.modelLabel} style={{ minWidth: 200 }}><Input placeholder={t.modelPlaceholder} /></Form.Item>
          </Flex>
          <Form.Item name="terms" label={t.termsLabel} extra={t.termsHint}>
            <Input.TextArea rows={5} placeholder={'Audit Report => 审计报告'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 密钥管理（协议级组件） */}
      <Drawer title={t.keys} width={720} open={keysOpen} onClose={() => { setKeysOpen(false); keys.refetch() }}>
        <SettingsKeys />
      </Drawer>

      <TaskFloat runs={runningRuns} onOpen={setDetailRun} />
    </Card>
  )
}

/** 运行详情：输入/产物/用量/日志。 */
function RunDetail({ run, logs, t }: { run: PipelineRun; logs: RunEvent[]; t: ReturnType<typeof useTranslateText> }) {
  const usage = aggregate(run)
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label={t.colStatus}><StatusBadge value={run.run.status} /></Descriptions.Item>
        <Descriptions.Item label={t.colFile}>{baseName(run.run.input?.file)}</Descriptions.Item>
        <Descriptions.Item label={t.colFlow}>{run.run.pipeline_id}</Descriptions.Item>
        {run.run.error && <Descriptions.Item label={t.errorLabel}>
          <Typography.Text type="danger">{(run.run.error as { message?: string }).message}</Typography.Text>
        </Descriptions.Item>}
      </Descriptions>
      {usage.artifacts.length > 0 && (
        <Card size="small" title={t.artifacts}>
          <Space direction="vertical">
            {usage.artifacts.map((a) => (
              <Space key={a.path}>
                <DownloadButton path={a.path} label={a.name} />
              </Space>
            ))}
          </Space>
        </Card>
      )}
      <UsagePanel usage={usage} t={t} />
      <Card size="small" title={t.logs} styles={{ body: { maxHeight: 240, overflow: 'auto', background: 'rgba(0,0,0,0.03)' } }}>
        {(logs ?? []).length === 0 ? <Typography.Text type="secondary">{t.noLogs}</Typography.Text> : logs.map((e) => (
          <div key={e.id} style={{ fontSize: 12, fontFamily: 'monospace' }}>
            <Typography.Text type="secondary">{(e.created_at ?? '').replace('T', ' ').slice(11, 19)}</Typography.Text>{' '}
            <Badge status={e.kind === 'error' ? 'error' : 'processing'} /> {e.kind} {JSON.stringify(e.detail ?? {})}
          </div>
        ))}
      </Card>
    </Space>
  )
}

/** Token 用量面板（按模型：调用/输入/输出）。 */
function UsagePanel({ usage, t }: { usage: ReturnType<typeof aggregate>; t: ReturnType<typeof useTranslateText> }) {
  const models = Object.entries(usage.byModel)
  if (models.length === 0 && usage.calls === 0) return null
  return (
    <Card size="small" title={t.usage} style={{ marginTop: 8 }}>
      <Space size={16} wrap style={{ marginBottom: 8 }}>
        <Tag color="green">✓ {t.statOk} {usage.ok}</Tag>
        <Tag color="blue">⚡ {t.statCache} {usage.cache}</Tag>
        <Tag color="orange">⚠ {t.statReview} {usage.review}</Tag>
        {usage.calls > 0 && <Typography.Text type="secondary">{t.calls} {usage.calls}</Typography.Text>}
      </Space>
      {models.length > 0 && (
        <Table
          size="small" rowKey={(r) => r.model} pagination={false}
          dataSource={models.map(([m, v]) => ({ model: m, ...v }))}
          columns={[
            { title: t.colModel, dataIndex: 'model' },
            { title: t.colCalls, dataIndex: 'calls', width: 90 },
            { title: t.colPrompt, dataIndex: 'prompt_tokens', width: 120 },
            { title: t.colCompletion, dataIndex: 'completion_tokens', width: 120 },
          ]}
        />
      )}
    </Card>
  )
}

/** 工作台文案（协议内置 UI 语义，非业务）。 */
function useTranslateText() {
  return {
    title: '翻译工作台', topTemplate: '翻译模版', templatePlaceholder: '选择模版',
    newTemplate: '新建模版', keys: '密钥管理', sidebar: '翻译模版', sidebarEmpty: '暂无翻译模版',
    builtinTag: '（内置）', termUnit: ' 术语', confirmDeleteTpl: '确认删除该模版？',
    tabTranslate: '翻译', tabTasks: '任务', tabLibrary: '资料库',
    runConfig: '翻译配置', keyLabel: '密钥', keyPlaceholder: '选择密钥', defaultTag: '（默认）',
    modelLabel: '模型', modelPlaceholder: '留空用密钥默认模型', sourceLabel: '源语言', targetLabel: '目标语言',
    autoLang: '自动判定', termsFromTpl: '术语表来自模版', start: '开始翻译', noRoute: '未匹配到该文件类型的翻译流',
    runStatus: '翻译运行', runFailed: '翻译运行失败', startFailed: '提交失败：', rerunFailed: '再运行失败：',
    abortFailed: '取消失败：', deleteFailed: '删除失败：', saveFailed: '保存失败：',
    tabRecords: '', refresh: '刷新', tasksEmpty: '暂无翻译任务', colStatus: '状态', colFile: '文件',
    colFlow: '流', colProgress: '进度', colStats: '统计', colCreated: '创建时间', colActions: '操作',
    detail: '详情', rerun: '再运行', abort: '取消', remove: '删除', confirmDeleteRun: '确认删除该任务？',
    detailTitle: '任务详情', errorLabel: '错误', artifacts: '产物', logs: '运行日志', noLogs: '暂无日志',
    usage: 'Token 用量', statOk: '新译', statCache: '缓存', statReview: '待审', calls: '调用',
    colModel: '模型', colCalls: '调用', colPrompt: '输入 tok', colCompletion: '输出 tok',
    libGlossary: '术语表', libDict: '已译字典', libTemplates: '模板管理', noTerms: '该模版无术语',
    selectTemplateHint: '先在顶部选择翻译模版', dictSearch: '搜索原文/译文', dictEmpty: '暂无字典记录',
    colSource: '原文', colTarget: '译文', colName: '名称', colDesc: '描述', colLangPair: '语言对',
    colTermsCount: '术语数', edit: '编辑', editTemplate: '编辑模版', save: '保存',
    termsLabel: '术语表', termsHint: '每行一条，格式：原文 => 译文', idRule: 'ID 须为小写字母开头（可含 . _ 数字）',
  }
}
