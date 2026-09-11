import { useQuery } from '@tanstack/react-query'
import { Button, Form, Space, Typography } from 'antd'
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
  const [form] = Form.useForm()
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
        <Space size={4}>
          <ProviderBadge pid={tool.providerId ?? 'default'} />
          {tool.enabled === false && <DisabledBadge />}
        </Space>
      }
      description={detail.data?.description}
      footerAction={
        <Button type="primary" loading={submitting} disabled={detail.data == null} onClick={() => form.submit()}>
          {PORTAL.toolDetail.run}
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text type="secondary" strong>
            {PORTAL.toolDetail.lifecycle}
          </Typography.Text>
          <div style={{ margin: '10px 0 16px' }}>
            <LifeFlow nodes={lifecycleNodes(io?.input_types ?? [], io?.output_types ?? [])} />
          </div>
          <Typography.Text type="secondary" strong>
            {PORTAL.toolDetail.performance}
          </Typography.Text>
          <div style={{ margin: '10px 0 16px', display: 'flex', gap: 24 }}>
            <span>
              <Typography.Text type="secondary">{PORTAL.toolDetail.executions} </Typography.Text>
              <Typography.Text strong>{stats.data?.executions ?? '—'}</Typography.Text>
            </span>
            <span>
              <Typography.Text type="secondary">{PORTAL.toolDetail.successRate} </Typography.Text>
              <Typography.Text strong>
                {stats.data?.success_rate == null ? '—' : `${Math.round(stats.data.success_rate * 100)}%`}
              </Typography.Text>
            </span>
            <span>
              <Typography.Text type="secondary">{PORTAL.toolDetail.avgSeconds} </Typography.Text>
              <Typography.Text strong>{fmtSeconds(stats.data?.avg_seconds ?? null)}</Typography.Text>
            </span>
          </div>
          <Typography.Text type="secondary" strong>
            {PORTAL.toolDetail.recentTasks}
          </Typography.Text>
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
                  <Typography.Text ellipsis style={{ flex: 1 }}>
                    {t.handle}
                  </Typography.Text>
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
