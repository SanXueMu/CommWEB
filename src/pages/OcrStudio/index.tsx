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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, AutoComplete, Button, Card, Checkbox, Descriptions, Empty, Flex, Form, Image, Input, InputNumber,
  List, Modal, Popconfirm, Popover, Progress, Segmented, Select, Space, Spin, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { EyeOutlined, SettingOutlined } from '@ant-design/icons'
import { Drawer } from 'antd'
import { useActivePid } from '@/transfer/context'
import { useDialog } from '@/components/DialogLayer'
import { ApiError, apiFor } from '@/api/client'
import { useViewProps } from '@/protocol/ViewPropsContext'
import type { PipelineRunCreated } from '@/api/types'
import { TaskFloat, RunDetail } from '@/components/RunWidgets'
import { FileUpload } from '@/components/FileUpload'
import { BatchUpload } from '@/components/BatchUpload'
import { UploadsPanel } from '@/components/UploadsPanel'
import { runPool } from '@/protocol/pool'
import { humanSize } from '@/lib/size'
import type { BatchFileEntry } from '@/api/client'
import { DownloadButton } from '@/components/DownloadButton'
import { ResultRenderer } from '@/components/ResultRenderer'
import RunListPanel from '@/components/RunListPanel'
import { pollIntervalFor } from '@/protocol/polling'
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
  /** 本工作台任务清单的流过滤（通用 RunListPanel 用，声明下发） */
  flows?: string[]
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

  // AN3：清单**合并去重**（分批上传/从「已上传原件」载入都追加，不覆盖前一批）
  const batchAdd = (files: BatchFileEntry[]) => {
    setBatchList((prev) => {
      const seen = new Set(prev.map((f) => f.path))
      return [...prev, ...files.filter((f) => !seen.has(f.path))]
    })
    setBatchSel((sel) => [...new Set([...sel, ...files.map((f) => f.path)])])
  }

  // 已录入密钥（渲染密钥字段的下拉；避免手写错名）
  const keysQ = useQuery({
    queryKey: ['provider', pid, 'ocr-keys'],
    queryFn: () => api.listKeys(),
    staleTime: 30_000,
  })
  const keyOptions = useMemo(
    () => (keysQ.data?.keys ?? []).map((k) => ({ value: k.name, label: k.name })),
    [keysQ.data],
  )
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
  // AJ2：结果库多选（合并导出用；存库 path）。焦点库 db 仍单选——预览/结果 tab 不受影响
  const [mergedPaths, setMergedPaths] = useState<string[]>([])
  const [scope, setScope] = useState<string>()
  const [pageNum, setPageNum] = useState(1)
  // AD3：删除结果库（后端防呆：被任务引用时 409 报引用数，先删任务再删库）
  // AP-D：409 时提供「强制删除」——引用它的任务详情会自动把该产物标为「已删除」
  const deleteDbMutation = useMutation({
    mutationFn: (v: { path: string; force?: boolean }) => api.deleteOcrDb(v.path, v.force),
    onSuccess: (r) => {
      message.success(`已删除结果库（${r.removed.length} 个文件${r.forced ? '，强制' : ''}）`)
      if (r.removed.some((p) => p.endsWith(`${db}.raw.json`) || p === db)) setDb(undefined)
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'data-dbs'] })
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'ocr-records'] })
    },
    onError: (e: Error, v) => {
      const conflict = e instanceof ApiError && e.status === 409
      if (conflict && !v.force) {
        Modal.confirm({
          title: '该结果库仍被任务引用',
          content: `${e.message}。强制删除后，引用它的任务详情里该产物会显示「已删除」（任务记录本身保留）。`,
          okText: '强制删除', okButtonProps: { danger: true }, cancelText: '取消',
          onOk: () => deleteDbMutation.mutate({ path: v.path, force: true }),
        })
        return
      }
      message.error(e.message)
    },
  })
  const records = useQuery({
    queryKey: ['provider', pid, 'ocr-records', db, scope, pageNum],
    queryFn: () => api.get<OcrRecordsResp>(`/ocr/records?db=${encodeURIComponent(db!)}&limit=50&offset=${(pageNum - 1) * 50}${scope ? `&path=${encodeURIComponent(scope)}` : ''}`),
    enabled: Boolean(db),
  })

  const ocrRuns = useQuery({
    queryKey: ['provider', pid, 'ocr-runs', (props.flows ?? []).join(',')],
    queryFn: () => api.listRuns(undefined, 200),
    refetchInterval: (q) => pollIntervalFor((q.state.data?.runs ?? []).map((r) => r.status)),
    enabled: (props.flows?.length ?? 0) > 0,
  })
  /** AG2：任务清单只认「识别任务」——视图导出（exportFlow）是秒级工具 run，
   *  混进清单就成了"一个文件两个任务"的噪声（导出产物在视图/结果 tab 领取）。 */
  const taskRuns = useMemo(
    () => (ocrRuns.data?.runs ?? [])
      .filter((r) => r.pipeline_id !== props.exportFlow)
      .filter((r) => !props.flows?.length || props.flows.includes(r.pipeline_id ?? '')),
    [ocrRuns.data, props.exportFlow, props.flows])
  const qc = useQueryClient()
  // Y5：任务 running → 终态时联动失效数据面查询（结果库计数/预览），不再需要 F5
  const prevStatusRef = useRef<Record<string, string>>({})
  useEffect(() => {
    const runs = ocrRuns.data?.runs ?? []
    const prev = prevStatusRef.current
    let finished = false
    const next: Record<string, string> = {}
    for (const r of runs) {
      next[r.id] = r.status
      if (prev[r.id] && (prev[r.id] === 'running' || prev[r.id] === 'queued')
        && prev[r.id] !== r.status) finished = true
    }
    prevStatusRef.current = next
    if (finished) {
      qc.invalidateQueries({ queryKey: ['provider', pid, 'data-dbs'] })
      qc.invalidateQueries({ queryKey: ['provider', pid, 'ocr-records'] })
    }
  }, [ocrRuns.data, pid, qc])

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

  // X6：任务详情抽屉 + 重跑/中止接线（与翻译工作台同一套组件）
  const [detailRun, setDetailRun] = useState<string | null>(null)
  // AH4：详情抽屉实时化（对齐翻译台）——running 时 2s 轮询详情+日志；run 被删（404）自动关抽屉
  const detailDetail = useQuery({
    queryKey: ['provider', pid, 'run-detail', detailRun],
    queryFn: () => api.getPipelineRun(detailRun!),
    enabled: Boolean(detailRun),
    refetchInterval: (q) => ((q.state.data?.run.status === 'running' || q.state.data?.run.status === 'queued') ? 2000 : false),
  })
  const detailLogs = useQuery({
    queryKey: ['provider', pid, 'run-logs', detailRun],
    queryFn: () => api.listRunEvents(detailRun!, 200),
    enabled: Boolean(detailRun),
    refetchInterval: () => detailDetail.data && (detailDetail.data.run.status === 'running' || detailDetail.data.run.status === 'queued') ? 2000 : false,
  })
  const invalidateRuns = () => {
    void ocrRuns.refetch()
    qc.invalidateQueries({ queryKey: ['provider', pid, 'ocr-runs'] })
  }
  // AH4：抽屉里的 run 已被删除 → 关抽屉（不再对着 404 空抽屉）
  useEffect(() => {
    const err = detailDetail.error as { status?: number } | null
    if (err && err.status === 404) setDetailRun(null)
  }, [detailDetail.error])
  const rerunMutation = useMutation({
    mutationFn: (id: string) => api.rerunRun(id),
    onSuccess: () => { message.success('已重新入队'); invalidateRuns() },
    onError: (e: Error) => message.error(`重跑失败：${e.message}`),
  })
  const abortMutation = useMutation({
    mutationFn: (id: string) => api.abortRun(id),
    onSuccess: () => { message.success('已中止'); invalidateRuns() },
    onError: (e: Error) => message.error(`中止失败：${e.message}`),
  })

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
        // 服务端按声明分类：不可识别类型（如混进目录的 docx/rar）不进识别流，
        // 只报告跳过——它们仍随批次导出（保持交付目录结构完整）
        if (item.skip) {
          report.push({ file: item.name, error: item.skip_reason ?? '不在可识别类型内，已跳过' })
        } else {
          const created = await api.runPipeline(props.recognizeFlow!, { template_id: templateId, file: item.path, ...extra })
          report.push({ file: item.name, runId: created.run_id })
        }
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
    mutationFn: async (specOverride?: string) => {
      const created = await api.createTask(props.viewTool!, {
        records: records.data?.rows ?? [],
        view_spec: specOverride ?? viewSpec!,
      })
      return waitTaskOutput(api, created.handle)
    },
    onError: (err) => message.error(`视图预览失败：${errMsg(err)}`),
  })
  const [exportFile, setExportFile] = useState<string>()
  const exportMutation = useMutation({
    mutationFn: async () => {
      // AJ2：多选 ≥2 库 → 合并导出（后端逐库读取按来源分组排序）；否则单库现行为
      const merging = mergedPaths.length >= 2
      const created = await api.runPipeline(props.exportFlow!, {
        db: merging ? mergedPaths : (dbs.data?.dbs.find((x) => x.name === db)?.path ?? db),
        view_spec: viewSpec!,
        // 名字不带 .xlsx（后端统一补后缀），并去掉库名的 .ocr_results.db 尾巴
        name: merging ? t.mergedExportName(mergedPaths.length)
          : (db?.replace(/\.(ocr_results\.)?db$/, '') ?? '视图导出'),
      } as Record<string, unknown>)
      return waitRunFile(api, created.run_id)
    },
    onSuccess: (file) => {
      setExportFile(file)
      message.success(`${t.exportOkPrefix}${file.split('/').pop()}`)
    },
    onError: (err) => message.error(`${t.exportFailedPrefix}${errMsg(err)}`),
  })

  // ── X5：视图库（我的视图，REST /ocr/views）+ 视图选择联动（选中即载入并预览）──
  const [viewSel, setViewSel] = useState<string>()
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const myViews = useQuery({
    queryKey: ['provider', pid, 'ocr-my-views'],
    queryFn: () => api.get<{ views: { id: string; name: string }[] }>('/ocr/views'),
  })
  const saveMyViewMutation = useMutation({
    mutationFn: (body: { name: string; spec: Record<string, unknown> }) =>
      api.send('/ocr/views', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { message.success(t.saveMyViewOk); setSaveViewOpen(false); void myViews.refetch() },
    onError: (err) => message.error(`${t.saveMyViewFailedPrefix}${errMsg(err)}`),
  })
  const deleteViewMutation = useMutation({
    mutationFn: (id: string) => api.send(`/ocr/views/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => { void myViews.refetch(); message.success(t.myViewDeleted) },
    onError: (err) => message.error(`${t.myViewDelFailedPrefix}${errMsg(err)}`),
  })
  const viewOptions = useMemo(() => {
    const groups: { label: string; options: { value: string; label: string }[] }[] = []
    const builtin = props.builtinViews ?? []
    if (builtin.length) {
      groups.push({ label: t.builtinViewsGroup, options: builtin.map((b) => ({ value: `builtin:${b.id}`, label: b.name })) })
    }
    if (detail.data?.view_spec) {
      groups.push({ label: t.templateViewGroup, options: [{ value: 'template', label: String(detail.data.name ?? templateId ?? '') }] })
    }
    const mine = myViews.data?.views ?? []
    if (mine.length) {
      groups.push({ label: t.myViewsGroup, options: mine.map((v) => ({ value: `my:${v.id}`, label: v.name })) })
    }
    return groups
  }, [props.builtinViews, detail.data, myViews.data, t, templateId])
  const applyView = (value: string) => {
    setViewSel(value)
    const fire = (text: string) => { setViewSpec(text); if (db && props.viewTool) previewMutation.mutate(text) }
    if (value.startsWith('builtin:')) {
      const spec = (props.builtinViews ?? []).find((b) => `builtin:${b.id}` === value)?.spec
      if (spec) fire(JSON.stringify(spec, null, 2))
    } else if (value === 'template') {
      if (detail.data?.view_spec) fire(JSON.stringify(detail.data.view_spec, null, 2))
    } else if (value.startsWith('my:')) {
      const vid = value.slice(3)
      void api.get<{ spec: Record<string, unknown> }>(`/ocr/views/${encodeURIComponent(vid)}`)
        .then((v) => fire(JSON.stringify(v.spec, null, 2)))
        .catch((e) => message.error(`${t.myViewDelFailedPrefix}${errMsg(e)}`))
    }
  }
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
    <Card title={t.title}>
      {props.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {props.description}
        </Typography.Paragraph>
      )}
      <Flex gap={16} align="stretch" style={{ minHeight: 460 }}>
        <Card size="small" title={t.dbsTitle} style={{ width: 240, flexShrink: 0 }} styles={{ body: { padding: 0 } }}
          extra={mergedPaths.length >= 2 ? (
            <Flex gap={6} align="center">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.mergedSelected(mergedPaths.length)}</Typography.Text>
              <Button size="small" type="text" onClick={() => setMergedPaths([])}>{t.mergedClear}</Button>
            </Flex>
          ) : undefined}
        >
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
                <Checkbox
                  checked={mergedPaths.includes(item.path)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMergedPaths((prev) => prev.includes(item.path)
                      ? prev.filter((x) => x !== item.path) : [...prev, item.path])
                  }}
                  title={t.mergedHint}
                />
                <List.Item.Meta
                  title={<Typography.Text ellipsis style={{ maxWidth: 150 }}>{item.name}</Typography.Text>}
                  description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{item.records} 条</Typography.Text>}
                />
                <Popconfirm
                  title="删除该结果库？"
                  description="连同模型原文留痕一并删除，不可恢复"
                  okText="删除" okButtonProps={{ danger: true }} cancelText="取消"
                  onConfirm={(e) => { e?.stopPropagation(); deleteDbMutation.mutate({ path: item.path }) }}
                >
                  <Button size="small" type="text" danger
                    onClick={(e) => e.stopPropagation()}>删除</Button>
                </Popconfirm>
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
                  <Card size="small" title={t.templateLabel}>
                    <Flex gap={12} align="center" wrap="wrap">
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
                  </Card>
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
                            onPicked={batchAdd}
                            source="ocr"
                          />
                          <UploadsPanel
                            extensions={batchCfg.extensions}
                            useLabel="用所选发起识别"
                            onUseFiles={(paths) => {
                              batchAdd(paths.map((p) => ({
                                path: p, name: p.split('/').pop() ?? p, size: 0,
                              })))
                              message.success(`已载入 ${paths.length} 个已上传原件，配置模版后开始识别`)
                            }}
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
                                <Form.Item key={key} name={key} label={(schema.title as string) ?? key} style={{ minWidth: 220 }} valuePropName={Array.isArray(schema.type) && schema.type.includes('boolean') || schema.type === 'boolean' ? 'checked' : undefined}>
                                  {renderExtraControl(schema, keyOptions)}
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
              key: 'runs', label: t.tabRuns,
              children: (
                <RunListPanel
                  runs={taskRuns}
                  flowIds={props.flows}
                  loading={ocrRuns.isLoading}
                  onRefresh={() => { void ocrRuns.refetch() }}
                  onChanged={() => { void ocrRuns.refetch() }}
                  onOpenRun={setDetailRun}
                  onRerun={(id) => rerunMutation.mutate(id)}
                  onAbort={(id) => abortMutation.mutate(id)}
                />
              ),
            },
            {
              key: 'views', label: t.tabViews,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title={t.viewPickTitle}>
                    <Flex gap={8} wrap="wrap" align="center">
                      <Select
                        style={{ minWidth: 280 }}
                        placeholder={t.viewPickPlaceholder}
                        value={viewSel}
                        onChange={applyView}
                        options={viewOptions}
                      />
                      <Button size="small" loading={previewMutation.isPending} disabled={!db || !props.viewTool || !specReady} onClick={() => previewMutation.mutate()}>{t.preview}</Button>
                      <Button size="small" type="primary" loading={exportMutation.isPending} disabled={!db || !props.exportFlow || !specReady} onClick={() => exportMutation.mutate()}>{t.export}</Button>
                      {exportFile && <DownloadButton path={exportFile} label={t.download} />}
                      <Button size="small" disabled={!specReady} onClick={() => setSaveViewOpen(true)}>{t.saveMyView}</Button>
                      <Popover
                        trigger="click"
                        title={t.myViews}
                        content={(
                          <List
                            size="small" style={{ width: 300 }}
                            loading={myViews.isLoading}
                            dataSource={myViews.data?.views ?? []}
                            locale={{ emptyText: t.myViewsEmpty }}
                            renderItem={(v: { id: string; name: string }) => (
                              <List.Item
                                actions={[
                                  <Popconfirm key="del" title={t.myViewDelConfirm} onConfirm={() => deleteViewMutation.mutate(v.id)}>
                                    <Button size="small" type="link" danger>{t.myViewDel}</Button>
                                  </Popconfirm>,
                                ]}
                              >
                                <Typography.Text ellipsis style={{ maxWidth: 200 }}>{v.name}</Typography.Text>
                              </List.Item>
                            )}
                          />
                        )}
                      >
                        <Button size="small">{t.manageMyViews}</Button>
                      </Popover>
                    </Flex>
                    {!specReady
                      ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.specRequired}</Typography.Text>
                      : <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.previewHint}</Typography.Text>}
                  </Card>
                  <Card size="small" title={t.viewDefTitle}>
                    <SpecEditor value={viewSpec ?? ''} onChange={(next) => { setViewSpec(next); setViewSel(undefined) }} hideQuickPick />
                    <Flex gap={8} style={{ marginTop: 8 }} wrap="wrap">
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
            fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=="
            style={{ maxHeight: 520, objectFit: 'contain' }}
          />
        )}
      </Modal>

      {/* X5：另存为我的视图 */}
      <Modal
        title={t.saveMyView}
        open={saveViewOpen}
        onCancel={() => setSaveViewOpen(false)}
        footer={[
          <Button key="c" size="small" onClick={() => setSaveViewOpen(false)}>{t.myViewCancel}</Button>,
          <Button key="ok" size="small" type="primary" loading={saveMyViewMutation.isPending}
            disabled={!saveViewName.trim()}
            onClick={() => {
              try { saveMyViewMutation.mutate({ name: saveViewName.trim(), spec: JSON.parse(viewSpec ?? '{}') }) }
              catch { message.error('视图定义不是合法 JSON，无法另存') }
            }}>{t.saveMyViewOkBtn}</Button>,
        ]}
      >
        <Input
          placeholder={t.saveMyViewNameLabel}
          value={saveViewName}
          onChange={(e) => setSaveViewName(e.target.value)}
          onPressEnter={() => {
            if (saveViewName.trim()) {
              try { saveMyViewMutation.mutate({ name: saveViewName.trim(), spec: JSON.parse(viewSpec ?? '{}') }) }
              catch { message.error('视图定义不是合法 JSON，无法另存') }
            }
          }}
        />
      </Modal>

      {/* X6：任务详情抽屉 + 进行中浮窗（与翻译工作台同一套） */}
      <Drawer title="任务详情" width={720} open={Boolean(detailRun)} onClose={() => setDetailRun(null)}>
        {detailDetail.data && <RunDetail run={detailDetail.data} logs={detailLogs.data?.events ?? []} toolNames={detailDetail.data.tool_names} />}
      </Drawer>
      <TaskFloat
        runs={taskRuns.filter((r) => r.status === 'running' || r.status === 'queued')}
        onOpen={setDetailRun}
        title="识别进行中"
      />
    </Card>
  )
}

/** 模板增量输入控件（JSON Schema → antd 控件的最小映射）。 */
function renderExtraControl(schema: Record<string, unknown>, keyOptions?: { value: string; label: string }[]) {
  // 密钥类字段：**只能从已录入的密钥里选**（手写错名会让任务白白重试后失败）
  if ((schema.format as string) === 'keys' || (schema.title as string)?.includes('密钥')) {
    return <Select allowClear showSearch placeholder="选择已录入的密钥"
      options={keyOptions ?? []} />
  }
  if (schema.enum) return <Select options={(schema.enum as unknown[]).map((v) => ({ value: v, label: String(v) }))} />
  // AC1：examples → AutoComplete（既给候选又可填自定义模型快照名，规避 enum 只能选的限制）
  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    return <AutoComplete allowClear placeholder={schema.description as string | undefined}
      options={(schema.examples as unknown[]).map((v) => ({ value: String(v) }))} />
  }
  if (schema.type === 'boolean' || (Array.isArray(schema.type) && schema.type.includes('boolean'))) return <Switch />
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
    tabRuns: '任务',
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
    viewPickTitle: '选择视图',
    viewPickPlaceholder: '选择视图（内置 / 模版 / 我的）',
    saveMyView: '另存为我的视图',
    manageMyViews: '管理我的视图',
    myViews: '我的视图',
    myViewsEmpty: '还没有保存的视图',
    myViewDel: '删除',
    myViewDelConfirm: '删除该视图？',
    saveMyViewOk: '已保存到我的视图',
    saveMyViewOkBtn: '保存',
    myViewCancel: '取消',
    saveMyViewNameLabel: '视图名称',
    saveMyViewFailedPrefix: '保存失败：',
    myViewDeleted: '已删除',
    myViewDelFailedPrefix: '操作失败：',
    builtinViewsGroup: '内置视图',
    templateViewGroup: '模版视图',
    myViewsGroup: '我的视图',
    mergeExport: '合并导出',
    mergedHint: '勾选 ≥2 个结果库后，导出按钮变为合并导出（按来源分组、同页多行有序）',
    mergedSelected: (n: number) => `已选 ${n} 库`,
    mergedClear: '清空',
    mergedExportName: (n: number) => `合并导出${n}库`,
  }
}
