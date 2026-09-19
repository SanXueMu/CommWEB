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
              <Progress percent={total ? Math.round((done / total) * 100) : undefined} size="small" status="active" />
            </div>
          )
        })}
      </Card>
    </div>
  )
}

/** 任务详情（抽屉内容）：状态 / 产物 / 用量 / 运行日志。 */
export function RunDetail({ run, logs }: { run: PipelineRun; logs: RunEvent[] }) {
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
                <DownloadButton path={a.path} label={a.name} />
              </Space>
            ))}
          </Space>
        </Card>
      )}
      <UsagePanel usage={usage} />
      <Card size="small" title="运行日志" styles={{ body: { maxHeight: 240, overflow: 'auto', background: 'rgba(0,0,0,0.03)' } }}>
        {(logs ?? []).length === 0 ? <Typography.Text type="secondary">暂无日志</Typography.Text> : logs.map((e) => (
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
