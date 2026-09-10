/** OCR 工作台（视图类型 ocr.studio，视图 props 驱动）：
 *  顶栏选模版（templatesPath）→ 上传识别（recognizeFlow 运行）→ 结果库（recordsPath）浏览与导出（exportFlow）。
 *  纯壳：流 id / 端点 / 文案均来自 site props 与 portal，组件不存业务常量。 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App as AntApp, Button, Card, Descriptions, Empty, Flex, List, Select, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUpload } from '@/components/FileUpload'
import { ResultRenderer } from '@/components/ResultRenderer'
import { PORTAL } from '@/config/portal'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { mergedViewProps, viewPathByType } from '@/transfer/siteManifest'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'

interface StudioProps {
  description?: string
  recognizeFlow?: string
  exportFlow?: string
  genFlow?: string
  templatesPath?: string
  recordsPath?: string
}

interface TemplateRow { id: string; name?: string; category?: string; fields?: unknown[]; [k: string]: unknown }
interface DbRow { name: string; records: number; path?: string; updated_at?: string; [k: string]: unknown }

const RUNNING = new Set(['running', 'paused'])

export function OcrStudio() {
  const pid = useActivePid()
  const { site } = useSiteCatalog()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const queryClient = useQueryClient()

  const decl = useMemo(() => site.declared.find((v) => v.type === 'ocr.studio'), [site])
  const props = mergedViewProps(decl, pid) as StudioProps
  const t = PORTAL.studio
  const templatesPath = props.templatesPath ?? '/ocr/templates'
  const recordsPath = props.recordsPath ?? '/ocr/records'

  const [templateId, setTemplateId] = useState<string>()
  const [file, setFile] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [db, setDb] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const api = apiFor(pid)

  const templates = useQuery({
    queryKey: ['provider', pid, 'studio-templates'],
    queryFn: () => api.get<{ templates: TemplateRow[] }>(templatesPath),
    enabled: Boolean(pid),
  })
  const dbs = useQuery({
    queryKey: ['provider', pid, 'studio-dbs'],
    queryFn: () => api.get<{ dbs: DbRow[] }>(`${recordsPath}/dbs`),
    enabled: Boolean(pid),
  })
  const records = useQuery({
    queryKey: ['provider', pid, 'studio-records', db],
    queryFn: () => api.get<{ columns: string[]; rows: Record<string, unknown>[] }>(
      `${recordsPath}?db=${encodeURIComponent(db ?? '')}&limit=500`,
    ),
    enabled: Boolean(db),
  })

  // 运行轮询：进行中 2s 一拍；结束（succeeded/failed）自动停并刷新结果库
  const run = useQuery({
    queryKey: ['provider', pid, 'studio-run', runId],
    queryFn: () => api.getPipelineRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status
      return status && RUNNING.has(status) ? 2000 : false
    },
  })
  const runStatus = run.data?.run.status
  useEffect(() => {
    if (!runStatus) return
    if (runStatus === 'succeeded') {
      message.success(t.recognizeOk)
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'studio-dbs'] })
      // 识别完成后自动聚焦最新生成的库
      void dbs.refetch().then(() => {
        const latest = [...(dbs.data?.dbs ?? [])].sort((a, b) =>
          String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0]
        if (latest) setDb(latest.name)
      })
      setRunId(null)
    } else if (runStatus === 'failed') {
      message.error(`${t.recognizeFailedPrefix}${describeError(run.data?.run.error)}`)
      setRunId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus])

  const busy = Boolean(runId && runStatus && RUNNING.has(runStatus)) || submitting
  const canRecognize = Boolean(templateId && file) && !busy
  const selectedTemplate = templates.data?.templates.find((x) => x.id === templateId)

  const startRecognize = async () => {
    if (!props.recognizeFlow) return
    setSubmitting(true)
    try {
      const created = await api.runPipeline(props.recognizeFlow, { template_id: templateId, file })
      setRunId(created.run_id)
    } catch (err) {
      message.error(`${t.recognizeFailedPrefix}${describeError(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const exportDb = async () => {
    if (!props.exportFlow || !db) return
    setExporting(true)
    try {
      const created = await api.runPipeline(props.exportFlow, {
        db: dbs.data?.dbs.find((x) => x.name === db)?.path ?? db,
        name: db.replace(/\.db$/, '.xlsx'),
      })
      message.success(`${t.exportOkPrefix}${created.run_id.slice(0, 14)}…（导出完成后见服务器输出目录）`)
    } catch (err) {
      message.error(`${t.exportFailedPrefix}${describeError(err)}`)
    } finally {
      setExporting(false)
    }
  }

  const flowListPath = viewPathByType(site, 'flows.list')
  const openGenFlow = () => {
    if (props.genFlow && flowListPath) navigate(`${flowListPath}/${props.genFlow}`)
  }

  return (
    <Card
      title={decl?.title ?? 'OCR'}
      extra={
        <Flex gap={12} align="center" wrap="wrap">
          <Typography.Text type="secondary">{t.templateLabel}</Typography.Text>
          <Select
            style={{ minWidth: 240 }}
            placeholder={t.templatePlaceholder}
            value={templateId}
            onChange={setTemplateId}
            loading={templates.isLoading}
            options={(templates.data?.templates ?? []).map((x) => ({ value: x.id, label: x.name ?? x.id }))}
          />
          {props.genFlow && <Button onClick={openGenFlow}>{t.newTemplate}</Button>}
        </Flex>
      }
    >
      {props.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {props.description}
        </Typography.Paragraph>
      )}
      <Flex gap={16} align="stretch" style={{ minHeight: 420 }}>
        <Card size="small" title={t.dbsTitle} style={{ width: 264, flexShrink: 0 }} styles={{ body: { padding: 0 } }}>
          <List
            size="small"
            loading={dbs.isLoading}
            dataSource={dbs.data?.dbs ?? []}
            locale={{ emptyText: t.dbsEmpty }}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: 'pointer', padding: '8px 12px', background: item.name === db ? 'rgba(91,141,239,0.10)' : undefined }}
                onClick={() => setDb(item.name)}
              >
                <List.Item.Meta
                  title={<Typography.Text ellipsis style={{ maxWidth: 200 }}>{item.name}</Typography.Text>}
                  description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.records} 条</Typography.Text>}
                />
              </List.Item>
            )}
          />
        </Card>

        <Space direction="vertical" size={12} style={{ flex: 1, minWidth: 0 }}>
          <Card size="small" title={t.uploadTitle}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <FileUpload value={file ?? undefined} onChange={setFile} />
              <Space wrap>
                <Button type="primary" loading={submitting || busy} disabled={!canRecognize && !busy} onClick={startRecognize}>
                  {t.recognize}
                </Button>
                {!templateId && <Typography.Text type="secondary">{t.recognizeNoTemplate}</Typography.Text>}
                {templateId && !file && <Typography.Text type="secondary">{t.recognizeNoFile}</Typography.Text>}
                {runId && runStatus && (
                  <Space size={6}>
                    <Typography.Text type="secondary">{t.statusPrefix}</Typography.Text>
                    <Tag color={runStatus === 'succeeded' ? 'green' : runStatus === 'failed' ? 'red' : 'blue'}>{runStatus}</Tag>
                    <Spin size="small" />
                  </Space>
                )}
              </Space>
              {selectedTemplate && (
                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="ID">{selectedTemplate.id}</Descriptions.Item>
                  <Descriptions.Item label="分类">{selectedTemplate.category ?? '—'}</Descriptions.Item>
                </Descriptions>
              )}
              {run.data?.run.error != null && runStatus === 'failed' && (
                <Alert type="error" showIcon message={describeError(run.data.run.error)} />
              )}
            </Space>
          </Card>

          <Card
            size="small"
            title={db ?? t.dbsTitle}
            extra={db && props.exportFlow && <Button size="small" loading={exporting} onClick={exportDb}>{t.export}</Button>}
          >
            {records.isLoading ? (
              <Spin />
            ) : (records.data?.rows?.length ?? 0) === 0 ? (
              <Empty description={t.recordsEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResultRenderer output={records.data?.rows} />
            )}
          </Card>
        </Space>
      </Flex>
    </Card>
  )
}

function describeError(err: unknown): string {
  if (err == null) return '未知错误'
  if (typeof err === 'string') return err
  const e = err as { message?: unknown; detail?: unknown }
  return String(e.message ?? e.detail ?? JSON.stringify(err))
}
