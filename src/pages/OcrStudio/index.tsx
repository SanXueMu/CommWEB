/**
 * OCR 工作台（视图 'ocr.studio'）——还原 CommOCR 一站式体验：
 * 选模版（详情可见 + 级联增量表单）→ 传文件 → 识别（步骤跟踪）→ 结果（分页/文件范围/原页预览）→ 视图预览（定义|预览 + splits + 所见即所得导出）。
 * 纯壳准则：业务数据（流 ID/模版 id/内置视图名）全部来自声明 props；本组件零业务知识。
 *
 * 声明 props：
 *  recognizeFlow?: string      // 识别管线（第一步应为 spec.template.resolve）
 *  exportFlow?: string         // 视图导出管线（input 含 db/view_spec/name）
 *  genFlow?: string            // 模板生成流（「新建模版」跳转）
 *  description?: string
 *  builtinViews?: string[]     // 内置视图名快选（声明下发）
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert, Button, Card, Descriptions, Drawer, Empty, Flex, Form, Image, Input, InputNumber,
  List, Modal, Popover, Select, Space, Spin, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { viewPathByType } from '@/transfer/siteManifest'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type { PipelineRunCreated } from '@/api/types'
import { FileUpload } from '@/components/FileUpload'
import { ResultRenderer } from '@/components/ResultRenderer'
import { TemplateManager } from '@/components/TemplateManager'
import { SpecEditor } from '@/components/SpecEditor'
import { StepTrack } from '@/components/StepTrack'

/** 通用错误描述（与 PipelineStudio 同式）。 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const RUNNING = new Set(['running', 'pending', 'queued'])

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

export function OcrStudio() {
  const props = useViewProps() as { recognizeFlow?: string; exportFlow?: string; genFlow?: string; description?: string; builtinViews?: string[] }
  const pid = useActivePid()
  const api = apiFor(pid)
  const { site } = useSiteCatalog()
  const navigate = useNavigate()
  const t = useOcrText()

  const [templateId, setTemplateId] = useState<string>()
  const [file, setFile] = useState<string>()
  const [runId, setRunId] = useState<string | null>(null)
  const [detailTpl, setDetailTpl] = useState<string | null>(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [pageView, setPageView] = useState<{ path: string; page: number } | null>(null)
  const [viewSpec, setViewSpec] = useState<string>()
  const [extraForm] = Form.useForm()

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

  // 视图预览：跑 records.view.query 工具任务（纯预览不落盘），splits 由 ResultRenderer 渲染
  const previewMutation = useMutation({
    mutationFn: async () => {
      const rows = records.data?.rows ?? []
      return api.createTask('records.view.query', {
        records: rows,
        view_spec: viewSpec ?? '合同关键词视图',
      })
    },
    onError: (err) => message.error(`视图预览失败：${errMsg(err)}`),
  })
  const exportMutation = useMutation({
    mutationFn: () => api.runPipeline(props.exportFlow!, {
      db: dbs.data?.dbs.find((x) => x.name === db)?.path ?? db,
      view_spec: viewSpec ?? '合同关键词视图',
      name: `${db?.replace(/\.db$/, '') ?? '视图导出'}.xlsx`,
    } as Record<string, unknown>),
    onSuccess: (created) => message.success(`已提交导出 ${(created as PipelineRunCreated).run_id.slice(0, 14)}…`),
    onError: (err) => message.error(`导出失败：${errMsg(err)}`),
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
  const selectedTemplate = (templates.data?.templates ?? []).find((x: TplSummary) => x.id === templateId)
  const flowListPath = viewPathByType(site, 'flows.list')

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
          <Button size="small" onClick={() => setManagerOpen(true)} icon={<SettingOutlined />}>{t.manage}</Button>
          {props.genFlow && flowListPath && (
            <Button size="small" onClick={() => navigate(`${flowListPath}/${props.genFlow}`)}>{t.newTemplate}</Button>
          )}
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
                  <Card size="small" title={t.uploadTitle}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <FileUpload value={file ?? undefined} onChange={setFile} />
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
                        <Button type="primary" loading={busy || runMutation.isPending} disabled={!canRecognize && !busy && !runMutation.isPending} onClick={startRecognize}>
                          {t.recognize}
                        </Button>
                        {!templateId && <Typography.Text type="secondary">{t.recognizeNoTemplate}</Typography.Text>}
                        {templateId && !file && <Typography.Text type="secondary">{t.recognizeNoFile}</Typography.Text>}
                      </Space>
                      {runId && runStatus && <StepTrack runId={runId} steps={steps} runStatus={runStatus} />}
                      {runStatus === 'failed' && (
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
                        <Button size="small" loading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>{t.export}</Button>
                      )}
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
                        ...(records.data?.rows?.[0]?.页码 != null ? [{
                          title: t.originPage, key: '_page', width: 84,
                          render: (_: unknown, row: Record<string, unknown>) => (
                            <Button
                              size="small" type="link" icon={<EyeOutlined />}
                              onClick={() => setPageView({ path: String(row.原文件路径 ?? scope ?? ''), page: Number(row.页码 ?? 1) })}
                            >
                              {t.originPage}
                            </Button>
                          ),
                        }] : []),
                        ...Object.keys(records.data?.rows?.[0] ?? {})
                          .filter((k) => k !== '原文件路径')
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
                      <Button size="small" loading={previewMutation.isPending} disabled={!db} onClick={() => previewMutation.mutate()}>{t.preview}</Button>
                      <Button size="small" type="primary" loading={exportMutation.isPending} disabled={!db || !props.exportFlow} onClick={() => exportMutation.mutate()}>{t.export}</Button>
                      {templateId && detail.data && (
                        <Button
                          size="small"
                          loading={saveViewMutation.isPending}
                          onClick={() => {
                            try { saveViewMutation.mutate({ tplId: templateId, spec: JSON.parse(viewSpec ?? '{}') }) }
                            catch { message.error('视图定义不是合法 JSON，无法另存') }
                          }}
                        >
                          {t.saveViewToTpl}
                        </Button>
                      )}
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.previewHint}</Typography.Text>
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

      <Drawer title={t.manage} width={680} open={managerOpen} onClose={() => { setManagerOpen(false); templates.refetch() }}>
        <TemplateManager />
      </Drawer>

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
    newTemplate: '新建模版',
    dbsTitle: '结果库',
    dbsEmpty: '暂无结果库',
    uploadTitle: '识别',
    tplExtraForm: '模版增量输入',
    recognize: '开始识别',
    recognizeNoTemplate: '先选择模版',
    recognizeNoFile: '先上传文件',
    tabRecognize: '识别',
    tabRecords: '结果',
    tabViews: '视图',
    scopeAll: '全部文件',
    recordsEmpty: '暂无记录',
    originPage: '原页',
    export: '导出',
    preview: '预览视图',
    previewHint: '预览按当前页 50 条记录计算；导出对全库执行。',
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
    exportOkPrefix: '导出已提交 ',
    exportFailedPrefix: '导出失败：',
  }
}
