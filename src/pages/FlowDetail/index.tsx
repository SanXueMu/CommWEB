/** 流详情页：介绍为主——头部元信息 + 文档，运行会话收进「发起运行」显式动作。
 *  FlowRunner 唯一实现，本页只做装配。 */

import { useQuery } from '@tanstack/react-query'
import { Button, Space, Spin, Tag, Typography } from 'antd'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFor } from '@/api/client'
import { DocPanel } from '@/components/DocPanel'
import { EntityDetailLayout } from '@/components/EntityDetailLayout'
import { FlowRunner } from '@/components/FlowRunner'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'

export function FlowDetail() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const pid = searchParams.get('provider') ?? 'default'
  const [runId, setRunId] = useState<string | null>(null)
  const [runOpened, setRunOpened] = useState(false)
  const { data: flow, isLoading, error } = useQuery({
    queryKey: ['provider', pid, 'pipeline', id],
    queryFn: () => apiFor(pid).getPipeline(id),
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (error || !flow) return <Typography.Text type="danger">流加载失败：{(error as Error)?.message ?? id}</Typography.Text>

  return (
    <EntityDetailLayout
      workspaceAction={<OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={pid} />}
      title={flow.name}
      tags={
        <>
          <Tag color="purple">{flow.id}</Tag>
          <Tag>{flow.steps.length} 步</Tag>
        </>
      }
      meta={
        <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
          {flow.steps.map((s) => s.tool).join(' → ')}
        </Typography.Text>
      }
      docs={<DocPanel docMd={flow.doc_md} />}
    >
      {runId != null || runOpened ? (
        <FlowRunner flow={flow} runId={runId} onRunIdChange={setRunId} providerId={pid} />
      ) : (
        <PanelCard>
          <Space size={12}>
            <Button type="primary" onClick={() => setRunOpened(true)}>{PORTAL.run.startFlow}</Button>
            <Typography.Text type="secondary">{PORTAL.run.startFlowHint}</Typography.Text>
          </Space>
        </PanelCard>
      )}
    </EntityDetailLayout>
  )
}
