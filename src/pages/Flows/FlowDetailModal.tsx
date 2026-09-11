/** 流详情弹窗（D 清单）：介绍三段（功能描述/数据转化生命周期/量化性能）
 *  + 右侧侧栏运行表单 + 底部发起运行 + 近期任务（分页/检索）。 */

import { useQuery } from '@tanstack/react-query'
import { Button, Form, Typography } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { App as AntApp } from 'antd'
import { useMemo, useState } from 'react'
import { api } from '@/api/client'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { DetailModal } from '@/components/DetailModal'
import { FlowForm } from '@/components/FlowForm'
import { LifeFlow } from '@/components/LifeFlow'
import { ProviderBadge } from '@/components/ProviderBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { FlowTypeBadge } from '@/components/ui/FlowTypeBadge'
import { PORTAL } from '@/config/portal'
import { resolveForm } from '@/protocol/resolver'
import { useActivePid } from '@/transfer/context'


/** 被 steps 模板引用的 input 键集合（与 FlowRunner 同规则）。 */
const refKeysOf = (steps: { input?: Record<string, unknown> }[]) => {
  const keys = new Set<string>()
  for (const step of steps) {
    for (const m of JSON.stringify(step.input ?? {}).matchAll(/\{\{\s*input\.(\w+)\s*\}\}/g)) keys.add(m[1])
  }
  return keys
}

export function FlowDetailModal({ flow, open, onClose }: {
  flow: PipelineSummary
  open: boolean
  onClose: () => void
}) {
  const activePid = useActivePid()
  const pid = flow.providerId ?? (typeof activePid === 'string' ? activePid : 'default')
  const [form] = Form.useForm<Record<string, unknown>>()
  const [submitting, setSubmitting] = useState(false)
  const [taskKw, setTaskKw] = useState('')
  const queryClient = useQueryClient()
  const { message } = AntApp.useApp()

  const fields = useMemo(
    () => (flow.input_schema?.properties ? resolveForm(flow.input_schema as never) : []),
    [flow.input_schema],
  )

  const stats = useQuery({
    queryKey: ['provider', flow.providerId, 'pipeline-stats', flow.id],
    queryFn: () => api.getPipelineStats(flow.id),
    enabled: open,
  })
  const tasks = useQuery({
    queryKey: ['provider', flow.providerId, 'tasks', 'for-flow', flow.id],
    queryFn: () => api.listTasks(undefined, undefined, 0, undefined, 200),
    enabled: open,
  })
  const flowTasks = (tasks.data?.tasks ?? [])
    .filter((t) => t.root_pipeline_id === flow.id)
    .filter((t) => !taskKw || t.handle.toLowerCase().includes(taskKw.toLowerCase()))

  const ioNodes = useMemo(
    () =>
      flow.steps.map((s, i) => ({
        key: `${s.tool ?? s.pipeline ?? 'step'}-${i}`,
        label: s.tool ?? s.pipeline ?? '步骤',
      })),
    [flow.steps],
  )

  return (
    <DetailModal
      open={open}
      onClose={onClose}
      title={flow.name}
      tags={
        <>
          <FlowTypeBadge flow={flow} />
          <ProviderBadge pid={pid} />
        </>
      }
      description={
        flow.doc_md ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {flow.doc_md}
          </Typography.Paragraph>
        ) : undefined
      }
      footerAction={
        <Button type="primary" loading={submitting} onClick={() => form.submit()}>
          {PORTAL.run.startFlow}
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text type="secondary" strong>{PORTAL.toolDetail.lifecycle}</Typography.Text>
          <div style={{ margin: '10px 0 14px' }}>
            {ioNodes.length > 0 ? <LifeFlow nodes={ioNodes} size="md" /> : <Typography.Text type="secondary">—</Typography.Text>}
          </div>
          <Typography.Text type="secondary" strong>{PORTAL.toolDetail.performance}</Typography.Text>
          <div style={{ margin: '8px 0 14px', display: 'flex', gap: 20 }}>
            <span>{PORTAL.toolDetail.executions}：<b>{stats.data?.executions ?? '—'}</b></span>
            <span>
              {PORTAL.toolDetail.successRate}：
              <b>{stats.data?.success_rate != null ? `${Math.round(stats.data.success_rate * 100)}%` : '—'}</b>
            </span>
            <span>
              {PORTAL.toolDetail.avgSeconds}：
              <b>{stats.data?.avg_seconds != null ? `${stats.data.avg_seconds}s` : '—'}</b>
            </span>
          </div>
          <Typography.Text type="secondary" strong>{PORTAL.toolDetail.recentTasks}</Typography.Text>
          <DataListPanel
            panelKey="flow-detail-tasks"
            providerId={flow.providerId}
            items={flowTasks}
            loading={tasks.isLoading}
            rowKey={(t) => t.handle}
            defaultView="list"
            pagination={{ pageSize: 5 }}
            searchPlaceholder={PORTAL.search.tasks}
            emptyText={PORTAL.toolDetail.noTasks}
            onSearch={setTaskKw}
            renderRow={(t) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.handle}</Typography.Text>
                <StatusBadge value={t.status} />
              </div>
            )}
          />
        </div>
        <div style={{ width: 300, flexShrink: 0 }}>
          <Typography.Text type="secondary" strong>{PORTAL.run.panelTitle}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <FlowForm
              refKeys={refKeysOf(flow.steps)}
              flow={{ id: flow.id, name: flow.name, steps: flow.steps }}
              fields={fields}
              providerId={pid}
              form={form}
              showSubmit={false}
              onRun={() => {
                void queryClient.invalidateQueries({ queryKey: ['provider', flow.providerId, 'tasks'] })
                message.success(PORTAL.run.queued)
              }}
              onSubmittingChange={setSubmitting}
            />
          </div>
        </div>
      </div>
    </DetailModal>
  )
}
