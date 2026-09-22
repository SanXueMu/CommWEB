/** 流详情页：介绍为主——头部元信息 + 文档，运行会话收进「发起运行」显式动作。
 *  FlowRunner 唯一实现，本页只做装配。 */

import { useQuery } from '@tanstack/react-query'
import { Button, Chip } from '@/ui'
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

  if (isLoading) return <div role="status" style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  if (error || !flow) return <div role="alert" style={{ color: 'var(--cw-danger)' }}>流加载失败：{(error as Error)?.message ?? id}</div>

  return (
    <EntityDetailLayout
      workspaceAction={<OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={pid} />}
      title={flow.name}
      tags={
        <>
          <Chip color="accent">{flow.id}</Chip>
          <Chip>{flow.steps.length} 步</Chip>
        </>
      }
      meta={
        <code style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
          {flow.steps.map((s) => s.tool).join(' → ')}
        </code>
      }
      docs={<DocPanel docMd={flow.doc_md} />}
    >
      {runId != null || runOpened ? (
        <FlowRunner flow={flow} runId={runId} onRunIdChange={setRunId} providerId={pid} />
      ) : (
          <PanelCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button variant="primary" onClick={() => setRunOpened(true)}>{PORTAL.run.startFlow}</Button>
              <span style={{ color: 'var(--cw-text-secondary)' }}>{PORTAL.run.startFlowHint}</span>
            </div>
        </PanelCard>
      )}
    </EntityDetailLayout>
  )
}
