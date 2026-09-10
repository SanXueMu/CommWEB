/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */

import { Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProviderBadge } from '@/components/ProviderBadge'
import { FlowTypeBadge } from '@/components/ui/FlowTypeBadge'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'

const TYPE_LABELS = { flow: '普通流', workflow: '工作流' } as const

export function Flows() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [flowType, setFlowType] = useState<'' | keyof typeof TYPE_LABELS>('')
  const pid = useActivePid()
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const pipelines = data?.pipelines ?? []
  const providerName: Record<string, string> = {}

  const flows = useMemo(() => {
    return pipelines.filter(
      (f) =>
        (!flowType || f.type === flowType) &&
        (!keyword || f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => (s.tool || s.pipeline || '').includes(keyword))),
    )
  }, [pipelines, keyword, flowType])

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
      <aside
        style={{
          width: 128,
          flexShrink: 0,
          position: 'sticky',
          top: 76,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 16,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          类型
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {(['', 'flow', 'workflow'] as const).map((k) => (
            <Typography.Link
              key={k || 'all'}
              strong={flowType === k}
              onClick={() => setFlowType(k)}
              style={{ color: flowType === k ? '#202753' : '#8c8c8c' }}
            >
              {k ? TYPE_LABELS[k] : '全部'}（
                {k ? pipelines.filter((f) => f.type === k).length : pipelines.length}）
            </Typography.Link>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
      <DataListPanel
        panelKey="flows"
        items={flows}
        loading={isLoading}
        rowKey={(f) => `${f.providerId ?? 'default'}:${f.id}`}
        onSearch={setKeyword}
        searchPlaceholder={PORTAL.search.flows}
        onItemClick={(f) => navigate(`/flows/${encodeURIComponent(f.id)}?provider=${f.providerId ?? 'default'}`)}
        emptyText={PORTAL.empty.flows}
        renderCard={(flow) => <FlowCard flow={flow} providerName={providerName} />}
        renderRow={(flow) => <FlowRow flow={flow} providerName={providerName} />}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        共 {flows.length} 条流 · {PORTAL.footNote.flows}
      </Typography.Text>
      </div>
    </div>
  )
}

function StepChain({ flow }: { flow: PipelineSummary }) {
  return (
    <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
      {flow.steps.map((s) => s.tool || s.pipeline).join(' → ')}
    </Typography.Text>
  )
}

function FlowCard({ flow, providerName }: { flow: PipelineSummary; providerName: Record<string, string> }) {
  return (
    <Link to={`/flows/${encodeURIComponent(flow.id)}?provider=${flow.providerId ?? 'default'}`}>
      <PanelCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{flow.name}</Typography.Text>
          <FlowTypeBadge flow={flow} />
          <ProviderBadge pid={flow.providerId ?? 'default'} name={providerName[flow.providerId ?? 'default']} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {flow.steps.length} 步
          </Typography.Text>
        </div>
        <div style={{ margin: '10px 0 6px' }}>
          <StepChain flow={flow} />
        </div>
      </PanelCard>
    </Link>
  )
}

function FlowRow({ flow, providerName }: { flow: PipelineSummary; providerName: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <Space size={6}>
          <Typography.Text strong>{flow.name}</Typography.Text>
          <FlowTypeBadge flow={flow} />
          <ProviderBadge pid={flow.providerId ?? 'default'} name={providerName[flow.providerId ?? 'default']} />
        </Space>
        <div>
          <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
            {flow.id}
          </Typography.Text>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <StepChain flow={flow} />
      </div>
      <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={flow.providerId} />
    </div>
  )
}
