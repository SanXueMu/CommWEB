/** 流详情页：头部元信息 + 文档 + 运行会话（FlowRunner 唯一实现，本页只做装配）。 */

import { useQuery } from '@tanstack/react-query'
import { Card, Space, Spin, Tag, Typography } from 'antd'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFor } from '@/api/client'
import { DocPanel } from '@/components/DocPanel'
import { FlowRunner } from '@/components/FlowRunner'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'

export function FlowDetail() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const pid = searchParams.get('provider') ?? 'default'
  const [runId, setRunId] = useState<string | null>(null)
  const { data: flow, isLoading, error } = useQuery({
    queryKey: ['provider', pid, 'pipeline', id],
    queryFn: () => apiFor(pid).getPipeline(id),
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (error || !flow) return <Typography.Text type="danger">流加载失败：{(error as Error)?.message ?? id}</Typography.Text>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space size={8}>
          <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={pid} />
          <Typography.Title level={4} style={{ margin: 0 }}>{flow.name}</Typography.Title>
          <Tag color="purple">{flow.id}</Tag>
          <Tag>{flow.steps.length} 步</Tag>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
            {flow.steps.map((s) => s.tool).join(' → ')}
          </Typography.Text>
        </div>
      </Card>

      <DocPanel docMd={flow.doc_md} />

      <FlowRunner flow={flow} runId={runId} onRunIdChange={setRunId} providerId={pid} />
    </Space>
  )
}
