/** 审计时间线：run_events 全程留痕（工单的审批记录）。 */

import { useQuery } from '@tanstack/react-query'
import { Card, Spin, Timeline, Typography } from 'antd'
import { api } from '@/api/client'
import { RUN_EVENT_LABELS } from '@/config/portal'
import { useActivePid } from '@/transfer/context'

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
    <Card size="small" title="审计轨迹" style={{ marginTop: 16 }}>
      {isLoading ? (
        <Spin size="small" />
      ) : (
        <Timeline
          items={(data?.events ?? [])
            .slice()
            .reverse()
            .map((e) => ({
              children: (
                <div style={{ fontSize: 12 }}>
                  <Typography.Text strong>{RUN_EVENT_LABELS[e.kind] ?? e.kind}</Typography.Text>
                  <Typography.Text type="secondary"> · {e.actor} · {e.created_at?.slice(11, 19)}</Typography.Text>
                  {e.task_handle && (
                    <Typography.Text code style={{ marginLeft: 8, fontSize: 11 }}>
                      {e.task_handle.slice(0, 12)}…
                    </Typography.Text>
                  )}
                  {Object.keys(e.detail ?? {}).length > 0 && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {detailSummary(e.detail)}
                      </Typography.Text>
                    </div>
                  )}
                </div>
              ),
            }))}
        />
      )}
    </Card>
  )
}
