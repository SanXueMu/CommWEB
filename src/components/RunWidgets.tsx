/**
 * 任务展示共享组件（X6 抽取）：
 *  - TaskFloat   右下角「进行中」浮窗
 *  - RunDetail   任务详情抽屉内容（状态/产物/用量/日志）
 *  - UsagePanel  Token 用量面板（按模型：调用/输入/输出）
 *  - aggregate   run 全量任务的用量聚合
 * 翻译工作台与 OCR 工作台共用同一套（此前两份实现易漂移）。
 * 文案为协议级通用词（非业务词），两工作台一致。
 */
import { Badge, Card, Descriptions, Flex, Progress, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DownloadButton } from '@/components/DownloadButton'
import { StatusBadge } from '@/components/StatusBadge'
import type { PipelineRun, RunEvent, RunSummary } from '@/api/types'

export function baseName(p?: unknown): string {
  return String(p ?? '').split('/').pop() ?? ''
}

/** AF2：仍在推进的状态才画活跃进度条（终态一律徽标/文案，不画 0% 条） */
const RUNNING_LIVE = new Set(['running', 'queued'])

export function aggregate(run?: PipelineRun) {
  const byModel: Record<string, { calls: number; prompt_tokens: number; completion_tokens: number }> = {}
  let calls = 0, cache = 0, review = 0, ok = 0, overflow = 0
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
    overflow += Number(out.overflow ?? 0)
    const st = out.statuses as string[] | undefined
    if (Array.isArray(st)) ok += st.filter((s) => s === 'ok').length
    if (typeof out.file === 'string' && out.file) artifacts.push({ name: baseName(out.file), path: out.file })
    if (typeof out.path === 'string' && out.path) artifacts.push({ name: String(out.name ?? baseName(out.path)), path: out.path })
    if (typeof out.db === 'string' && out.db) artifacts.push({ name: baseName(out.db), path: out.db })
    if (typeof out.raw_file === 'string' && out.raw_file) artifacts.push({ name: `${baseName(out.raw_file)}（模型原文）`, path: out.raw_file })
  }
  return { byModel, calls, cache, review, ok, overflow, artifacts }
}

/** 任务浮窗：右下角常驻，显示进行中的作业（title 传入「翻译进行中/识别进行中」）。 */
export function TaskFloat({ runs, onOpen, title }: { runs: RunSummary[]; onOpen: (id: string) => void; title: string }) {
  if (runs.length === 0) return null
  return (
    <div style={{ position: 'fixed', right: 24, bottom: 24, width: 300, zIndex: 1000 }}>
      <Card size="small" title={`${title}（${runs.length}）`} styles={{ body: { padding: 8, maxHeight: 260, overflow: 'auto' } }}>
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
              {RUNNING_LIVE.has(r.status) && (
                <Progress percent={total ? Math.round((done / total) * 100) : undefined} size="small" status="active" />
              )}
              {!RUNNING_LIVE.has(r.status) && (r.status === 'failed' || r.status === 'failed_review') && (
                <Typography.Text type="danger" ellipsis style={{ fontSize: 12, display: 'block' }}>
                  {r.error?.message || '任务失败，可重跑失败项'}
                </Typography.Text>
              )}
              {!RUNNING_LIVE.has(r.status) && r.status === 'paused' && (
                <Typography.Text type="warning" style={{ fontSize: 12 }}>已暂停 · 可继续</Typography.Text>
              )}
              {s?.latest_note && (
                <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block' }}>{s.latest_note}</Typography.Text>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

/** 任务详情（抽屉内容）：状态 / 产物 / 用量 / 运行日志。 */
/** AI3：审计事件 → 人话文案（原始 JSON 收进 Tooltip，审计不丢） */
const KIND_LABELS: Record<string, string> = {
  created: '任务创建', step_queued: '步骤排队', step_started: '步骤开始',
  step_completed: '步骤完成', step_failed: '步骤失败', step_cancelled: '步骤取消',
  step_skipped: '步骤跳过', step_paused: '步骤暂停', pause_requested: '请求暂停',
  resume_requested: '请求继续', resumed: '已继续', abort_requested: '请求中止',
  run_aborted: '任务中止', rerun_requested: '请求重跑', override_applied: '人工覆盖',
  run_recovered: '进程重启中断收口', artifacts_purged: '决定性错误自动清理产物',
  file_replaced: '替换任务原件', input_updated: '修正任务参数',
  subrun_created: '子任务创建', subrun_finished: '子任务完成',
}

function eventText(e: RunEvent, toolNames: Record<string, string>,
                   skipped: { step_index?: number; reason: string }[]): string {
  const d = (e.detail ?? {}) as Record<string, unknown>
  const tool = (tid: unknown) => toolNames[String(tid)] ?? String(tid ?? '')
  switch (e.kind) {
    case 'created': return `任务创建 · ${String(d.pipeline_id ?? '')}`
    case 'step_queued': case 'step_started': case 'step_completed': case 'step_failed':
      return `${KIND_LABELS[e.kind]} · ${tool(d.tool)}`
    case 'step_skipped': {
      const reason = skipped.find((sk) => sk.step_index === d.step_index)?.reason
      return `步骤跳过 · ${reason ?? '条件不满足'}`
    }
    case 'progress': return String(d.message ?? '')
    default: return KIND_LABELS[e.kind] ?? e.kind
  }
}

export function RunDetail({ run, logs, toolNames }: {
  run: PipelineRun; logs: RunEvent[]; toolNames?: Record<string, string>
}) {
  const usage = aggregate(run)
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="状态"><StatusBadge value={run.run.status} /></Descriptions.Item>
        <Descriptions.Item label="文件">{baseName(run.run.input?.file)}</Descriptions.Item>
        <Descriptions.Item label="流">{run.run.pipeline_id}</Descriptions.Item>
        {run.summary && (run.summary.steps_total ?? 0) > 0 && (
          <Descriptions.Item label="进度">
            <Space size={4} wrap>
              <span>{run.summary.steps_done ?? 0}/{run.summary.steps_total}</span>
              {run.summary.latest_note && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {run.summary.latest_note}
                </Typography.Text>
              )}
              {(run.summary.steps_skipped ?? []).map((sk) => (
                <Tooltip key={sk.step_index} title={sk.reason}>
                  <Tag>第 {(sk.step_index ?? 0) + 1} 步跳过</Tag>
                </Tooltip>
              ))}
              {run.run.status === 'succeeded' && run.summary.records_count === 0 && (
                <Tag color="orange">0 记录</Tag>
              )}
            </Space>
          </Descriptions.Item>
        )}
        {run.run.error && <Descriptions.Item label="错误">
          <Typography.Text type="danger">{(run.run.error as { message?: string }).message}</Typography.Text>
        </Descriptions.Item>}
      </Descriptions>
      {usage.artifacts.length > 0 && (
        <Card size="small" title="产物">
          <Space direction="vertical">
            {usage.artifacts.map((a) => (
              <Space key={a.path}>
                {run.missing_artifacts?.includes(a.path)
                  ? <Tag color="default">已删除</Tag>
                  : null}
                <DownloadButton path={a.path} label={a.name}
                  disabled={run.missing_artifacts?.includes(a.path)} />
              </Space>
            ))}
          </Space>
        </Card>
      )}
      <UsagePanel usage={usage} />
      <Card size="small" title="运行日志" styles={{ body: { maxHeight: 240, overflow: 'auto', background: 'rgba(0,0,0,0.03)' } }}>
        {(logs ?? []).length === 0 ? <Typography.Text type="secondary">暂无日志</Typography.Text> : logs.map((e) => (
          <div key={e.id} style={{ fontSize: 12 }}>
            <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>
              {(e.created_at ?? '').replace('T', ' ').slice(11, 19)}
            </Typography.Text>{' '}
            <Badge status={e.kind === 'step_failed' || e.kind === 'run_aborted' ? 'error'
              : e.kind === 'progress' ? 'default' : 'processing'} />{' '}
            <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.detail ?? {}, null, 1)}</span>}>
              <span style={{ cursor: 'help' }}>
                {eventText(e, toolNames ?? {}, run.summary?.steps_skipped ?? [])}
              </span>
            </Tooltip>
          </div>
        ))}
      </Card>
    </Space>
  )
}

/** Token 用量面板（按模型：调用/输入/输出）。 */
export function UsagePanel({ usage }: { usage: ReturnType<typeof aggregate> }) {
  const models = Object.entries(usage.byModel)
  if (models.length === 0 && usage.calls === 0) return null
  return (
    <Card size="small" title="Token 用量" style={{ marginTop: 8 }}>
      <Space size={16} wrap style={{ marginBottom: 8 }}>
        <Tag color="green">✓ 成功 {usage.ok}</Tag>
        <Tag color="blue">⚡ 缓存 {usage.cache}</Tag>
        <Tag color="orange">⚠ 待审 {usage.review}</Tag>
        {usage.overflow > 0 && <Tag color="red">溢出 {usage.overflow}</Tag>}
        {usage.calls > 0 && <Typography.Text type="secondary">调用 {usage.calls}</Typography.Text>}
      </Space>
      {models.length > 0 && (
        <Table
          size="small" rowKey={(r) => r.model} pagination={false}
          dataSource={models.map(([m, v]) => ({ model: m, ...v }))}
          columns={[
            { title: '模型', dataIndex: 'model' },
            { title: '调用', dataIndex: 'calls', width: 90 },
            { title: '输入 tok', dataIndex: 'prompt_tokens', width: 120 },
            { title: '输出 tok', dataIndex: 'completion_tokens', width: 120 },
          ]}
        />
      )}
    </Card>
  )
}
