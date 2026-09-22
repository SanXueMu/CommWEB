/**
 * 翻译工作台（视图 'translate.studio'）——还原 Translee 一站式体验：
 * 翻译模版侧栏（语言对/术语表/模型）→ 传文件（按扩展名自动路由到对应流）→ 开始翻译（步骤跟踪 + Token 用量）→
 * 任务列表（进度/统计/产物/再运行/取消/删除 + 详情日志）→ 资料库（术语表 / 已译字典 / 模板管理）+ 任务浮窗。
 * 纯壳准则：业务数据（流 ID/路由/语言候选/模板 id）全部来自声明 props；本组件零业务知识。
 *
 * 声明 props：
 *  flow_prefix?: string
 *  routes?: { ext: string[]; flow: string; label?: string }[]  // 后缀 → 流（同后缀多条=可选）
 *  params?: ParamField[]                         // 通用附加参数（声明驱动，可按流过滤）
 *  unsupported?: { ext: string[]; message: string }[]   // 不支持后缀的提示文案（如旧版 .doc）
 *  batch?: { extensions?: string[]; skip?: string[]; maxFiles?: number; maxTotalMB?: number }  // 存在才显示批量入口
 *  templatesPath?: string                        // 翻译模板端点（默认 /translate/templates）
 *  dictPath?: string                             // 字典浏览端点（默认 /translate/dict）
 *  languages?: { value: string; label: string }[]
 *  description?: string
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, AutoComplete, Button, Card, Checkbox, Drawer, Empty, Flex, Form, Input, Tooltip,
  Progress, Segmented, Select, Space, Tabs, Tag, Typography,
} from 'antd'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import type { BatchFileEntry } from '@/api/client'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { viewPathByType } from '@/transfer/siteManifest'
import { useViewProps } from '@/protocol/ViewPropsContext'
import {
  flowForFile, imagePageLimit, matchRoutes, matchUnsupported, paramDefault, routeForProbe,
  supportedExtensions, visibleParams,
  type FileProbe, type ParamField, type Route, type UnsupportedRule,
} from '@/protocol/routeSelect'
import { runPool } from '@/protocol/pool'
import { pollIntervalFor } from '@/protocol/polling'
import type {
  Task, TranslateDictEntry, TranslateTemplate,
} from '@/api/types'
import { FileUpload } from '@/components/FileUpload'
import { BatchUpload } from '@/components/BatchUpload'
import { UploadsPanel } from '@/components/UploadsPanel'
import RunListPanel from '@/components/RunListPanel'
import { StepTrack } from '@/components/StepTrack'
import { TaskFloat, RunDetail, UsagePanel, aggregate } from '@/components/RunWidgets'
import { SettingsKeys } from '@/components/SettingsKeys'
import { Button as UiButton, Modal } from '@/ui'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const RUNNING = new Set(['running', 'pending', 'queued', 'paused'])
// 客户端削峰：批量入队并发 2（翻译模型有 RPM 限速，并发过高会 429）
const ENQUEUE_CONCURRENCY = 2

interface Language { value: string; label: string }
interface TranslateStudioProps {
  flow_prefix?: string
  routes?: Route[]
  params?: ParamField[]
  unsupported?: UnsupportedRule[]
  /** 批量入口声明：存在才显示「单文件 / 批量」切换（业务常量不下沉前端） */
  batch?: { extensions?: string[]; skip?: string[]; maxFiles?: number; maxTotalMB?: number }
  /** PDF 处理口径候选（声明驱动）：auto 自动探测 / text 一律文字版 / image 一律图片翻译 */
  pdfModes?: { value: string; label: string; hint?: string }[]
  templatesPath?: string
  dictPath?: string
  languages?: Language[]
  description?: string
}

export function TranslateStudio() {
  const props = useViewProps() as TranslateStudioProps
  const pid = useActivePid()
  const api = apiFor(pid)
  const { site } = useSiteCatalog()
  const qc = useQueryClient()
  const t = useTranslateText()

  const routes = props.routes ?? []
  const paramFields = props.params ?? []
  /** 声明的模型参数（模板编辑弹窗复用其候选与占位文案，避免两处硬编码）。 */
  const modelParam = paramFields.find((p) => p.name === 'model')
  const unsupportedRules = props.unsupported ?? []
  const templatesPath = props.templatesPath ?? '/translate/templates'
  const dictPath = props.dictPath ?? '/translate/dict'
  const languages = props.languages ?? []

  // ── 表单元状态 ──
  const [templateId, setTemplateId] = useState<string>()
  const [file, setFile] = useState<string>()
  const [keyName, setKeyName] = useState<string>()
  const [sourceLang, setSourceLang] = useState<string>('')
  const [targetLang, setTargetLang] = useState<string>('Chinese')
  const [routeFlow, setRouteFlow] = useState<string>()
  const [probe, setProbe] = useState<FileProbe>()
  const [probeNote, setProbeNote] = useState<string>()
  const manualFlow = useRef(false)
  const [paramVals, setParamVals] = useState<Record<string, string>>({})
  const [activeRun, setActiveRun] = useState<string | null>(null)
  const [detailRun, setDetailRun] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTpl, setEditTpl] = useState<TranslateTemplate | null>(null)
  const [keysOpen, setKeysOpen] = useState(false)
  const [dictQ, setDictQ] = useState('')
  const [dictStatus, setDictStatus] = useState<string>()
  // ── 批量模式 ──
  const batchSpec = props.batch
  const [batchOn, setBatchOn] = useState(false)
  const [batchList, setBatchList] = useState<BatchFileEntry[]>([])
  const [batchSel, setBatchSel] = useState<string[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 })
  const [batchReport, setBatchReport] = useState<{ file: string; flow?: string; runId?: string; error?: string }[]>([])
  /** 本次上传的批次号/批次根目录名（导出按批次还原原目录结构；跨刷新由 batchNames 记忆）。 */
  const [batchId, setBatchId] = useState<string>()
  const [batchNames, setBatchNames] = useState<Record<string, string>>({})
  /** PDF 处理口径（取值与声明 pdfModes[].value 一致，前端不写死）：
   *  auto=按文字层自动；doc=一律文档翻译（自动补文字层）；text=一律版式（扫描件暂停待补层）；image=一律图片翻译。 */
  const [pdfMode, setPdfMode] = useState<string>('auto')
  const pdfModes = props.pdfModes ?? []
  const flowLabels = useMemo(
    () => Object.fromEntries(routes.map((r) => [r.flow, r.label ?? r.flow])),
    [routes])
  /** 声明里标记 skip 的流（PPT 等）：入队后暂停留档，导出时放原文件。 */
  const skipFlow = useMemo(() => routes.find((r) => r.skip)?.flow, [routes])
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
    // 有任务在跑就快刷（1.5s），全部终态退到慢刷：任务清单进度不再「半天不动」
    refetchInterval: (q) => pollIntervalFor((q.state.data?.runs ?? []).map((r) => r.status)),
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
    // AH4：日志随任务推进滚动（running 时与详情同频轮询；已有事件即停）
    refetchInterval: (q) => (detailDetail.data && RUNNING.has(detailDetail.data.run.status)
      ? (q.state.data?.events.length ? false : 2000) : false),
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
  const matchedRoutes = useMemo(() => matchRoutes(file, routes), [file, routes])
  const flow = useMemo(() => flowForFile(file, routes, routeFlow), [file, routes, routeFlow])

  /** 用户手动选定处理方式（此后不再被自动探测覆盖）。 */
  const chooseFlow = (v?: string) => {
    manualFlow.current = true
    setRouteFlow(v)
  }

  // 系统探测：PDF 有无文字层 → 自动选流（扫描件→图片翻译）；换文件即重置手动选择
  useEffect(() => {
    manualFlow.current = false
    setProbe(undefined)
    setProbeNote(undefined)
    setRouteFlow(undefined)
    if (!file || !file.toLowerCase().endsWith('.pdf')) return
    let alive = true
    api.probeFile(file)
      .then((p) => {
        if (!alive) return
        setProbe(p)
        const want = routeForProbe(file, routes, p)
        if (want) setRouteFlow(want)
        setProbeNote(p.has_text_layer ? t.probeText : t.probeScanned)
      })
      .catch(() => undefined)
    return () => { alive = false }
    // routes/t 仅在换文件时读取一次，不进依赖避免重复探测
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, api])
  const activeParams = visibleParams(paramFields, flow)
  /** 参数默认值：声明 default_by_flow 优先于 default（如 Word 默认双语、PDF 版式默认原位） */
  const paramValue = (p: ParamField, f = flow) => paramVals[p.name] ?? paramDefault(p, f)
  /** 按文件名分流（批量时同一批可含多种类型：pdf 走版式、docx 走 Word 流） */
  const flowFor = (fileName: string) => flowForFile(fileName, routes, routeFlow)
  /** 单文件 / 批量共用的管线入参。
   *
   *  targetFlow **必须**是「即将执行的那条流」（探测/手动选择后的结果）——参数可见性
   *  按流判定；若这里按扩展名默认流取参数，扫描件走图片流时就会漏发 image_model
   *  等键，引擎模板缺键直接入队失败（2026-09-14 线上事故根因）。
   */
  const buildInput = (fileName: string, path: string, targetFlow?: string): Record<string, unknown> => {
    const target = targetFlow ?? flowFor(fileName)
    return {
      file: path,
      key_name: keyName,
      source_lang: sourceLang || null,
      target_lang: targetLang || null,
      terms: selectedTemplate?.terms ?? [],
      ...Object.fromEntries(visibleParams(paramFields, target).map((p) => [p.name, paramValue(p, target) || null])),
    }
  }
  // 声明驱动的「不支持后缀」提示（如旧版 .doc）+ 受支持后缀一览
  const unsupportedHint = matchUnsupported(file, unsupportedRules)
  const supportedExts = supportedExtensions(routes).join(' / ')
  const busy = Boolean(activeRun && RUNNING.has(activeDetail.data?.run.status ?? ''))

  // ── 变更 ──
  const runMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.runPipeline(flow!, input),
    onSuccess: (created) => { setActiveRun(created.run_id); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }) },
    onError: (e) => console.error(`${t.startFailed}${errMsg(e)}`),
  })
  const startTranslate = () => {
    if (!flow || !file) { console.warn(t.noRoute); return }
    runMutation.mutate(buildInput(file, file, flow))
  }
  // ── 批量：清单增删 + 客户端并发 2 排队（避免撞 MT 模型请求限速）──
  const batchAdd = (files: BatchFileEntry[], _label: string, batch?: { batch_id?: string; root?: string }) => {
    // 上传端点返回的批次号：建 run 时带上，导出可按批次还原原目录结构
    if (batch?.batch_id) {
      setBatchId(batch.batch_id)
      if (batch.root) setBatchNames((m) => ({ ...m, [batch.batch_id as string]: batch.root as string }))
    }
    setBatchList((prev) => {
      const seen = new Set(prev.map((f) => f.path))
      return [...prev, ...files.filter((f) => !seen.has(f.path))]
    })
    setBatchSel((sel) => [...new Set([...sel, ...files.map((f) => f.path)])])
  }
  const batchToggle = (path: string, on: boolean) =>
    setBatchSel((prev) => (on ? [...new Set([...prev, path])] : prev.filter((p) => p !== path)))
  const startBatch = async () => {
    const targets = batchList.filter((f) => batchSel.includes(f.path))
    if (!targets.length) { console.warn(t.batchNone); return }
    setBatchRunning(true)
    setBatchReport([])
    setBatchProgress({ done: 0, total: targets.length })
    const report: { file: string; flow?: string; runId?: string; error?: string }[] = []
    // 逐文件选流：① 声明标记 skip 的类型（PPT）→ 暂停留档，等人工决策
    //            ② PDF 按所选口径：auto 探测文字层 / text 强制文字版（扫描件暂停待补文字层）/ image 强制图片翻译
    //            ③ 其余按扩展名分流；超页数上限不入队
    const pdfFlow = (kind: string) => routes.find((r) => r.for === kind)?.flow
    const resolveFlow = async (item: BatchFileEntry) => {
      const byExt = flowFor(item.name)
      if (item.skip && skipFlow) return { flow: skipFlow, reason: item.skip_reason ?? t.skipReason }
      if (!item.name.toLowerCase().endsWith('.pdf')) return { flow: byExt }
      if (pdfMode === 'image') return { flow: pdfFlow('scanned') ?? byExt }
      // 「全部文档翻译」：一律走文档翻译（工具侧 auto_ocr 自动补文字层），扫描件无需预处理
      if (pdfMode === 'doc') return { flow: pdfFlow('doc') ?? byExt }
      if (pdfMode === 'text') {
        try {
          const p = await api.probeFile(item.path)
          if (p.has_text_layer === false) {
            return skipFlow
              ? { flow: skipFlow, reason: t.pdfNeedOcr }
              : { flow: byExt, error: t.pdfNeedOcr }
          }
        } catch { /* 探测失败按文字版继续 */ }
        return { flow: pdfFlow('text') ?? byExt }
      }
      try {
        const p = await api.probeFile(item.path)
        const limit = imagePageLimit(p)
        if (p.has_text_layer === false && limit && (p.pages ?? 0) > limit) {
          return { flow: byExt, error: `${t.pageOver}（${p.pages}/${limit}）` }
        }
        return { flow: routeForProbe(item.name, routes, p) ?? byExt }
      } catch {
        return { flow: byExt }
      }
    }
    await runPool(targets, async (item) => {
      const { flow: target, error: probeError, reason } = await resolveFlow(item)
      if (probeError) {
        report.push({ file: item.name, error: probeError })
      } else if (!target) {
        report.push({ file: item.name, error: t.noRoute })
      } else {
        try {
          const input = buildInput(item.name, item.path, target)
          if (reason) input.reason = reason
          const created = await api.runPipeline(target, input, batchId)
          report.push({ file: item.name, flow: target, runId: created.run_id })
        } catch (error) {
          report.push({ file: item.name, flow: target, error: errMsg(error) })
        }
      }
      setBatchProgress((p) => ({ ...p, done: p.done + 1 }))
      setBatchReport([...report])
    }, ENQUEUE_CONCURRENCY)
    setBatchRunning(false)
    const ok = report.filter((r) => r.runId).length
    if (ok) console.info(`${t.batchQueued} ${ok}/${report.length}`)
    if (ok < report.length) console.warn(`${report.length - ok} ${t.batchSomeFailed}`)
    qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] })
  }
  const rerunMutation = useMutation({
    mutationFn: (id: string) => api.rerunRun(id),
    onSuccess: (r) => { setActiveRun(r.run_id); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }) },
    onError: (e) => console.error(`${t.rerunFailed}${errMsg(e)}`),
  })
  const abortMutation = useMutation({
    mutationFn: (id: string) => api.abortRun(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] }),
    onError: (e) => console.error(`${t.abortFailed}${errMsg(e)}`),
  })
  const saveTplMutation = useMutation({
    mutationFn: (template: TranslateTemplate) => api.send(templatesPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template }),
    }),
    onSuccess: () => { setEditorOpen(false); qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-templates'] }) },
    onError: (e) => console.error(`${t.saveFailed}${errMsg(e)}`),
  })
  const delTplMutation = useMutation({
    mutationFn: (id: string) => api.send(`${templatesPath}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-templates'] }),
    onError: (e) => console.error(`${t.deleteFailed}${errMsg(e)}`),
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
    // 模版声明了模型才覆盖，否则保留声明层默认（如 qwen-mt-flash）
    if (tpl.model) setParamVals((s) => ({ ...s, model: tpl.model ?? '' }))
    // 模版声明的业务领域透传给图片翻译（domainHint）
    if (tpl.domain_hint) setParamVals((s) => ({ ...s, image_domain_hint: tpl.domain_hint ?? '' }))
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

  /** combo 下拉候选：声明 options + 已译字典里真实用过的模型（去重）。仍可手写任意模型名。 */
  const comboOptions = (p: ParamField) => {
    const declared = (p.options ?? []).map((o) => ({ value: o.value, label: o.label }))
    if (p.name !== 'model') return declared
    const seen = new Set(declared.map((o) => o.value))
    return [...declared, ...dictModels.filter((m) => !seen.has(m)).map((m) => ({ value: m, label: `${m}${t.modelUsed}` }))]
  }

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
           <Button size="small" onClick={() => openEditor(null)}>＋ {t.newTemplate}</Button>
           {settingsPath && <Button size="small" onClick={() => setKeysOpen(true)}>密钥：{t.keys}</Button>}
        </Space>
      }
    >
      {props.description && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>{props.description}</Typography.Paragraph>
      )}
      <Flex gap={16} align="stretch" style={{ minHeight: 480 }}>
        {/* 模板侧栏 */}
        <Card size="small" title={t.sidebar} style={{ width: 260, flexShrink: 0 }} styles={{ body: { padding: 0 } }}>
          <div style={{ minHeight: 120 }}>
            {templates.isLoading ? <div role="status">加载中...</div> : tplList.length === 0 ? <div style={{ padding: 16, color: 'var(--cw-text-secondary)' }}>{t.sidebarEmpty}</div> : tplList.map((tpl) => (
              <div key={tpl.id} style={{ cursor: 'pointer', padding: '8px 12px', background: tpl.id === templateId ? 'rgba(91,141,239,0.10)' : undefined, display: 'flex', justifyContent: 'space-between', gap: 8 }} onClick={() => selectTemplate(tpl)}>
                <div style={{ minWidth: 0 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</div><span style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>{tpl.source_lang}→{tpl.target_lang} · {(tpl.terms_count ?? tpl.terms?.length ?? 0)}{t.termUnit}{tpl.model ? ` · ${tpl.model}` : ''}</span></div>
                <span style={{ display: 'flex', gap: 4 }}><button type="button" onClick={(e) => { e.stopPropagation(); openEditor(tpl) }}>编辑</button><button type="button" onClick={(e) => { e.stopPropagation(); if (window.confirm(t.confirmDeleteTpl)) delTplMutation.mutate(tpl.id) }}>删除</button></span>
              </div>
            ))}
          </div>
        </Card>

        <Tabs
          style={{ flex: 1, minWidth: 0 }}
          items={[
            {
              key: 'translate', label: t.tabTranslate,
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title={t.runConfig}>
                    {batchSpec && (
                      <Segmented
                        block style={{ marginBottom: 12 }}
                        value={batchOn ? 'batch' : 'single'}
                        onChange={(v) => setBatchOn(v === 'batch')}
                        options={[{ value: 'single', label: t.modeSingle }, { value: 'batch', label: t.modeBatch }]}
                      />
                    )}
                    {batchOn ? (
                      <>
                        <BatchUpload
                          extensions={batchSpec?.extensions}
                          skip={batchSpec?.skip}
                          maxFiles={batchSpec?.maxFiles}
                          maxTotalMB={batchSpec?.maxTotalMB}
                          disabled={batchRunning}
                          onPicked={batchAdd}
                          source="translate"
                        />
                        <UploadsPanel />
                        {pdfModes.length > 0 && (
                          <Space size={8} style={{ marginTop: 10 }} wrap>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.pdfMode}</Typography.Text>
                            <Segmented
                              size="small" value={pdfMode}
                              onChange={(v) => setPdfMode(v as 'auto' | 'text' | 'image')}
                              options={pdfModes.map((m) => ({
                                value: m.value,
                                label: <Tooltip title={m.hint}>{m.label}</Tooltip>,
                              }))}
                            />
                          </Space>
                        )}
                        {batchList.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <Flex justify="space-between" align="center" wrap="wrap">
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {t.batchList}（{batchSel.length}/{batchList.length}）
                              </Typography.Text>
                              <Space size={4} wrap>
                                <Button size="small" onClick={() => setBatchSel(batchList.map((f) => f.path))}>{t.selectAll}</Button>
                                <Button size="small" onClick={() => setBatchSel([])}>{t.selectNone}</Button>
                                <Button size="small" danger disabled={batchRunning}
                                  onClick={() => { setBatchList([]); setBatchSel([]); setBatchReport([]) }}>
                                  {t.clearList}
                                </Button>
                              </Space>
                            </Flex>
                            <div style={{ maxHeight: 180, overflow: 'auto', marginTop: 4 }}>
                              {batchList.map((f) => (
                                <div key={f.path}>
                                  <Checkbox checked={batchSel.includes(f.path)} disabled={batchRunning}
                                    onChange={(e) => batchToggle(f.path, e.target.checked)}>
                                    <Typography.Text style={{ fontSize: 12 }}>{f.rel ?? f.name}</Typography.Text>
                                    <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                      {f.size >= 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(f.size / 1024))}KB`}
                                    </Typography.Text>
                                  </Checkbox>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <FileUpload value={file ?? undefined} onChange={setFile} />
                    )}
                    <Form layout="vertical" style={{ marginTop: 12 }}>
                      <Flex gap={12} wrap="wrap">
                        <Form.Item label={t.keyLabel} style={{ minWidth: 200 }}>
                          <Select
                            allowClear placeholder={t.keyPlaceholder} value={keyName} loading={keys.isLoading}
                            options={(keys.data?.keys ?? []).map((k) => ({ value: k.name, label: `${k.name}${k.is_default ? t.defaultTag : ''}` }))}
                            onChange={setKeyName}
                          />
                        </Form.Item>
                        <Form.Item label={t.sourceLabel} style={{ minWidth: 160 }}>
                          <Select allowClear placeholder={t.autoLang} value={sourceLang || undefined}
                            options={languages.map((l) => ({ value: l.value, label: l.label }))} onChange={(v) => setSourceLang(v ?? '')} />
                        </Form.Item>
                        <Form.Item label={t.targetLabel} style={{ minWidth: 160 }}>
                          <Select value={targetLang} options={languages.map((l) => ({ value: l.value, label: l.label }))} onChange={setTargetLang} />
                        </Form.Item>
                        {matchedRoutes.length > 1 && (
                          <Form.Item label={t.routeLabel} style={{ minWidth: 240 }}>
                            <Select value={flow} onChange={chooseFlow}
                              options={matchedRoutes.map((r) => ({ value: r.flow, label: r.label ?? r.flow }))} />
                          </Form.Item>
                        )}
                        {activeParams.map((p) => (
                          <Form.Item key={p.name} label={p.label} style={{ minWidth: 200 }}>
                            {p.type === 'select'
                              ? <Select value={paramValue(p) || undefined} placeholder={p.placeholder}
                                  options={(p.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                                  onChange={(v) => setParamVals((s) => ({ ...s, [p.name]: v ?? '' }))} />
                              : p.type === 'combo'
                                ? <AutoComplete
                                    value={paramValue(p)}
                                    style={{ minWidth: 220 }}
                                    placeholder={p.placeholder}
                                    options={comboOptions(p)}
                                    filterOption={(input, option) =>
                                      String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                                    onChange={(v) => setParamVals((s) => ({ ...s, [p.name]: v ?? '' }))}
                                  />
                                : <Input value={paramValue(p)} placeholder={p.placeholder}
                                    onChange={(e) => setParamVals((s) => ({ ...s, [p.name]: e.target.value }))} />}
                          </Form.Item>
                        ))}
                      </Flex>
                    </Form>
                    {selectedTemplate && (selectedTemplate.terms?.length ?? 0) > 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t.termsFromTpl}（{selectedTemplate.name}）：{selectedTemplate.terms!.map(([a]) => a).join('、')}
                      </Typography.Text>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <Space wrap>
                        {batchOn ? (
                          <Button type="primary" size="large" loading={batchRunning}
                            disabled={!batchSel.length || batchRunning} onClick={startBatch}>
                            {t.batchStart}（{batchSel.length}）
                          </Button>
                        ) : (
                          <Button type="primary" size="large" loading={busy || runMutation.isPending} disabled={!canStart} onClick={startTranslate}>
                            {t.start}
                          </Button>
                        )}
                        {!batchOn && file && flow && <Tag>{flow}</Tag>}
                        {!batchOn && probeNote && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {probeNote}
                            {probe?.pages ? ` · ${probe.pages} ${t.pagesWord}` : ''}
                          </Typography.Text>
                        )}
                        {!batchOn && file && !flow && (
                          <Typography.Text type={unsupportedHint ? 'danger' : 'warning'}>
                            {unsupportedHint ?? t.noRoute}
                          </Typography.Text>
                        )}
                        {!batchOn && file && !flow && supportedExts && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {t.supportedExts}：{supportedExts}
                          </Typography.Text>
                        )}
                      </Space>
                      {batchOn && batchProgress.total > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Progress
                            size="small" percent={Math.round((batchProgress.done / batchProgress.total) * 100)}
                            status={batchRunning ? 'active' : 'normal'}
                            format={() => `${batchProgress.done}/${batchProgress.total}`}
                          />
                          <div style={{ maxHeight: 140, overflow: 'auto' }}>
                            {batchReport.map((r) => (
                              <Typography.Text key={r.file} type={r.runId ? 'secondary' : 'danger'}
                                style={{ fontSize: 12, display: 'block' }}>
                                {r.runId ? '✓' : '✕'} {r.file}
                                {r.flow && <Typography.Text type="secondary" style={{ fontSize: 11 }}> [{r.flow.replace('flow.translate.', '')}]</Typography.Text>}
                                {r.runId ? '' : `：${r.error}`}
                              </Typography.Text>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                  {activeRun && activeStatus && (
                    <Card size="small" title={t.runStatus}>
                      <StepTrack runId={activeRun} steps={steps} runStatus={activeStatus} />
                      {activeStatus === 'failed' && (
                        <Alert type="error" showIcon style={{ marginTop: 8 }}
                          message={(activeDetail.data?.run.error as { message?: string } | null)?.message ?? t.runFailed} />
                      )}
                      <UsagePanel usage={activeUsage} />
                    </Card>
                  )}
                </Space>
              ),
            },
            {
              key: 'tasks', label: t.tabTasks,
              children: (
                <RunListPanel
                  pid={pid} runs={runList} loading={runs.isLoading} showStats
                  flowIds={flowIds}
                  onRefresh={() => runs.refetch()}
                  onChanged={() => qc.invalidateQueries({ queryKey: ['provider', pid, 'translate-runs'] })}
                  flowLabels={flowLabels}
                  batchNames={batchNames}
                  onOpenRun={setDetailRun}
                  onRerun={(id) => rerunMutation.mutate(id)}
                  onAbort={(id) => abortMutation.mutate(id)}
                />
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
                           : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={{ textAlign: 'left', padding: 8 }}>{t.colSource}</th><th style={{ textAlign: 'left', padding: 8 }}>{t.colTarget}</th></tr></thead><tbody>{selectedTemplate.terms!.map(([source, target], index) => <tr key={`${source}-${index}`}><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{source}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{target}</td></tr>)}</tbody></table></div>
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
                           {dict.isLoading ? <div role="status">加载中...</div> : (dict.data?.rows ?? []).length === 0 ? <div style={{ padding: 16, color: 'var(--cw-text-secondary)' }}>{t.dictEmpty}</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{[t.colSource, t.colTarget, t.colModel, t.colStatus].map((title) => <th key={title} style={{ textAlign: 'left', padding: 8 }}>{title}</th>)}</tr></thead><tbody>{(dict.data?.rows ?? []).map((row, index) => <tr key={`${row.source}-${index}`}><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{row.source}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{row.translated}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{row.model}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}><span className="cw-chip">{row.status}</span></td></tr>)}</tbody></table></div>}
                           {(dict.data?.total ?? 0) > 50 && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button type="button" disabled={dictPage <= 1} onClick={() => setDictPage((page) => page - 1)}>上一页</button><span>{dictPage}</span><button type="button" disabled={dictPage * 50 >= (dict.data?.total ?? 0)} onClick={() => setDictPage((page) => page + 1)}>下一页</button></div>}
                        </Space>
                      ),
                    },
                    {
                      key: 'templates', label: t.libTemplates,
                      children: (
                        <Card size="small" extra={<Button size="small" onClick={() => openEditor(null)}>＋ {t.newTemplate}</Button>}>
                          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{[t.colName, t.colLangPair, t.colTermsCount, t.colModel, t.colActions].map((title) => <th key={title} style={{ textAlign: 'left', padding: 8 }}>{title}</th>)}</tr></thead><tbody>{tplList.map((r) => <tr key={r.id}><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{r.name}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{r.source_lang}→{r.target_lang}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{r.terms_count ?? r.terms?.length ?? 0}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}>{r.model ?? '—'}</td><td style={{ padding: 8, borderTop: '1px solid var(--cw-border)' }}><button type="button" onClick={() => openEditor(r)}>{t.edit}</button> <button type="button" onClick={() => { if (window.confirm(t.confirmDeleteTpl)) delTplMutation.mutate(r.id) }}>{t.remove}</button></td></tr>)}</tbody></table></div>
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
        {detailDetail.data && <RunDetail run={detailDetail.data} logs={detailLogs.data?.events ?? []} toolNames={detailDetail.data.tool_names} />}
      </Drawer>

      {/* 模板编辑 */}
      <Modal isOpen={editorOpen} onOpenChange={(open) => !open && setEditorOpen(false)}>
        <Modal.Backdrop />
        <Modal.Container><Modal.Dialog>
          <Modal.Header>{editTpl ? t.editTemplate : t.newTemplate}</Modal.Header>
          <Modal.Body>
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
            <Form.Item name="model" label={t.modelLabel} style={{ minWidth: 200 }}>
              <AutoComplete style={{ minWidth: 200 }} placeholder={t.modelPlaceholder}
                options={comboOptions({ name: 'model', label: t.modelLabel, options: modelParam?.options })} />
            </Form.Item>
          </Flex>
          <Form.Item name="terms" label={t.termsLabel} extra={t.termsHint}>
            <Input.TextArea rows={5} placeholder={'Audit Report => 审计报告'} />
          </Form.Item>
        </Form>
          </Modal.Body>
          <Modal.Footer><UiButton variant="outline" onClick={() => setEditorOpen(false)}>取消</UiButton><UiButton variant="primary" isDisabled={saveTplMutation.isPending} onClick={submitEditor}>{t.save}</UiButton></Modal.Footer>
          <Modal.CloseTrigger />
        </Modal.Dialog></Modal.Container>
      </Modal>

      {/* 密钥管理（协议级组件） */}
      <Drawer title={t.keys} width={720} open={keysOpen} onClose={() => { setKeysOpen(false); keys.refetch() }}>
        <SettingsKeys />
      </Drawer>

      <TaskFloat runs={runningRuns} onOpen={setDetailRun} title="翻译进行中" />
    </Card>
  )
}

/** 运行详情：输入/产物/用量/日志。 */
/** 工作台文案（协议内置 UI 语义，非业务）。 */
function useTranslateText() {
  return {
    title: '翻译工作台', topTemplate: '翻译模版', templatePlaceholder: '选择模版',
    newTemplate: '新建模版', keys: '密钥管理', sidebar: '翻译模版', sidebarEmpty: '暂无翻译模版',
    builtinTag: '（内置）', termUnit: ' 术语', confirmDeleteTpl: '确认删除该模版？',
    tabTranslate: '翻译', tabTasks: '任务', tabLibrary: '资料库',
    runConfig: '翻译配置', keyLabel: '密钥', keyPlaceholder: '选择密钥', defaultTag: '（默认）',
    modelLabel: '模型', modelPlaceholder: '留空用该流默认模型；可手写', modelUsed: '（用过的）', sourceLabel: '源语言', targetLabel: '目标语言',
    routeLabel: '处理方式',
    autoLang: '自动判定', termsFromTpl: '术语表来自模版', start: '开始翻译', noRoute: '未匹配到该文件类型的翻译流',
    supportedExts: '支持的格式',
    modeSingle: '单文件', modeBatch: '批量', batchList: '待翻译文件', selectAll: '全选', selectNone: '全不选',
    clearList: '清空清单', batchStart: '开始翻译（批量）', batchNone: '请先勾选要翻译的文件',
    batchQueued: '已入队', batchSomeFailed: '个未能入队（见下方明细）',
    probeText: '已识别：文字版 PDF（走版式翻译）', probeScanned: '已识别：扫描件（走图片翻译，保留版式）',
    pdfMode: 'PDF 处理方式',
    skipReason: '本轮不处理该类型（任务暂停留档，原文件随批次导出）',
    pdfNeedOcr: '扫描件需文字版：请改用「全部文档翻译」口径（会自动补文字层），或先补文字层（如 ocrmypdf）后重跑',
    pagesWord: '页', pageOver: '超过图片翻译单任务页数上限，请拆分',
    packNone: '请先勾选任务', packRun: '打包下载', packDone: '已打包', packRunsWord: '个任务',
    packFilesWord: '个产物', packSkipped: '部分任务未打包', packFailed: '打包失败：',
    batchDelete: '批量删除', batchDeleteHint: '将对选中的 {n} 个任务执行删除（运行中的会先自动取消）',
    batchDeleteDone: '已删除', batchDeleteFailed: '个任务删除失败', batchSelected: '已选 ',
    batchDeleteUsage: '所选的 {n} 个文件产物合计 {size}（选择「含产物」才会释放）',
    runStatus: '翻译运行', runFailed: '翻译运行失败', startFailed: '提交失败：', rerunFailed: '再运行失败：',
    abortFailed: '取消失败：', deleteFailed: '删除失败：', saveFailed: '保存失败：',
    tabRecords: '', refresh: '刷新', tasksEmpty: '暂无翻译任务', colStatus: '状态', colFile: '文件',
    colFlow: '流', colProgress: '进度', colStats: '统计', colCreated: '创建时间', colActions: '操作',
    detail: '详情', rerun: '再运行', abort: '取消', remove: '删除', confirmDeleteRun: '删除该任务？',
    confirmDeleteRunHint: '该任务现有产物 {n} 项，请选择删除口径（不可恢复）',
    deleteKeep: '删除任务，保留文件', deleteKeepDesc: '任务记录消失，服务器上的产物文件保留',
    deletePurge: '删除任务，并删除产物文件', deletePurgeDesc: '连同该任务的产物与中间结果一起清除',
    cancel: '取消',
    detailTitle: '任务详情', errorLabel: '错误', artifacts: '产物', logs: '运行日志', noLogs: '暂无日志',
    usage: 'Token 用量', statOk: '新译', statCache: '缓存', statReview: '待审', calls: '调用',
    statOverflow: '溢出',
    colModel: '模型', colCalls: '调用', colPrompt: '输入 tok', colCompletion: '输出 tok',
    libGlossary: '术语表', libDict: '已译字典', libTemplates: '模板管理', noTerms: '该模版无术语',
    selectTemplateHint: '先在顶部选择翻译模版', dictSearch: '搜索原文/译文', dictEmpty: '暂无字典记录',
    colSource: '原文', colTarget: '译文', colName: '名称', colDesc: '描述', colLangPair: '语言对',
    colTermsCount: '术语数', edit: '编辑', editTemplate: '编辑模版', save: '保存',
    termsLabel: '术语表', termsHint: '每行一条，格式：原文 => 译文', idRule: 'ID 须为小写字母开头（可含 . _ 数字）',
  }
}
