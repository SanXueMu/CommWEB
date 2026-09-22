/** 审计时间线：run_events 全程留痕（工单的审批记录）。 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { RUN_EVENT_LABELS } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { Card } from '@/ui'

function detailSummary(detail: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(detail ?? {})) {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    parts.push(`${key}=${text.length > 60 ? `${text.slice(0, 60)}…` : text}`)
  }
  return parts.join(' ')
}

export function AuditTimeline({ runId }: { runId: string }) {
  const pid = useActivePid()
  const { data, isLoading } = useQuery({
    queryKey: ['provider', pid, 'runEvents', runId],
    queryFn: () => api.listRunEvents(runId, 100),
  })

  return (
    <Card style={{ marginTop: 16 }}>
      <Card.Header><Card.Title>审计轨迹</Card.Title></Card.Header>
      <Card.Content>
      {isLoading ? (
        <div style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>加载中...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(data?.events ?? []).slice().reverse().map((e) => (
            <div key={`${e.kind}-${e.created_at}-${e.task_handle ?? ''}`} style={{ borderLeft: '2px solid var(--cw-primary)', paddingLeft: 12 }}>
              <div style={{ fontSize: 12 }}>
                <strong>{RUN_EVENT_LABELS[e.kind] ?? e.kind}</strong>
                <span style={{ color: 'var(--cw-text-secondary)' }}> · {e.actor} · {e.created_at?.slice(11, 19)}</span>
                {e.task_handle && <code style={{ marginLeft: 8, fontSize: 11 }}>{e.task_handle.slice(0, 12)}…</code>}
              </div>
              {Object.keys(e.detail ?? {}).length > 0 && (
                <div style={{ color: 'var(--cw-text-secondary)', fontSize: 11 }}>{detailSummary(e.detail)}</div>
              )}
            </div>
          ))}
        </div>
      )}
      </Card.Content>
    </Card>
  )
}
