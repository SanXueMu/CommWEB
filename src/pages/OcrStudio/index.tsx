/**
 * OCR 工作台（视图 'ocr.studio'）——还原 CommOCR 一站式体验：
 * 选模版（详情可见 + 级联增量表单）→ 传文件 → 识别（步骤跟踪）→ 结果（分页/文件范围/原页预览）→ 视图预览（定义|预览 + splits + 所见即所得导出）。
 * 纯壳准则：业务数据（流 ID/模版 id/内置视图名）全部来自声明 props；本组件零业务知识。
 *
 * 声明 props：
 *  recognizeFlow?: string      // 识别管线（第一步应为 spec.template.resolve）
 *  exportFlow?: string         // 视图导出管线（input 含 db/view_spec/name）
 *  searchableFlow?: string     // 可搜索 PDF 导出流（扫描件补隐形文字层）
 *  batch?: { extensions?: string[]; maxFiles?: number; maxTotalMB?: number }  // 存在才显示批量入口
 *  manageView?: string         // 「管理模版」弹窗承载的视图 id（声明下发，默认 templates）
 *  description?: string
 *  builtinViews?: BuiltinView[] // 内置视图快选（名 + 完整 ViewSpec，声明下发）
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Descriptions, Empty, Flex, Form, Image, Input, InputNumber,
  List, Modal, Popover, Progress, Segmented, Select, Space, Spin, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useActivePid } from '@/transfer/context'
import { useDialog } from '@/components/DialogLayer'
import { apiFor } from '@/api/client'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type { PipelineRunCreated } from '@/api/types'
import { FileUpload } from '@/components/FileUpload'
import { BatchUpload } from '@/components/BatchUpload'
import { runPool } from '@/protocol/pool'
import { humanSize } from '@/lib/size'
import type { BatchFileEntry } from '@/api/client'
import { DownloadButton } from '@/components/DownloadButton'
import { ResultRenderer } from '@/components/ResultRenderer'
import { SpecEditor, type BuiltinView } from '@/components/SpecEditor'
import { StepTrack } from '@/components/StepTrack'

/** 通用错误描述（与 PipelineStudio 同式）。 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const RUNNING = new Set(['running', 'pending', 'queued'])
// 批量入队并发 2（多模态识别模型有 RPM 限速，并发过高会 429）
const ENQUEUE_CONCURRENCY = 2

/** 记录行键名归一：优先后端英文键，中文键兜底（组件不对字段名做业务假设）。
 *  source_file 是后端按 source_path 反查出的真实路径，缺失即原文件已不在盘上。 */
function rowSourceFile(row: Record<string, unknown>, fallback?: string): string {
  return String(row.source_file ?? row['原文件路径'] ?? row.source_path ?? fallback ?? '')
}
function rowPage(row: Record<string, unknown>): number {
  // 页码可能为 0（库里未落页码），而 /files/page 从 1 起算，故抬到最小 1
  return Math.max(1, Number(row.page_number ?? row['页码'] ?? 1))
}
/** 不进列表展示的技术键（原页按钮已单独成列）。 */
const HIDDEN_ROW_KEYS = new Set(['source_file', '原文件路径', '页码'])

/** 轮询管线 run 至终态并取产物路径（节奏同 DataBrowser.runTool：500ms × 300 ≈ 150s）。
 *  导出必须是「提交→等待→下载」闭环，否则产物生成了用户也取不到。 */
async function waitRunFile(api: ReturnType<typeof apiFor>, runId: string, key: 'file' | 'path' = 'file'): Promise<string> {
  for (let i = 0; i < 300; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const detail = await api.getPipelineRun(runId)
    const status = detail.run.status
    if (status === 'succeeded') {
      const last = [...(detail.tasks ?? [])].sort((a, b) => a.step_index - b.step_index).pop()
      const file = (last?.output as Record<string, unknown> | null)?.[key]
      if (typeof file === 'string' && file) return file
      throw new Error('导出已成功，但未返回产物路径')
    }
    if (!RUNNING.has(status)) {
      const err = detail.run.error as { message?: string } | null
      throw new Error(err?.message ?? `导出运行失败（${status}）`)
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('导出运行超时（150s）')
}

/** 轮询工具任务至终态取 output（节奏同 DataBrowser.runTool）。
 *  此前直接把 createTask 的 TaskCreated{handle,status} 当输出渲染，界面只显示句柄 JSON。 */
async function waitTaskOutput(api: ReturnType<typeof apiFor>, handle: string): Promise<Record<string, unknown>> {
  for (let i = 0; i < 300; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const detail = await api.getTask(handle)
    if (detail.status === 'succeeded') return detail.output ?? {}
    if (['failed', 'failed_review', 'cancelled'].includes(detail.status)) {
      const err = detail.error as { message?: string } | null
      throw new Error(err?.message ?? `视图任务失败（${detail.status}）`)
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('视图任务超时（150s）')
}

interface TplSummary { id: string; name?: string; category?: string }
interface OcrRecordsResp {
  rows: Record<string, unknown>[]
  total: number
  page?: number
  limit?: number
}
interface TplDetail {
  id: string; name?: string; category?: string; enabled?: boolean
  fields?: string[]; rules?: string[]; prompt_template?: string
  input_schema?: { properties?: Record<string, unknown> }
  view_spec?: unknown; hooks?: { name: string }[]
}

interface OcrStudioProps {
  recognizeFlow?: string
  exportFlow?: string
  searchableFlow?: string     // 可搜索 PDF 导出流（扫描件补隐形文字层）
  viewTool?: string          // 视图计算工具（声明下发，组件不写死工具名）
  /** 批量入口声明：存在才显示「单文件 / 批量」切换（一次多文件 = 每文件各一条识别任务） */
  batch?: { extensions?: string[]; maxFiles?: number; maxTotalMB?: number }
  /** 「管理模版」弹窗承载的视图 id（声明下发；缺省 templates.manager） */
  manageView?: string
  description?: string
  builtinViews?: BuiltinView[]
}

export function OcrStudio() {
  const props = useViewProps() as OcrStudioProps
  const pid = useActivePid()
  const api = apiFor(pid)
  const dialog = useDialog()
  const t = useOcrText()

  const [templateId, setTemplateId] = useState<string>()
  const [file, setFile] = useState<string>()
  const [runId, setRunId] = useState<string | null>(null)
  const [detailTpl, setDetailTpl] = useState<string | null>(null)
  const [pageView, setPageView] = useState<{ path: string; page: number } | null>(null)
  const [viewSpec, setViewSpec] = useState<string>()
  const [extraForm] = Form.useForm()
  // 批量识别：勾选清单逐文件各起一条识别任务（与单文件同模版、同级联参数）
  const batchCfg = props.batch
  const [batchOn, setBatchOn] = useState(false)
  const [batchList, setBatchList] = useState<BatchFileEntry[]>([])
  const [batchSel, setBatchSel] = useState<string[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [batchReport, setBatchReport] = useState<{ file: string; runId?: string; error?: string }[]>([])

  const templates = useQuery({
    queryKey: ['provider', pid, 'ocr-templates'],
    queryFn: () => api.get<{ templates: TplSummary[] }>('/ocr/templates?limit=200'),
  })
  const detail = useQuery({
    queryKey: ['provider', pid, 'ocr-template', detailTpl],
    queryFn: () => api.get<TplDetail>(`/ocr/templates/${encodeURIComponent(detailTpl!)}`),
    enabled: Boolean(detailTpl),
  })
  const dbs = useQuery({
    queryKey: ['provider', pid, 'data-dbs'],
    // 只列 OCR 结果库（data/dbs 列全 DATA_DIR，含翻译字典库等非本域库）；records 端点吃 ocr 目录裸名
    queryFn: async () => {
      const d = await api.get<{ dbs: { name: string; path: string; records: number }[] }>('/data/dbs')
      return { dbs: d.dbs.filter((x) => x.name.endsWith('.ocr_results.db')) }
    },
  })
  const [db, setDb] = useState<string>()
  const [scope, setScope] = useState<string>()
  const [pageNum, setPageNum] = useState(1)
  const records = useQuery({
    queryKey: ['provider', pid, 'ocr-records', db, scope, pageNum],
    queryFn: () => api.get<OcrRecordsResp>(`/ocr/records?db=${encodeURIComponent(db!)}&limit=50&offset=${(pageNum - 1) * 50}${scope ? `&path=${encodeURIComponent(scope)}` : ''}`),
    enabled: Boolean(db),
  })

  const run = useQuery({
    queryKey: ['provider', pid, 'studio-run', runId],
    queryFn: () => api.getPipelineRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) => (RUNNING.has(q.state.data?.run.status ?? '') ? 2000 : false),
  })
  const runStatus = run.data?.run.status
  const busy = Boolean(runId && runStatus && RUNNING.has(runStatus)) || false
  const steps = useMemo(
    () => (run.data?.tasks ?? []).map((task, i) => ({
      step_index: i,
      tool: task.tool_id,
      latest: { step_index: i, handle: task.handle, status: task.status, attempt: 1, input: task.input, output: task.output },
    })),
    [run.data],
  )

  // I2 级联增量表单：选中模版的 input_schema.properties → 动态字段
  const selectedDetail = detailTpl ? detail.data : undefined
  const extraProperties = (selectedDetail?.input_schema?.properties ?? {}) as Record<string, Record<string, unknown>>

  const runMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.runPipeline(props.recognizeFlow!, payload) as Promise<PipelineRunCreated>,
    onSuccess: (created) => { setRunId(created.run_id) },
    onError: (err) => message.error(`${t.recognizeFailedPrefix}${errMsg(err)}`),
  })
  const startRecognize = async () => {
    if (!props.recognizeFlow) return
    const extra = await extraForm.validateFields().catch(() => undefined)
    runMutation.mutate({ template_id: templateId, file, ...extra })
  }

  /** 批量识别：同一模版 + 同一级联参数，逐文件各起一条任务（并发 2），逐条回报入队结果。 */
  const startRecognizeBatch = async () => {
    if (!props.recognizeFlow) return
    if (!templateId) { message.warning(t.recognizeNoTemplate); return }
    const targets = batchList.filter((f) => batchSel.includes(f.path))
    if (!targets.length) { message.warning(t.batchNone); return }
    const extra = await extraForm.validateFields().catch(() => undefined)
    if (extra === undefined) return
    setBatchRunning(true)
    setBatchReport([])
    setBatchProgress({ done: 0, total: targets.length })
    const report: { file: string; runId?: string; error?: string }[] = []
    await runPool(targets, async (item) => {
      try {
        const created = await api.runPipeline(props.recognizeFlow!, { template_id: templateId, file: item.path, ...extra })
        report.push({ file: item.name, runId: created.run_id })
      } catch (error) {
        report.push({ file: item.name, error: errMsg(error) })
      }
      setBatchProgress((p) => ({ ...p, done: p.done + 1 }))
      setBatchReport([...report])
    }, ENQUEUE_CONCURRENCY)
    setBatchRunning(false)
    const failed = report.filter((r) => r.error).length
    if (report.length - failed) message.success(`${t.batchQueued} ${report.length - failed}`)
    if (failed) message.warning(`${failed} ${t.batchSomeFailed}`)
  }

  // 视图预览：跑视图计算工具（纯预览不落盘），splits 由 ResultRenderer 渲染
  const previewMutation = useMutation({
    mutationFn: async () => {
      const created = await api.createTask(props.viewTool!, {
        records: records.data?.rows ?? [],
        view_spec: viewSpec!,
      })
      return waitTaskOutput(api, created.handle)
    },
    onError: (err) => message.error(`视图预览失败：${errMsg(err)}`),
  })
  const [exportFile, setExportFile] = useState<string>()
  const exportMutation = useMutation({
    mutationFn: async () => {
      const created = await api.runPipeline(props.exportFlow!, {
        db: dbs.data?.dbs.find((x) => x.name === db)?.path ?? db,
        view_spec: viewSpec!,
        name: `${db?.replace(/\.db$/, '') ?? '视图导出'}.xlsx`,
      } as Record<string, unknown>)
      return waitRunFile(api, created.run_id)
    },
    onSuccess: (file) => {
      setExportFile(file)
      message.success(`${t.exportOkPrefix}${file.split('/').pop()}`)
    },
    onError: (err) => message.error(`${t.exportFailedPrefix}${errMsg(err)}`),
  })
  // 可搜索 PDF：扫描/图片版补隐形文字层（声明流，产物键为 path）
  const [searchableFile, setSearchableFile] = useState<string>()
  const searchableMutation = useMutation({
    mutationFn: async () => {
      const created = await api.runPipeline(props.searchableFlow!,
        { file, languages: null, force: null } as Record<string, unknown>)
      return waitRunFile(api, created.run_id, 'path')
    },
    onSuccess: (f) => { setSearchableFile(f); message.success(`${t.searchableOkPrefix}${f.split('/').pop()}`) },
    onError: (err) => message.error(`${t.searchableFailedPrefix}${errMsg(err)}`),
  })
  const saveViewMutation = useMutation({
    mutationFn: ({ tplId, spec }: { tplId: string; spec: unknown }) =>
      api.send('/ocr/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: { ...(detail.data ?? {}), id: tplId, view_spec: spec } }),
      }),
    onSuccess: () => message.success('视图定义已另存到当前模版'),
    onError: (err) => message.error(`另存失败：${errMsg(err)}`),
  })

  const fileOptions = useMemo(
    () => Array.from(new Set((records.data?.rows ?? []).map((r: { source_path?: string }) => r.source_path).filter(Boolean))) as string[],
    [records.data],
  )
  const canRecognize = Boolean(templateId && file) && !busy && !runMutation.isPending
  // 视图定义未就绪时按钮置灰（此前空 spec 会悄悄提交一个必然失败的任务）
  const specReady = Boolean(viewSpec?.trim())
  const selectedTemplate = (templates.data?.templates ?? []).find((x: TplSummary) => x.id === templateId)

  return (
    <Card
      title={t.title}
      extra={
        <Flex gap={12} align="center" wrap="wrap">
          <Typography.Text type="secondary">{t.templateLabel}</Typography.Text>
          <Select
            style={{ minWidth: 220 }}
            placeholder={t.templatePlaceholder}
            value={templateId}
            onChange={(id) => { setTemplateId(id); setDetailTpl(id); extraForm.resetFields() }}
            loading={templates.isLoading}
            options={(templates.data?.templates ?? []).map((x) => ({ value: x.id, label: x.name ?? x.id }))}
          />
          {templateId && (
            <Popover
              trigger="click"
              content={<TemplateDetailPanel detail={detail.data} loading={detail.isLoading} />}
            >
              <Button size="small" icon={<EyeOutlined />}>{t.detail}</Button>
            </Popover>
          )}
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => dialog.openView(props.manageView ?? 'templates', {
              title: t.manage,
              size: 'lg',
              onClose: () => templates.refetch(),
            })}
          >
            {t.manage}
          </Button>
        </Flex>
      }
    >
      {props.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {props.description}
        </Typography.Paragraph>
      )}
      <Flex gap={16} align="stretch" style={{ minHeight: 460 }}>
        <Card size="small" title={t.dbsTitle} style={{ width: 240, flexShrink: 0 }} styles={{ body: { padding: 0 } }}>
          <List
            size="small"
            loading={dbs.isLoading}
            dataSource={dbs.data?.dbs ?? []}
            locale={{ emptyText: t.dbsEmpty }}
            renderItem={(item: { name: string; path: string; records: number }) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '8px 12px', background: item.name === db ? 'rgba(91,141,239,0.10)' : undefined }}
                onClick={() => { setDb(item.name); setPageNum(1); setScope(undefined) }}
              >
                <List.Item.Meta
                  title={<Typography.Text ellipsis style={{ maxWidth: 190 }}>{item.name}</Typography.Text>}
                  description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.records} 条</Typography.Text>}
                />
              </List.Item>
            )}
          />
        </Card>

        <Tabs
          style={{ flex: 1, minWidth: 0 }}
          items={[
            {
              key: 'recognize', label: t.tabRecognize,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card
                    size="small"
                    title={t.uploadTitle}
                    extra={batchCfg ? (
                      <Segmented
                        size="small"
                        value={batchOn ? 'batch' : 'single'}
                        onChange={(v) => setBatchOn(v === 'batch')}
                        options={[{ value: 'single', label: t.modeSingle }, { value: 'batch', label: t.modeBatch }]}
                      />
                    ) : undefined}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      {batchOn && batchCfg ? (
                        <>
                          <BatchUpload
                            extensions={batchCfg.extensions}
                            maxFiles={batchCfg.maxFiles}
                            maxTotalMB={batchCfg.maxTotalMB}
                            disabled={batchRunning}
                            onPicked={(files) => { setBatchList(files); setBatchSel(files.map((f) => f.path)) }}
                          />
                          {batchList.length > 0 && (
                            <Card
                              type="inner" size="small"
                              title={`${t.batchList}（${batchSel.length}/${batchList.length}）`}
                              extra={(
                                <Space>
                                  <Button size="small" onClick={() => setBatchSel(batchList.map((f) => f.path))}>{t.selectAll}</Button>
                                  <Button size="small" onClick={() => setBatchSel([])}>{t.selectNone}</Button>
                                  <Button size="small" onClick={() => { setBatchList([]); setBatchSel([]); setBatchReport([]) }}>{t.clearList}</Button>
                                </Space>
                              )}
                            >
                              <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 220, overflow: 'auto' }}>
                                {batchList.map((f) => (
                                  <Checkbox
                                    key={f.path}
                                    checked={batchSel.includes(f.path)}
                                    onChange={(e) => setBatchSel((sel) => (e.target.checked ? [...sel, f.path] : sel.filter((p) => p !== f.path)))}
                                  >
                                    <Space>
                                      <Typography.Text style={{ fontSize: 13 }}>{f.rel || f.name}</Typography.Text>
                                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{humanSize(f.size || 0)}</Typography.Text>
                                    </Space>
                                  </Checkbox>
                                ))}
                              </Space>
                            </Card>
                          )}
                        </>
                      ) : (
                        <FileUpload value={file ?? undefined} onChange={setFile} />
                      )}
                      {Object.keys(extraProperties).length > 0 && (
                        <Card type="inner" size="small" title={`${t.tplExtraForm}（${selectedTemplate?.name ?? templateId}）`}>
                          <Form form={extraForm} layout="vertical" initialValues={Object.fromEntries(
                            Object.entries(extraProperties).map(([k, v]) => [k, v.default]),
                          )}>
                            <Flex gap={12} wrap="wrap">
                              {Object.entries(extraProperties).map(([key, schema]) => (
                                <Form.Item key={key} name={key} label={(schema.title as string) ?? key} style={{ minWidth: 220 }} valuePropName={schema.type === 'boolean' ? 'checked' : undefined}>
                                  {renderExtraControl(schema)}
                                </Form.Item>
                              ))}
                            </Flex>
                          </Form>
                        </Card>
                      )}
                      <Space wrap>
                        {batchOn && batchCfg ? (
                          <>
                            <Button type="primary" loading={batchRunning} disabled={!templateId || !batchSel.length || batchRunning} onClick={startRecognizeBatch}>
                              {t.batchStart}（{batchSel.length}）
                            </Button>
                            {!templateId && <Typography.Text type="secondary">{t.recognizeNoTemplate}</Typography.Text>}
                            {templateId && !batchList.length && <Typography.Text type="secondary">{t.batchNoFile}</Typography.Text>}
                          </>
                        ) : (
                          <>
                            <Button type="primary" loading={busy || runMutation.isPending} disabled={!canRecognize && !busy && !runMutation.isPending} onClick={startRecognize}>
                              {t.recognize}
                            </Button>
                            {props.searchableFlow && (
                              <Button loading={searchableMutation.isPending} disabled={!file || busy || searchableMutation.isPending} onClick={() => searchableMutation.mutate()}>
                                {t.searchable}
                              </Button>
                            )}
                            {searchableFile && <DownloadButton path={searchableFile} label={t.download} />}
                            {!templateId && <Typography.Text type="secondary">{t.recognizeNoTemplate}</Typography.Text>}
                            {templateId && !file && <Typography.Text type="secondary">{t.recognizeNoFile}</Typography.Text>}
                          </>
                        )}
                      </Space>
                      {batchOn && batchCfg && batchProgress.total > 0 && (
                        <>
                          <Progress
                            percent={Math.round((batchProgress.done / batchProgress.total) * 100)}
                            status={batchRunning ? 'active' : 'normal'}
                          />
                          <Space direction="vertical" size={2} style={{ width: '100%', maxHeight: 160, overflow: 'auto' }}>
                            {batchReport.map((r) => (
                              <Typography.Text key={r.file} style={{ fontSize: 12 }} type={r.error ? 'danger' : 'secondary'}>
                                {r.error ? '✕' : '✓'} {r.file}{r.error ? ` — ${r.error}` : r.runId ? ` — ${r.runId}` : ''}
                              </Typography.Text>
                            ))}
                          </Space>
                        </>
                      )}
                      {!batchOn && runId && runStatus && <StepTrack runId={runId} steps={steps} runStatus={runStatus} />}
                      {!batchOn && runStatus === 'failed' && (
                        <Alert type="error" showIcon message={run.data?.run.error?.message ?? '识别运行失败'} />
                      )}
                    </Space>
                  </Card>
                </Space>
              ),
            },
            {
              key: 'records', label: t.tabRecords,
              children: (
                <Card
                  size="small"
                  title={db ?? t.dbsTitle}
                  extra={
                    <Flex gap={8}>
                      <Select
                        allowClear size="small" style={{ minWidth: 160 }} placeholder={t.scopeAll}
                        value={scope} options={fileOptions.map((f) => ({ value: f, label: f }))}
                        onChange={(v) => { setScope(v); setPageNum(1) }}
                      />
                      {db && props.exportFlow && (
                        <Button size="small" loading={exportMutation.isPending} disabled={!specReady} onClick={() => exportMutation.mutate()}>{t.export}</Button>
                      )}
                      {exportFile && <DownloadButton path={exportFile} label={t.download} />}
                    </Flex>
                  }
                >
                  {!db ? (
                    <Empty description={t.dbsEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : records.isLoading ? (
                    <Spin />
                  ) : (records.data?.rows?.length ?? 0) === 0 ? (
                    <Empty description={t.recordsEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Table
                      size="small"
                      rowKey={(_, i) => String(i)}
                      scroll={{ x: 'max-content', y: 340 }}
                      pagination={{
                        size: 'small', current: pageNum, pageSize: 50,
                        total: records.data?.total ?? 0, showSizeChanger: false,
                        onChange: setPageNum, showTotal: (n) => `${n} 条`,
                      }}
                      columns={[
                        ...((records.data?.rows?.length ?? 0) > 0 ? [{
                          title: t.originPage, key: '_page', width: 84,
                          render: (_: unknown, row: Record<string, unknown>) => {
                            const src = rowSourceFile(row, scope)
                            return (
                              <Button
                                size="small" type="link" icon={<EyeOutlined />}
                                disabled={!src}
                                onClick={() => setPageView({ path: src, page: rowPage(row) })}
                              >
                                {t.originPage}
                              </Button>
                            )
                          },
                        }] : []),
                        ...Object.keys(records.data?.rows?.[0] ?? {})
                          .filter((k) => !HIDDEN_ROW_KEYS.has(k))
                          .map((col) => ({
                            title: col, dataIndex: col, key: col, ellipsis: true,
                            render: (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')),
                          })),
                      ]}
                      dataSource={records.data?.rows ?? []}
                    />
                  )}
                </Card>
              ),
            },
            {
              key: 'views', label: t.tabViews,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title={t.viewDefTitle}>
                    <SpecEditor value={viewSpec ?? ''} onChange={setViewSpec} builtinViews={props.builtinViews ?? []} />
                    <Flex gap={8} style={{ marginTop: 8 }} wrap="wrap">
                      <Button size="small" loading={previewMutation.isPending} disabled={!db || !props.viewTool || !specReady} onClick={() => previewMutation.mutate()}>{t.preview}</Button>
                      <Button size="small" type="primary" loading={exportMutation.isPending} disabled={!db || !props.exportFlow || !specReady} onClick={() => exportMutation.mutate()}>{t.export}</Button>
                      {exportFile && <DownloadButton path={exportFile} label={t.download} />}
                      {templateId && detail.data && (
                        <Button
                          size="small"
                          loading={saveViewMutation.isPending}
                          disabled={!specReady}
                          onClick={() => {
                            try { saveViewMutation.mutate({ tplId: templateId, spec: JSON.parse(viewSpec ?? '{}') }) }
                            catch { message.error('视图定义不是合法 JSON，无法另存') }
                          }}
                        >
                          {t.saveViewToTpl}
                        </Button>
                      )}
                    </Flex>
                    {!specReady
                      ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.specRequired}</Typography.Text>
                      : <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.previewHint}</Typography.Text>}
                  </Card>
                  {previewMutation.data && (
                    <Card size="small" title={t.previewResult}>
                      <ResultRenderer output={previewMutation.data} />
                    </Card>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Flex>

      <Modal
        title={pageView ? `${t.originPage} · ${pageView.page}` : t.originPage}
        open={Boolean(pageView)}
        onCancel={() => setPageView(null)}
        footer={
          pageView && (
            <Flex justify="space-between">
              <Button size="small" onClick={() => setPageView({ ...pageView, page: Math.max(1, pageView.page - 1) })}>{t.prevPage}</Button>
              <Typography.Text type="secondary">p.{pageView.page}</Typography.Text>
              <Button size="small" onClick={() => setPageView({ ...pageView, page: pageView.page + 1 })}>{t.nextPage}</Button>
            </Flex>
          )
        }
        width={720}
      >
        {pageView && (
          <Image
            src={api.pageUrl(pageView.path, pageView.page)}
            fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4="
            style={{ maxHeight: 520, objectFit: 'contain' }}
          />
        )}
      </Modal>
    </Card>
  )
}

/** 模板增量输入控件（JSON Schema → antd 控件的最小映射）。 */
function renderExtraControl(schema: Record<string, unknown>) {
  if (schema.enum) return <Select options={(schema.enum as unknown[]).map((v) => ({ value: v, label: String(v) }))} />
  if (schema.type === 'boolean') return <Switch />
  if (schema.type === 'number' || schema.type === 'integer') return <InputNumber style={{ width: '100%' }} />
  if ((schema.format as string) === 'textarea') return <Input.TextArea rows={2} />
  return <Input placeholder={schema.description as string | undefined} />
}

/** 模板详情面板：fields/rules/提示词/增量输入/视图定义。 */
function TemplateDetailPanel({ detail, loading }: { detail?: TplDetail; loading: boolean }) {
  const t = useOcrText()
  if (loading) return <Spin size="small" />
  if (!detail) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
  return (
    <div style={{ maxWidth: 420 }}>
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
        <Descriptions.Item label={t.catLabel}>{detail.category ?? '—'}</Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.fieldsLabel}</Typography.Text>
        <div style={{ marginTop: 4 }}>
          {(detail.fields ?? []).map((f) => <Tag key={f} style={{ marginBottom: 4 }}>{f}</Tag>)}
          {(detail.fields ?? []).length === 0 && <Typography.Text type="secondary">—</Typography.Text>}
        </div>
      </div>
      {(detail.hooks?.length ?? 0) > 0 && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.hooksLabel}</Typography.Text>
          <div>{detail.hooks!.map((h) => <Tag key={h.name} color="blue" style={{ marginBottom: 4 }}>{h.name}</Tag>)}</div>
        </div>
      )}
      {detail.prompt_template && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.promptLabel}</Typography.Text>
          <pre style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap' }}>
            {detail.prompt_template}
          </pre>
        </div>
      )}
      {detail.view_spec != null && (
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.viewSpecLabel}</Typography.Text>
          <pre style={{ maxHeight: 120, overflow: 'auto', fontSize: 12, background: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6 }}>
            {JSON.stringify(detail.view_spec, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/** 工作台文案（协议内置 UI 语义，非业务）。 */
function useOcrText() {
  return {
    title: 'OCR 工作台',
    templateLabel: '识别模版',
    templatePlaceholder: '选择模版',
    detail: '详情',
    manage: '管理模版',
    dbsTitle: '结果库',
    dbsEmpty: '暂无结果库',
    uploadTitle: '识别',
    tplExtraForm: '模版增量输入',
    recognize: '开始识别',
    searchable: '导出可搜索 PDF',
    searchableOkPrefix: '已生成可搜索 PDF：',
    searchableFailedPrefix: '导出可搜索 PDF 失败：',
    recognizeNoTemplate: '先选择模版',
    recognizeNoFile: '先上传文件',
    modeSingle: '单文件', modeBatch: '批量',
    batchList: '待识别文件', selectAll: '全选', selectNone: '全不选', clearList: '清空清单',
    batchStart: '开始识别（批量）', batchNone: '请先勾选要识别的文件', batchNoFile: '先上传文件或目录',
    batchQueued: '已入队', batchSomeFailed: '个未能入队（见下方明细）',
    tabRecognize: '识别',
    tabRecords: '结果',
    tabViews: '视图',
    scopeAll: '全部文件',
    recordsEmpty: '暂无记录',
    originPage: '原页',
    export: '导出',
    preview: '预览视图',
    previewHint: '预览按当前页 50 条记录计算；导出对全库执行。',
    specRequired: '先点击上方内置视图快选，或粘贴视图定义 JSON',
    viewDefTitle: '视图定义',
    previewResult: '预览结果',
    saveViewToTpl: '另存到当前模版',
    fieldsLabel: '字段',
    hooksLabel: '后处理钩子',
    promptLabel: '识别提示词',
    viewSpecLabel: '视图定义',
    catLabel: '分类',
    prevPage: '上一页',
    nextPage: '下一页',
    recognizeFailedPrefix: '识别提交失败：',
    download: '下载导出文件',
    exportOkPrefix: '导出完成：',
    exportFailedPrefix: '导出失败：',
  }
}
