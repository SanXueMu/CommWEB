/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */

import { Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProviderBadge } from '@/components/ProviderBadge'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'

export function Flows() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const pid = useActivePid()
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const pipelines = data?.pipelines ?? []
  const providerName: Record<string, string> = {}

  const flows = useMemo(() => {
    if (!keyword) return pipelines
    return pipelines.filter(
      (f) => f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => s.tool.includes(keyword)),
    )
  }, [pipelines, keyword])

  return (
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
  )
}

function StepChain({ flow }: { flow: PipelineSummary }) {
  return (
    <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
      {flow.steps.map((s) => s.tool).join(' → ')}
    </Typography.Text>
  )
}

function FlowCard({ flow, providerName }: { flow: PipelineSummary; providerName: Record<string, string> }) {
  return (
    <Link to={`/flows/${flow.id}`}>
      <PanelCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{flow.name}</Typography.Text>
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
      <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} />
    </div>
  )
}
