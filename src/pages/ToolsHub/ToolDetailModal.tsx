import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, apiFor } from '@/api/client'
import type { ToolSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { DetailModal } from '@/components/DetailModal'
import { DisabledBadge } from '@/components/DisabledBadge'
import { LifeFlow } from '@/components/LifeFlow'
import { PanelCard } from '@/components/ui/PanelCard'
import { ProviderBadge } from '@/components/ProviderBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { ToolForm } from '@/components/ToolForm'
import { PORTAL } from '@/config/portal'
import { Button } from '@/ui'
import { useForm } from '@/ui/form'

const fmtSeconds = (v: number | null) =>
  v == null ? '—' : v >= 1 ? `${v.toFixed(1)}s` : `${Math.round(v * 1000)}ms`

const lifecycleNodes = (inputTypes: string[], outputTypes: string[]) =>
  [...inputTypes, ...outputTypes].map((t) => ({ key: t, label: t }))

/** 工具详情弹窗（C3）：介绍三段（生命周期/量化性能/近期任务）+ 右侧运行表单 + 底部统一运行按钮。 */
export function ToolDetailModal({ tool, open, onClose }: {
  tool: ToolSummary
  open: boolean
  onClose: () => void
}) {
  const [form] = useForm()
  const [submitting, setSubmitting] = useState(false)

  const detail = useQuery({
    queryKey: ['provider', tool.providerId, 'tool', tool.id],
    queryFn: () => apiFor(tool.providerId ?? 'default').getTool(tool.id),
    enabled: open,
  })

  const recent = useQuery({
    queryKey: ['provider', tool.providerId, 'tasks', 'recent'],
    queryFn: () => api.listTasks(undefined, undefined, 0, undefined, 200),
    enabled: open,
  })

  const stats = useQuery({
    queryKey: ['provider', tool.providerId, 'tool-stats', tool.id],
    queryFn: () => api.getToolStats(tool.id),
    enabled: open,
  })

  const toolTasks = (recent.data?.tasks ?? []).filter((t) => t.tool_id === tool.id)
  const io = detail.data?.manifest.io

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={tool.name}
      width={960}
      tags={
        <div style={{ display: 'flex', gap: 4 }}>
          <ProviderBadge pid={tool.providerId ?? 'default'} />
          {tool.enabled === false && <DisabledBadge />}
        </div>
      }
      description={detail.data?.description}
      footerAction={
        <Button variant="primary" isDisabled={submitting || detail.data == null} onClick={() => form.submit()}>
          {PORTAL.toolDetail.run}
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ color: 'var(--cw-text-secondary)' }}>
            {PORTAL.toolDetail.lifecycle}
          </strong>
          <div style={{ margin: '10px 0 16px' }}>
            <LifeFlow nodes={lifecycleNodes(io?.input_types ?? [], io?.output_types ?? [])} />
          </div>
          <strong style={{ color: 'var(--cw-text-secondary)' }}>
            {PORTAL.toolDetail.performance}
          </strong>
          <div style={{ margin: '10px 0 16px', display: 'flex', gap: 24 }}>
            <span>
              <span style={{ color: 'var(--cw-text-secondary)' }}>{PORTAL.toolDetail.executions} </span>
              <strong>{stats.data?.executions ?? '—'}</strong>
            </span>
            <span>
              <span style={{ color: 'var(--cw-text-secondary)' }}>{PORTAL.toolDetail.successRate} </span>
              <strong>
                {stats.data?.success_rate == null ? '—' : `${Math.round(stats.data.success_rate * 100)}%`}
              </strong>
            </span>
            <span>
              <span style={{ color: 'var(--cw-text-secondary)' }}>{PORTAL.toolDetail.avgSeconds} </span>
              <strong>{fmtSeconds(stats.data?.avg_seconds ?? null)}</strong>
            </span>
          </div>
          <strong style={{ color: 'var(--cw-text-secondary)' }}>
            {PORTAL.toolDetail.recentTasks}
          </strong>
          <div style={{ marginTop: 10 }}>
            <DataListPanel
              panelKey="tool-detail-recent"
              items={toolTasks}
              rowKey={(t) => t.handle}
              defaultView="list"
              searchPlaceholder={PORTAL.search.tasks}
              pagination={{ pageSize: 5 }}
              density="compact"
              emptyText={PORTAL.toolDetail.noTasks}
              renderRow={(t) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <StatusBadge value={t.status} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.handle}
                    </span>
                </div>
              )}
            />
          </div>
        </div>
        <PanelCard title={PORTAL.run.formTitle} radius="round" style={{ width: 300, flexShrink: 0 }}>
          {detail.data && (
            <ToolForm
              tool={detail.data}
              form={form}
              showSubmit={false}
              onSubmittingChange={setSubmitting}
              onSubmitted={() => {
                void recent.refetch()
                void stats.refetch()
              }}
            />
          )}
        </PanelCard>
      </div>
    </DetailModal>
  )
}
