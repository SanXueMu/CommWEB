/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */

import { useQuery } from '@tanstack/react-query'
import { Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'

export function Flows() {
  const pid = useActivePid()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: api.listPipelines })

  const flows = useMemo(() => {
    const list = data?.pipelines ?? []
    if (!keyword) return list
    return list.filter(
      (f) => f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => s.tool.includes(keyword)),
    )
  }, [data, keyword])

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <DataListPanel
        panelKey="flows"
        items={flows}
        loading={isLoading}
        rowKey={(f) => f.id}
        onSearch={setKeyword}
        searchPlaceholder={PORTAL.search.flows}
        onItemClick={(f) => navigate(`/flows/${f.id}`)}
        emptyText={PORTAL.empty.flows}
        renderCard={(flow) => <FlowCard flow={flow} />}
        renderRow={(flow) => <FlowRow flow={flow} />}
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

function FlowCard({ flow }: { flow: PipelineSummary }) {
  return (
    <Link to={`/flows/${flow.id}`}>
      <PanelCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{flow.name}</Typography.Text>
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

function FlowRow({ flow }: { flow: PipelineSummary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <Typography.Text strong>{flow.name}</Typography.Text>
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
