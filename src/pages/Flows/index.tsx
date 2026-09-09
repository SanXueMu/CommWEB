/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */

import { useQuery } from '@tanstack/react-query'
import { Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'

export function Flows() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['pipelines'], queryFn: api.listPipelines })

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
        searchPlaceholder="搜索流（名称 / id / 步骤工具）"
        onItemClick={(f) => navigate(`/flows/${f.id}`)}
        emptyText="暂无流工具——先在 CommAND 侧注册管线"
        renderCard={(flow) => <FlowCard flow={flow} />}
        renderRow={(flow) => <FlowRow flow={flow} />}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        共 {flows.length} 条流 · 管线步骤可在任务中心逐步追踪
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
      <div
        style={{
          border: '1px solid #ececec',
          borderRadius: 10,
          padding: 16,
          height: '100%',
          background: '#fff',
          transition: 'box-shadow .2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{flow.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {flow.steps.length} 步
          </Typography.Text>
        </div>
        <div style={{ margin: '10px 0 6px' }}>
          <StepChain flow={flow} />
        </div>
      </div>
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
    </div>
  )
}
