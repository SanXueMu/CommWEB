import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CSSProperties, ReactNode } from 'react'
import { Button as HeroButton, Card as HeroCard, Input as HeroInput, Modal as HeroModal, Chip } from '@/ui'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useAdaptivePageSize } from '@/hooks/useAdaptivePageSize'
import { apiFor } from '@/api/client'
import type { BatchInfo, RunSummary } from '@/api/types'
import { humanSize } from '@/lib/size'
import { triggerDownload } from '@/lib/download'
import { runPool } from '@/protocol/pool'
import { pollIntervalFor } from '@/protocol/polling'
import { deleteRunOptions, deleteRunParams } from '@/protocol/confirm'
import { useConfirm } from '@/components/ConfirmDialog'

const DeleteOutlined = () => <>删除</>
const DownloadOutlined = () => <>下载</>
const EditOutlined = () => <>编辑</>
const EyeOutlined = () => <>查看</>
const PauseOutlined = () => <>暂停</>
const PlayCircleOutlined = () => <>继续</>
const RedoOutlined = () => <>重跑</>
const ReloadOutlined = () => <>刷新</>
const UploadOutlined = () => <>上传</>
const message = { success: (text: string, ..._args: unknown[]) => console.info(text), error: (text: string, ..._args: unknown[]) => console.error(text), warning: (text: string, ..._args: unknown[]) => console.warn(text) }
const notification = { error: ({ message: title, description }: { message: string; description: string; duration?: number }) => console.error(`${title}: ${description}`) }
function Button({ children, onClick, disabled, loading, danger, type, icon, size }: any) { return <HeroButton size={size === 'small' ? 'sm' : undefined} variant={danger ? 'danger' : type === 'primary' ? 'primary' : undefined} isDisabled={disabled || loading} onClick={onClick}>{icon}{children}</HeroButton> }
function Card({ title, extra, children }: any) { return <HeroCard><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><strong>{title}</strong>{extra}</div>{children}</HeroCard> }
function Space({ children, size = 8, style, wrap }: { children: ReactNode; size?: number; style?: CSSProperties; wrap?: boolean }) { return <div style={{ display: 'flex', flexWrap: wrap ? 'wrap' : undefined, alignItems: 'center', gap: size, ...style }}>{children}</div> }
function Select({ value, onChange, options, placeholder, style }: any) { return <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} style={style}><option value="">{placeholder}</option>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }
function Tag({ children, color }: any) { return <Chip color={color === 'green' ? 'success' : color === 'red' || color === 'error' ? 'danger' : color === 'orange' || color === 'warning' ? 'warning' : color === 'blue' ? 'accent' : undefined}>{children}</Chip> }
function Tooltip({ children, title }: any) { return <span title={typeof title === 'string' ? title : undefined}>{children}</span> }
const Typography = { Text: ({ children, style }: any) => <span style={style}>{children}</span>, Paragraph: ({ children, style }: any) => <p style={style}>{children}</p> }
function Popconfirm({ children, onConfirm }: any) { return <span onClick={(e) => { e.stopPropagation(); if (window.confirm('确认此操作？')) onConfirm() }}>{children}</span> }
function Modal({ open, title, children, footer, onCancel, onOk, confirmLoading }: any) { if (!open) return null; return <HeroModal isOpen onOpenChange={(v) => !v && onCancel?.()}><HeroModal.Backdrop /><HeroModal.Container><HeroModal.Dialog><HeroModal.Header>{title}</HeroModal.Header><HeroModal.Body>{children}</HeroModal.Body><HeroModal.Footer>{footer ?? <><Button onClick={onCancel}>取消</Button><Button type="primary" loading={confirmLoading} onClick={onOk}>保存</Button></>}</HeroModal.Footer><HeroModal.CloseTrigger /></HeroModal.Dialog></HeroModal.Container></HeroModal> }
function Table({ dataSource = [], columns, children, rowSelection, loading, pagination }: any) { const cols = columns ?? []; const childCols = children ? ([] as any[]).concat(children).filter(Boolean).map((c: any) => ({ title: c.props.title, dataIndex: c.props.dataIndex ?? c.key, render: c.props.render })) : cols; const pageSize = pagination?.pageSize ?? dataSource.length; return <div>{loading && <div>加载中...</div>}<table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{rowSelection && <th />}{childCols.map((c: any) => <th key={c.key ?? c.dataIndex} style={{ textAlign: 'left', padding: 6 }}>{c.title}</th>)}</tr></thead><tbody>{dataSource.slice(0, pageSize).map((row: any, i: number) => <tr key={row.id ?? row.run_id ?? i}>{rowSelection && <td><input type="checkbox" checked={rowSelection.selectedRowKeys?.includes(row.id)} onChange={() => rowSelection.onChange?.([row.id])} /></td>}{childCols.map((c: any) => <td key={c.key ?? c.dataIndex} style={{ padding: 6 }}>{c.render ? c.render(row[c.dataIndex], row) : String(row[c.dataIndex] ?? '')}</td>)}</tr>)}</tbody></table></div> }
Table.Column = (_props: any) => null
const Input = Object.assign(HeroInput, { TextArea: ({ value, onChange, style }: any) => <textarea rows={10} value={value} onChange={onChange} style={{ width: '100%', ...style }} /> })

const RUNNING = new Set(['running', 'queued'])
/** 可批量重跑的失败态（与服务端 PipelineService.RERUNNABLE_STATUSES 对齐；paused 走「继续」） */
const RERUNNABLE = new Set(['failed', 'failed_review', 'cancelled', 'interrupted'])
/** 删除并发：4（防拖垮 command-api） */
const DELETE_CONCURRENCY = 4

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '进行中', paused: '已暂停（待处理）',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断',
}

/** 同一文件的多次尝试：只展示「最优」那条（成功 > 暂停 > 失败，同级最新），
 *  排序用该文件**最后一次尝试**时间 —— 重跑后自动排到最前，不会留下「已成功还挂着失败」的混淆。 */
const STATUS_RANK: Record<string, number> = { succeeded: 3, paused: 2 }

interface FileGroup {
  file: string
  best: RunSummary
  all: string[]
  attempts: number
  latestAt: string
}

function groupByFile(runs: RunSummary[]): FileGroup[] {
  const groups = new Map<string, RunSummary[]>()
  for (const r of runs) {
    const key = String(r.input?.file ?? r.id)
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }
  const at = (r: RunSummary) => String(r.created_at ?? '')
  const out: FileGroup[] = []
  for (const [file, list] of groups) {
    const byBest = [...list].sort((a, b) =>
      (STATUS_RANK[b.status] ?? 1) - (STATUS_RANK[a.status] ?? 1) || at(b).localeCompare(at(a)))
    const latestAt = list.reduce((acc, r) => (at(r) > acc ? at(r) : acc), '')
    out.push({ file, best: byBest[0], all: list.map((r) => r.id), attempts: list.length, latestAt })
  }
  return out.sort((a, b) => b.latestAt.localeCompare(a.latestAt))
}

export interface RunListPanelProps {
  pid?: string
  runs: RunSummary[]
  loading?: boolean
  onRefresh?: () => void
  /** 流 ID → 显示名（「流」列） */
  flowLabels?: Record<string, string>
  /** batch_id → 批次根目录名（「批次」列 + 按批次导出） */
  batchNames?: Record<string, string>
  /** 打开详情 */
  onOpenRun?: (runId: string) => void
  onRerun?: (runId: string) => void
  onAbort?: (runId: string) => void
  /** 显示 ✓/⚡/⚠ 质量统计列（翻译工作台用） */
  showStats?: boolean
  /** 本工作台关注的流（可重跑清单按它过滤；服务端聚合，不受列表条数限制） */
  flowIds?: string[]
  /** 删除/续跑后回调（外部刷新） */
  onChanged?: () => void
  emptyText?: string
}

/** 通用任务清单：多选 / 进度 x/n / 按批次筛选与**结构化导出** / 双选项删除 / 暂停续跑。
 *  翻译工作台与 OCR 工作台共用；数据由调用方查询传入，组件只管展示与操作。 */
export default function RunListPanel({
  pid, runs, loading, onRefresh, flowLabels, batchNames,
  onOpenRun, onRerun, onAbort, showStats, flowIds, onChanged, emptyText,
}: RunListPanelProps) {
  const api = useMemo(() => apiFor(pid ?? ''), [pid])
  const qc = useQueryClient()
  const { confirm } = useConfirm()
  const [picked, setPicked] = useState<string[]>([])
  /** UI 原则①：分页行数按容器高度自适应（行高≈40，预留 Card 头/工具条/分页 ~150） */
  const [tableBox, pageSize] = useAdaptivePageSize<HTMLDivElement>({ rowHeight: 40, min: 6, max: 40, reserve: 150 })
  const [batchFilter, setBatchFilter] = useState<string>()
  const [packing, setPacking] = useState(false)
  // AH1：失败项管理弹层——残留失败（含其它批次的窗口外 run）此前无处可删，
  // 结果库被它们引用时还会挡住「删除库」（共享保护 409）
  const [failOpen, setFailOpen] = useState(false)
  const [failBusy, setFailBusy] = useState(false)
  /** 默认「一个文件一行」；打开后展开每个文件的历史尝试（审计记录不丢） */
  const [showHistory, setShowHistory] = useState(false)
  // N3：替换原件（.doc→.docx 等）/ 就地修正任务参数（密钥名、模型）
  const [editRun, setEditRun] = useState<RunSummary | null>(null)
  const [editText, setEditText] = useState('')
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<string | null>(null)

  useEffect(() => {
    setPicked((keys) => keys.filter((k) => runs.some((r) => r.id === k)))
  }, [runs])

  // 选中批次时按批次拉全量（默认列表只加载最新 N 条，看全批次会缺行）
  const batchRuns = useQuery({
    queryKey: ['provider', pid, 'batch-runs', batchFilter],
    queryFn: () => api.listRuns(undefined, 1000, 0, batchFilter),
    enabled: Boolean(batchFilter),
    // 有任务在跑就快刷；全终态慢刷（此前无轮询 → 重跑后列表不刷新）
    refetchInterval: (q) => pollIntervalFor((q.state.data?.runs ?? []).map((r) => r.status)),
  })
  const shown = useMemo(
    () => (batchFilter ? (batchRuns.data?.runs ?? runs.filter((r) => r.batch_id === batchFilter))
                       : runs),
    [runs, batchFilter, batchRuns.data])

  function baseName(p?: unknown): string {
    return String(p ?? '').split('/').pop() ?? ''
  }

  const groups = useMemo(() => groupByFile(shown), [shown])
  const rows = useMemo(() => (showHistory ? shown : groups.map((g) => g.best)),
    [groups, shown, showHistory])
  const attemptsOf = useMemo(() => new Map(groups.map((g) => [g.best.id, g.attempts])), [groups])
  /** 行 id → 该文件全部 run id：删除按**整个文件**生效（不留历史失败记录） */
  const allIdsOf = useMemo(() => new Map(groups.map((g) => [g.best.id, g.all])), [groups])

  // AF3：任务 running → 失败/中断终态时弹报错弹窗（用户裁定：报错要弹窗供排查）
  const prevStatuses = useRef<Record<string, string>>({})
  useEffect(() => {
    const prev = prevStatuses.current
    const next: Record<string, string> = {}
    const newlyFailed: string[] = []
    for (const r of shown) {
      next[r.id] = r.status
      if ((prev[r.id] === 'running' || prev[r.id] === 'queued')
        && (r.status === 'failed' || r.status === 'failed_review' || r.status === 'interrupted'))
        newlyFailed.push(baseName(r.input?.file) || r.id)
    }
    prevStatuses.current = next
    if (newlyFailed.length) {
      const head = newlyFailed.slice(0, 5).join('、')
      const more = newlyFailed.length > 5 ? ` 等 ${newlyFailed.length} 个` : ''
      notification.error({
        message: `任务失败（${newlyFailed.length} 个）`,
        description: `${head}${more}——点击任务行查看错误原因与日志`,
        duration: 8,
      })
    }
  }, [shown])

  /** 待重跑清单：**服务端按整批次聚合**（「从未成功过 + 最新一次失败」），
   *  不再用当前列表算——列表只加载最新 N 条，历史失败会把计数虚高（线上 42 全是噪声）。
   *  勾选了失败项时优先只重跑勾选的。 */
  const rerunQ = useQuery({
    queryKey: ['provider', pid, 'rerunnable', batchFilter, flowIds?.join(',')],
    queryFn: () => api.rerunnableRuns({ batch_id: batchFilter, flow_ids: flowIds }),
    refetchInterval: 5000,
  })
  const pickedFailed = useMemo(
    () => shown.filter((r) => picked.includes(r.id) && RERUNNABLE.has(r.status)).map((r) => r.id),
    [shown, picked])
  const rerunIds = pickedFailed.length > 0 ? pickedFailed : (rerunQ.data?.run_ids ?? [])
  const rerunCount = rerunIds.length
  /** 已有成功译文的文件（服务端口径）：这类文件的「重跑」置灰。
   *  注意不能用「待重跑清单」反推 —— 最新一次是 paused 的文件也不在待重跑清单里，
   *  会被误判成「已成功」（线上 PNG：降级到 skip 后暂停，导致失败的原流无法重跑）。 */
  const doneFiles = useMemo(
    () => new Set(rerunQ.data?.done_files ?? []),
    [rerunQ.data])
  /** 批次下拉/名称以服务端全量清单为准（GET /files/batches）。
   *  不能从「最新 N 条 run」反推——旧批次的 run 被新 run 挤出窗口后整批从下拉里消失。 */
  const allBatchesQ = useQuery({
    queryKey: ['provider', pid, 'all-batches', flowIds?.join(',') ?? ''],
    queryFn: () => api.allBatches(flowIds),
    staleTime: 30_000,
  })
  const batches = useMemo(() => {
    const server = allBatchesQ.data?.batches ?? []
    if (server.length > 0) return server.map((b: BatchInfo) => ({ id: b.id, n: b.files, label: b.root || b.id }))
    // 兜底：全量清单端点不可用（旧后端 422 / 网络错）时退回从已加载 run 推导——
    // 宁可只有窗口内的批次，也不能让批次下拉整个消失。
    const seen = new Map<string, number>()
    for (const r of runs) if (r.batch_id) seen.set(r.batch_id, (seen.get(r.batch_id) ?? 0) + 1)
    return [...seen.entries()].map(([id, n]) => ({ id, n, label: batchNames?.[id] ?? id }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBatchesQ.data, runs, batchNames])
  const batchNameMap = useMemo(() => new Map(batches.map((b) => [b.id, b.label])), [batches])
  const nameOf = (id: string) => batchNameMap.get(id) ?? batchNames?.[id] ?? id

  const usage = useQuery({
    queryKey: ['provider', pid, 'run-usage', picked.join(',')],
    enabled: picked.length > 0,
    queryFn: () => api.usageRuns(picked),
    staleTime: 5_000,
  })

  const resume = useMutation({
    mutationFn: (runId: string) => api.resumeRun(runId),
    onSuccess: () => { message.success('已继续'); invalidateSelf(); onChanged?.(); onRefresh?.() },
    onError: (e: Error) => message.error(e.message),
  })

  const del = useMutation({
    mutationFn: (v: { id: string; purgeFiles: boolean }) => api.deleteRun(v.id, v.purgeFiles)
      .then((r) => {
        const resp = r as { removed_failed_attempts?: unknown[]; dbs_shared?: string[] }
        removedFailed += resp.removed_failed_attempts?.length ?? 0
        const shared = resp.dbs_shared ?? []
        if (shared.length) sharedDbs = [...new Set([...sharedDbs, ...shared])]
        return r
      }),
  })
  let removedFailed = 0
  let sharedDbs: string[] = []

  // 替换原件：把新文件写进同批次目录 + 更新清单 + 更新该 run 的 input.file
  const replaceFile = useMutation({
    mutationFn: (v: { runId: string; file: File }) => api.replaceRunFile(v.runId, v.file),
    onSuccess: () => { message.success('已替换原件，点「继续」或「重跑」即可'); invalidateSelf(); onChanged?.(); onRefresh?.() },
    onError: (e: Error) => message.error(e.message),
  })
  // 就地修正参数（密钥名/模型等）
  const patchInput = useMutation({
    mutationFn: (v: { runId: string; input: Record<string, unknown> }) =>
      api.patchRunInput(v.runId, v.input),
    onSuccess: () => { message.success('已更新参数，点「继续」或「重跑」生效'); setEditRun(null); invalidateSelf(); onRefresh?.() },
    onError: (e: Error) => message.error(e.message),
  })
  const openEdit = (run: RunSummary) => {
    const { file: _file, ...rest } = (run.input ?? {}) as Record<string, unknown>
    setEditText(JSON.stringify(rest, null, 2))
    setEditRun(run)
  }
  const submitEdit = () => {
    if (!editRun) return
    try {
      patchInput.mutate({ runId: editRun.id, input: JSON.parse(editText) as Record<string, unknown> })
    } catch {
      message.error('参数不是合法 JSON')
    }
  }

  // 批次失败项一键重跑：原 run 留档、新 run 继承批次；已翻内容命中字典缓存不重复计费
  const rerunBatch = useMutation({
    mutationFn: (runIds: string[]) => api.rerunRuns({ run_ids: runIds }),
    onSuccess: (r) => {
      message.success(`已提交 ${r.count} 条重跑${r.skipped.length ? `，跳过 ${r.skipped.length} 条` : ''}`)
      setPicked([])
      invalidateSelf(); onChanged?.(); onRefresh?.()
      // 复查：仍失败/暂停的直接报原因，不用自己翻列表（重跑常在几秒内就出结果）
      window.setTimeout(() => {
        void rerunQ.refetch().then((after) => {
          const back = after.data?.files ?? []
          if (r.count > 0 && back.length > 0) {
            const first = back[0]
            message.warning(`仍有 ${back.length} 个文件未成功：${first.name} —— ${first.error ?? '见任务详情'}`, 8)
          }
          invalidateSelf()
        })
      }, 2500)
    },
    onError: (e: Error) => message.error(e.message),
  })

  /** 面板自身的查询失效：批次全量列表 / 待重跑清单 / 占用（父级查询由 onChanged/onRefresh 负责）。 */
  const invalidateSelf = () => {
    void qc.invalidateQueries({ queryKey: ['provider', pid, 'batch-runs'] })
    void qc.invalidateQueries({ queryKey: ['provider', pid, 'rerunnable'] })
    void qc.invalidateQueries({ queryKey: ['provider', pid, 'run-usage'] })
  }

  const refreshAll = () => {
    invalidateSelf()
    onChanged?.()
    onRefresh?.()
  }

  /** 双选项删除：保留文件 / 连产物一起删（附所选占用大小做预演）。 */
  async function askDelete(pickedIds: string[]) {
    // 「一个文件一行」：删除作用于该文件的**全部 run**（否则会留下历史失败记录）
    const ids = [...new Set(pickedIds.flatMap((id) => allIdsOf.get(id) ?? [id]))]
    const mode = await confirm({
      title: '删除',
      options: deleteRunOptions({
        keep: '删除任务', keepDesc: '产物文件保留在服务器（可再次下载）',
        purge: '全部删除', purgeDesc: '连同该任务的全部产物、同文件的全部失败尝试一并删除（不可恢复）',
      }),
    })
    const params = deleteRunParams(mode ?? null)
    if (!params) return
    removedFailed = 0
    sharedDbs = []
    const out = await runPool(ids, (id) => del.mutateAsync({ id, purgeFiles: params.purgeFiles })
      .then(() => ({ id, ok: true as const }))
      .catch((e: Error) => ({ id, ok: false as const, error: e.message })), DELETE_CONCURRENCY)
    const bad = out.filter((o) => !o.ok)
    if (bad.length) message.warning(`删除完成：失败 ${bad.length} 个（${bad[0].error}）`)
    else {
      const extra = params.purgeFiles && removedFailed > 0 ? `，连带清理 ${removedFailed} 条失败尝试` : ''
      message.success(`已删除 ${out.length} 个任务${params.purgeFiles ? '（含产物）' : '（保留文件）'}${extra}`)
    }
    // AP-D：结果库因被其它任务（多为同文件在别批次的尝试）引用而未删除 → 明确告知，不再静默
    if (sharedDbs.length) {
      message.warning(
        `有 ${sharedDbs.length} 个结果库因仍被其它任务引用而保留：${sharedDbs.map((p) => p.split('/').pop()).join('、')}。`
        + '可到「结果库」面板删除（会提示引用数，可强制删除）。', 8)
    }
    setPicked([])
    refreshAll()
    // AD2：含产物删除会清 OCR 结果库（AD1）——数据面列表即时失效，无需 F5
    if (params.purgeFiles) {
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'data-dbs'] })
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'ocr-records'] })
    }
  }

  /** AH1：清除失败项（逐文件删全部尝试+产物+库；结束后刷新清单与结果库面板）。 */
  async function purgeFailed(ids: string[]) {
    if (!ids.length) return
    setFailBusy(true)
    try {
      const out = await runPool(ids, (id) => del.mutateAsync({ id, purgeFiles: true })
        .then(() => ({ id, ok: true as const }))
        .catch((e: Error) => ({ id, ok: false as const, error: e.message })), DELETE_CONCURRENCY)
      const bad = out.filter((o) => !o.ok)
      if (bad.length) message.warning(`清除完成：失败 ${bad.length} 个（${bad[0].error}）`)
      else message.success(`已清除 ${out.length} 个失败项（含产物）`)
      refreshAll()
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'data-dbs'] })
      void qc.invalidateQueries({ queryKey: ['provider', pid, 'ocr-records'] })
    } finally {
      setFailBusy(false)
    }
  }

  async function packRuns(ids: string[]) {
    setPacking(true)
    try {
      const pkg = await api.packageRuns(ids, 'final')
      if (pkg.skipped?.length) {
        message.warning(`已打包 ${pkg.runs} 个任务 / ${pkg.count} 个产物；${pkg.skipped.length} 个未打包：${pkg.skipped[0].reason}`)
      } else {
        message.success(`已打包 ${pkg.runs} 个任务 / ${pkg.count} 个产物（${humanSize(pkg.size)}）`)
      }
      triggerDownload(api.downloadUrl(pkg.path))
    } catch (e) { message.error((e as Error).message) } finally { setPacking(false) }
  }

  /** 批次导出：按上传清单还原**原目录结构**（根目录加 _中文），未处理的放原文件。 */
  async function packBatch(batchId: string) {
    setPacking(true)
    try {
      const pkg = await api.packageBatch(batchId)
      const extra = pkg.passthrough?.length ? `；未处理 ${pkg.passthrough.length} 个已放原文件` : ''
      message.success(`已按原目录结构打包 ${pkg.count} 个文件（${humanSize(pkg.size)}）${extra}`)
      triggerDownload(api.downloadUrl(pkg.path))
    } catch (e) { message.error((e as Error).message) } finally { setPacking(false) }
  }

  const columns = [
    {
      title: '状态', key: 'status', width: 140,
      render: (_: unknown, r: RunSummary) => {
        const bad = r.status === 'failed' || r.status === 'interrupted'
        // 失败降级：原 run 标「已降级」（不是死失败），降级 run 标「自动降级」（指向原 run）
        const fellBack = bad && Boolean(r.error?.fallback_flow)
        const tag = (
          <Tag color={fellBack ? 'gold' : r.status === 'succeeded' ? 'green'
            : bad ? 'red' : r.status === 'paused' ? 'orange' : 'blue'}>
            {fellBack ? '已降级' : STATUS_LABEL[r.status] ?? r.status}
          </Tag>
        )
        const why = fellBack
          ? `${r.error?.message ?? ''}`
          : r.fallback_of ? '由原任务能力不可用自动降级而来' : r.error?.message
        // X4：succeeded 但有失败页（未达熔断线）——徽标可见，操作列提供「重试失败页」
        const fp = r.summary?.failed_pages ?? 0
        const zero = r.status === 'succeeded' && r.summary?.records_count === 0
        const wrapped = (
          <Space size={4}>
            {tag}
            {fp > 0 && (
              <Tooltip title={`识别有 ${fp} 页失败（未达熔断线所以任务完成）；点操作里的「重试失败页」只补失败页，已成功页走缓存不重复计费`}>
                <Tag color="orange">部分失败（{fp} 页）</Tag>
              </Tooltip>
            )}
            {zero && (
              <Tooltip title="识别完成但结果库 0 条记录：检查模版字段/提示词与该文档是否匹配">
                <Tag color="orange">0 记录</Tag>
              </Tooltip>
            )}
            {r.status === 'running' && r.summary?.latest_note && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.summary.latest_note}</Typography.Text>
            )}
          </Space>
        )
        return why ? <Tooltip title={why}>{wrapped}</Tooltip> : wrapped
      },
    },
    {
      title: '文件', key: 'file', ellipsis: true,
      render: (_: unknown, r: RunSummary) => {
        const name = String(r.input?.file ?? r.input?.name ?? r.id).split('/').pop()
        return <Typography.Text ellipsis style={{ maxWidth: 260 }}>{name}</Typography.Text>
      },
    },
    ...(flowLabels && Object.keys(flowLabels).length > 0
      ? [{
        title: '流', key: 'flow', width: 170, ellipsis: true,
        render: (_: unknown, r: RunSummary) => flowLabels?.[r.pipeline_id ?? ''] ?? r.pipeline_id,
      }]
      : []),
    ...(batches.length > 0
      ? [{
        title: '批次', key: 'batch', width: 130, ellipsis: true,
        render: (_: unknown, r: RunSummary) => (r.batch_id ? nameOf(r.batch_id) : '—'),
      }]
      : []),
    {
      title: '进度', key: 'progress', width: 76,
      render: (_: unknown, r: RunSummary) => {
        const done = r.summary?.steps_done ?? 0
        const total = r.summary?.steps_total ?? 0
        const tries = attemptsOf.get(r.id) ?? 1
        // AF2：终态不画进度环（失败/中断显示徽标而非误导性的 0% 活跃环）
        if (r.status === 'paused')
          return <Tag color="warning">已暂停 · 可继续</Tag>
        if (r.status === 'interrupted')
          return <Tag color="orange">已中断 · 可重跑</Tag>
        if (r.status === 'cancelled')
          return <Tag>已取消</Tag>
        if (r.status === 'failed' || r.status === 'failed_review')
          return <Tooltip title={r.error?.message || '任务失败，可重跑失败项'}>
            <Tag color="error">失败{total ? `（${done}/${total}）` : ''}</Tag>
          </Tooltip>
        return (
          <ProgressRing
            percent={total ? Math.round((done / total) * 100) : 0}
            center={tries}
            status={RUNNING.has(r.status) ? 'active' : 'success'}
            title={`进度 ${done}/${total} · 尝试 ${tries} 次${tries > 1 ? '（点击查看历史）' : ''}`}
            onClick={tries > 1 ? () => setShowHistory(true) : undefined}
          />
        )
      },
    },
    ...(showStats
      ? [{
        title: '统计', key: 'stats', width: 180,
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
      }]
      : []),
    {
      title: '创建时间', key: 'created', width: 160,
      render: (_: unknown, r: RunSummary) => (r.created_at ? r.created_at.replace('T', ' ').slice(0, 19) : '—'),
    },
    {
      title: '操作', key: 'actions', width: 96, fixed: 'right' as const,
      render: (_: unknown, r: RunSummary) => (
        <Space size={4}>
          {onOpenRun && (
            <Tooltip title="详情"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onOpenRun(r.id)} /></Tooltip>
          )}
          {r.status === 'paused' && (
            <Tooltip title="继续"><Button size="small" type="text" icon={<PlayCircleOutlined />} loading={resume.isPending}
              onClick={() => resume.mutate(r.id)} /></Tooltip>
          )}
          {!RUNNING.has(r.status) && (
            <Tooltip title="替换原件：把新文件传上来替换原件（如旧版 .doc 另存为 .docx），随后点「继续」">
              <Button size="small" type="text" icon={<UploadOutlined />}
                onClick={() => { replaceTarget.current = r.id; replaceInput.current?.click() }} />
            </Tooltip>
          )}
          {!RUNNING.has(r.status) && (
            <Tooltip title="改参数：就地修改密钥名/模型等参数（JSON），随后点「继续」或「重跑」">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {onRerun && (() => {
            // X4：部分页失败的成功任务 → 「重试失败页」（重放进原流，已成功页命中缓存）
            const partial = r.status === 'succeeded' && (r.summary?.failed_pages ?? 0) > 0
            if (partial) {
              return (
                <Tooltip title="重试失败页：只补失败页，已成功页走页级缓存不重复计费">
                  <Button size="small" type="text" icon={<RedoOutlined />} onClick={() => onRerun(r.id)} />
                </Tooltip>
              )
            }
            // 该文件已有成功译文（不在待重跑清单里）→ 无需重跑，置灰
            const file = String(r.input?.file ?? '')
            const done = RERUNNABLE.has(r.status) && file !== '' && doneFiles.has(file)
            return (
              <Tooltip title={done ? '该文件已有成功译文，无需重跑' : '重跑'}>
                <Button size="small" type="text" icon={<RedoOutlined />} disabled={done}
                  onClick={() => onRerun(r.id)} />
              </Tooltip>
            )
          })()}
          {(onAbort && RUNNING.has(r.status))
            ? <Tooltip title="中止"><Button size="small" type="text" danger onClick={() => onAbort(r.id)}><PauseOutlined /></Button></Tooltip>
            : <Tooltip title="删除"><Button size="small" type="text" danger onClick={() => askDelete([r.id])}><DeleteOutlined /></Button></Tooltip>}
        </Space>
      ),
    },
  ]

  return (
    <Card size="small" title={`任务（${showHistory ? shown.length : groups.length} 个文件${showHistory ? ` / ${shown.length} 条尝试` : ''}）`}
      extra={(
        <Space>
          {batches.length > 0 && (
            <Select size="small" allowClear placeholder="按批次筛选" style={{ width: 'min(150px, 40vw)' }}
              value={batchFilter} onChange={setBatchFilter}
              options={batches.map((b) => ({ value: b.id, label: `${b.label}（${b.n}）` }))} />
          )}
          <Tooltip title="同一文件只显示最新结果（成功优先）；打开可看每次尝试的记录（含失败与自动降级）">
            <Button size="small" type={showHistory ? 'primary' : 'default'} ghost
              onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? '只看最新' : `历史尝试（${shown.length} 条）`}
            </Button>
          </Tooltip>
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
        </Space>
      )}>
      {(picked.length > 0 || batchFilter || rerunCount > 0) && (
        <Space style={{ marginBottom: 8 }} wrap>
          {picked.length > 0 && (
            <>
              <Typography.Text type="secondary">
                已选 {picked.length}
                {usage.data ? ` · ${humanSize(usage.data.total.bytes ?? 0)}` : ''}
              </Typography.Text>
              <Button size="small" icon={<DownloadOutlined />} loading={packing}
                onClick={() => packRuns(picked)}>打包下载</Button>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => askDelete(picked)}>批量删除</Button>
            </>
          )}
          {batchFilter && (
            <Button size="small" type="primary" ghost icon={<DownloadOutlined />} loading={packing}
              onClick={() => packBatch(batchFilter)}>导出本批次（原目录结构）</Button>
          )}
          {rerunCount > 0 && (
            <Popconfirm
              title={`重跑 ${rerunCount} 个文件？`}
              description="只含「从未成功过」的文件（已成功的即使后来重跑失败也不重复跑）；原任务留档，已翻内容命中全局字典缓存不重复计费"
              onConfirm={() => rerunBatch.mutate(rerunIds)}>
              <Button size="small" icon={<RedoOutlined />} loading={rerunBatch.isPending}>
                重跑失败项（{rerunCount}）
              </Button>
            </Popconfirm>
          )}
          {rerunCount > 0 && (
            <Button size="small" danger ghost icon={<DeleteOutlined />} onClick={() => setFailOpen(true)}>
              清除失败项（{rerunCount}）
            </Button>
          )}
        </Space>
      )}
      <input ref={replaceInput} type="file" style={{ display: 'none' }} onChange={(e) => {
        const f = e.target.files?.[0]
        const runId = replaceTarget.current
        if (f && runId) replaceFile.mutate({ runId, file: f })
        e.target.value = ''
      }} />
      <Modal title={`失败项管理（${rerunQ.data?.files.length ?? 0} 个文件，含其它批次残留）`}
        open={failOpen} footer={null} onCancel={() => setFailOpen(false)} width={680}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          「从未成功过」且最新一次是失败/中断的文件（全批次口径）。删除将连带该文件的全部尝试与产物
          （含 OCR 结果库）；结果库若因此不再被引用即可单独删除。
        </Typography.Paragraph>
        <Table size="small" rowKey="run_id" dataSource={rerunQ.data?.files ?? []}
          pagination={{ pageSize: 10 }} loading={failBusy}>
          <Table.Column title="文件" dataIndex="name" ellipsis
            render={(_: unknown, r: { run_id: string; error?: string }) => (
              <Tooltip title={r.error || ''}><span>{String(_)}</span></Tooltip>
            )} />
          <Table.Column title="状态" dataIndex="status" width={90}
            render={(_: unknown) => <Tag color="orange">{String(_)}</Tag>} />
          <Table.Column title="操作" key="op" width={90}
            render={(_: unknown, r: { run_id: string }) => (
              <Popconfirm title="删除该文件的全部尝试（含产物）？" onConfirm={() => purgeFailed([r.run_id])}>
                <Button size="small" danger loading={failBusy}>删除</Button>
              </Popconfirm>
            )} />
        </Table>
        <Space style={{ marginTop: 12 }}>
          <Button danger type="primary" loading={failBusy}
            onClick={() => purgeFailed(rerunQ.data?.run_ids ?? [])}>
            全部清除（含产物）
          </Button>
          <Button onClick={() => setFailOpen(false)}>关闭</Button>
        </Space>
      </Modal>
      <Modal title="修改任务参数" open={Boolean(editRun)}
        okText="保存" cancelText="取消" confirmLoading={patchInput.isPending}
        onOk={submitEdit} onCancel={() => setEditRun(null)} width={520}>
        <Input.TextArea rows={10} value={editText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Modal>
      <div ref={tableBox as React.Ref<HTMLDivElement>}>
      <Table
        rowKey="id" size="small" loading={loading} dataSource={rows}
        pagination={{ size: 'small', pageSize, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: emptyText ?? '暂无任务' }}
        rowSelection={{ selectedRowKeys: picked, onChange: (keys: React.Key[]) => setPicked(keys as string[]) }}
        columns={columns}
      />
      </div>
    </Card>
  )
}
