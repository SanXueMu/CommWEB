import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Input, Modal, Popconfirm, Progress, Select, Space, Table, Tag, Tooltip, Typography,
  message,
} from 'antd'
import {
  DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, RedoOutlined, ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { apiFor } from '@/api/client'
import type { RunSummary } from '@/api/types'
import { humanSize } from '@/lib/size'
import { triggerDownload } from '@/lib/download'
import { runPool } from '@/protocol/pool'
import { deleteRunOptions, deleteRunParams } from '@/protocol/confirm'
import { useConfirm } from '@/components/ConfirmDialog'

const RUNNING = new Set(['running', 'queued'])
/** 可批量重跑的失败态（与服务端 PipelineService.RERUNNABLE_STATUSES 对齐；paused 走「继续」） */
const RERUNNABLE = new Set(['failed', 'failed_review', 'cancelled', 'interrupted'])
/** 删除并发：4（防拖垮 command-api） */
const DELETE_CONCURRENCY = 4

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '进行中', paused: '已暂停（待处理）',
  succeeded: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断',
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
  const [batchFilter, setBatchFilter] = useState<string>()
  const [packing, setPacking] = useState(false)
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
  })
  const shown = useMemo(
    () => (batchFilter ? (batchRuns.data?.runs ?? runs.filter((r) => r.batch_id === batchFilter))
                       : runs),
    [runs, batchFilter, batchRuns.data])

  const batchIds = useMemo(
    () => [...new Set(runs.map((r) => r.batch_id).filter((x): x is string => !!x))],
    [runs])

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
  /** 仍「从未成功过」的文件（服务端口径）：不在其中的失败行 = 已有成功译文，重跑按钮置灰。 */
  const pendingFiles = useMemo(
    () => new Set((rerunQ.data?.files ?? []).map((f) => f.file)),
    [rerunQ.data])
  // 刷新后本地记不住批次根目录名 → 从服务端清单补（只读，仅在缺名时请求）
  const missingBatchIds = useMemo(
    () => batchIds.filter((id) => !batchNames?.[id]).slice(0, 20),
    [batchIds, batchNames])
  const remoteNames = useQuery({
    queryKey: ['provider', pid, 'batch-names', missingBatchIds.join(',')],
    enabled: missingBatchIds.length > 0,
    queryFn: () => api.batchNames(missingBatchIds),
  })
  const labelOf = (id: string) => batchNames?.[id] ?? remoteNames.data?.names?.[id] ?? id
  const batches = useMemo(() => {
    const seen = new Map<string, number>()
    for (const r of runs) if (r.batch_id) seen.set(r.batch_id, (seen.get(r.batch_id) ?? 0) + 1)
    return [...seen.entries()].map(([id, n]) => ({ id, n, label: labelOf(id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, batchNames, remoteNames.data])

  const usage = useQuery({
    queryKey: ['provider', pid, 'run-usage', picked.join(',')],
    enabled: picked.length > 0,
    queryFn: () => api.usageRuns(picked),
    staleTime: 5_000,
  })

  const resume = useMutation({
    mutationFn: (runId: string) => api.resumeRun(runId),
    onSuccess: () => { message.success('已继续'); onChanged?.(); onRefresh?.() },
    onError: (e: Error) => message.error(e.message),
  })

  const del = useMutation({
    mutationFn: (v: { id: string; purgeFiles: boolean }) => api.deleteRun(v.id, v.purgeFiles),
  })

  // 替换原件：把新文件写进同批次目录 + 更新清单 + 更新该 run 的 input.file
  const replaceFile = useMutation({
    mutationFn: (v: { runId: string; file: File }) => api.replaceRunFile(v.runId, v.file),
    onSuccess: () => { message.success('已替换原件，点「继续」或「重跑」即可'); onChanged?.(); onRefresh?.() },
    onError: (e: Error) => message.error(e.message),
  })
  // 就地修正参数（密钥名/模型等）
  const patchInput = useMutation({
    mutationFn: (v: { runId: string; input: Record<string, unknown> }) =>
      api.patchRunInput(v.runId, v.input),
    onSuccess: () => { message.success('已更新参数，点「继续」或「重跑」生效'); setEditRun(null); onRefresh?.() },
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
      message.success(`已重跑 ${r.count} 条${r.skipped.length ? `，跳过 ${r.skipped.length} 条` : ''}`)
      setPicked([])
      onChanged?.(); onRefresh?.()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: ['provider', pid, 'run-usage'] })
    onChanged?.()
    onRefresh?.()
  }

  /** 双选项删除：保留文件 / 连产物一起删（附所选占用大小做预演）。 */
  async function askDelete(ids: string[]) {
    const mode = await confirm({
      title: `删除 ${ids.length} 个任务？`,
      content: usage.data
        ? `所选任务产物合计 ${humanSize(usage.data.total.bytes ?? 0)}（选择「含产物」才会释放）。`
        : undefined,
      options: deleteRunOptions({
        keep: '删除任务，保留文件', keepDesc: '产物文件保留在服务器（可再次下载）',
        purge: '删除任务，并删除产物文件', purgeDesc: '连同该任务的全部产物（含中间产物）一起删除，不可恢复',
      }),
    })
    const params = deleteRunParams(mode ?? null)
    if (!params) return
    const out = await runPool(ids, (id) => del.mutateAsync({ id, purgeFiles: params.purgeFiles })
      .then(() => ({ id, ok: true as const }))
      .catch((e: Error) => ({ id, ok: false as const, error: e.message })), DELETE_CONCURRENCY)
    const bad = out.filter((o) => !o.ok)
    if (bad.length) message.warning(`删除完成：失败 ${bad.length} 个（${bad[0].error}）`)
    else message.success(`已删除 ${out.length} 个任务${params.purgeFiles ? '（含产物）' : '（保留文件）'}`)
    setPicked([])
    refreshAll()
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
        return why ? <Tooltip title={why}>{tag}</Tooltip> : tag
      },
    },
    {
      title: '文件', key: 'file', ellipsis: true,
      render: (_: unknown, r: RunSummary) => String(r.input?.file ?? r.input?.name ?? r.id).split('/').pop(),
    },
    {
      title: '流', key: 'flow', width: 170, ellipsis: true,
      render: (_: unknown, r: RunSummary) => flowLabels?.[r.pipeline_id ?? ''] ?? r.pipeline_id,
    },
    ...(batches.length > 0
      ? [{
        title: '批次', key: 'batch', width: 130, ellipsis: true,
        render: (_: unknown, r: RunSummary) => (r.batch_id ? batchNames?.[r.batch_id] ?? r.batch_id : '—'),
      }]
      : []),
    {
      title: '进度', key: 'progress', width: 130,
      render: (_: unknown, r: RunSummary) => {
        const done = r.summary?.steps_done ?? 0
        const total = r.summary?.steps_total ?? 0
        return (
          <Progress percent={total ? Math.round((done / total) * 100) : 0} size="small"
            status={RUNNING.has(r.status) ? 'active' : 'normal'}
            format={() => (total ? `${done}/${total}` : '')} />
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
      title: '操作', key: 'actions', width: 210, fixed: 'right' as const,
      render: (_: unknown, r: RunSummary) => (
        <Space size={4}>
          {onOpenRun && (
            <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => onOpenRun(r.id)}>详情</Button>
          )}
          {r.status === 'paused' && (
            <Button size="small" type="link" icon={<RedoOutlined />} loading={resume.isPending}
              onClick={() => resume.mutate(r.id)}>继续</Button>
          )}
          {!RUNNING.has(r.status) && (
            <Tooltip title="把新文件传上来替换原件（如旧版 .doc 另存为 .docx），随后点「继续」">
              <Button size="small" type="link" icon={<UploadOutlined />}
                onClick={() => { replaceTarget.current = r.id; replaceInput.current?.click() }}>
                替换原件
              </Button>
            </Tooltip>
          )}
          {!RUNNING.has(r.status) && (
            <Tooltip title="就地修改密钥名/模型等参数（JSON），随后点「继续」或「重跑」">
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                改参数
              </Button>
            </Tooltip>
          )}
          {onRerun && (() => {
            // 该文件已有成功译文（不在待重跑清单里）→ 无需重跑，置灰
            const file = String(r.input?.file ?? '')
            const done = RERUNNABLE.has(r.status) && file !== '' && !pendingFiles.has(file)
            return (
              <Tooltip title={done ? '该文件已有成功译文，无需重跑' : undefined}>
                <Button size="small" type="link" disabled={done}
                  onClick={() => onRerun(r.id)}>重跑</Button>
              </Tooltip>
            )
          })()}
          {(onAbort && RUNNING.has(r.status))
            ? <Button size="small" type="link" danger onClick={() => onAbort(r.id)}>中止</Button>
            : (
              <Popconfirm title="删除该任务？" onConfirm={() => askDelete([r.id])}>
                <Button size="small" type="link" danger>删除</Button>
              </Popconfirm>
            )}
        </Space>
      ),
    },
  ]

  return (
    <Card size="small" title={`任务（${shown.length}）`}
      extra={(
        <Space>
          {batches.length > 0 && (
            <Select size="small" allowClear placeholder="按批次筛选" style={{ width: 150 }}
              value={batchFilter} onChange={setBatchFilter}
              options={batches.map((b) => ({ value: b.id, label: `${b.label}（${b.n}）` }))} />
          )}
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
        </Space>
      )}
      <input ref={replaceInput} type="file" style={{ display: 'none' }} onChange={(e) => {
        const f = e.target.files?.[0]
        const runId = replaceTarget.current
        if (f && runId) replaceFile.mutate({ runId, file: f })
        e.target.value = ''
      }} />
      <Modal title={`修改任务参数（${editRun?.id ?? ''}）`} open={Boolean(editRun)}
        okText="保存" cancelText="取消" confirmLoading={patchInput.isPending}
        onOk={submitEdit} onCancel={() => setEditRun(null)} width={560}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          只改参数（密钥名/模型/术语等）；换文件请用「替换原件」。保存后点「继续」或「重跑」生效。
        </Typography.Paragraph>
        <Input.TextArea rows={10} value={editText} onChange={(e) => setEditText(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Modal>
      <Table<RunSummary>
        rowKey="id" size="small" loading={loading} dataSource={shown}
        pagination={{ size: 'small', pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: emptyText ?? '暂无任务' }}
        rowSelection={{ selectedRowKeys: picked, onChange: (keys) => setPicked(keys as string[]) }}
        columns={columns}
      />
    </Card>
  )
}
