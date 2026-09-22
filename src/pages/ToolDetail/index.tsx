import { useQuery } from '@tanstack/react-query'
import { Card, Chip } from '@/ui'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFor } from '@/api/client'
import { DocPanel } from '@/components/DocPanel'
import { EntityDetailLayout } from '@/components/EntityDetailLayout'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { ToolForm } from '@/components/ToolForm'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'

/** 工作台：manifest 信息 + 自动表单 + 该工具近期任务。 */
export function ToolDetail() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const pid = searchParams.get('provider') ?? 'default'
  const api = apiFor(pid)
  const [drawerHandle, setDrawerHandle] = useState<string | null>(null)
  const { data: tool, isLoading, error } = useQuery({
    queryKey: ['provider', pid, 'tool', id],
    queryFn: () => api.getTool(id),
  })
  const { data: recent } = useQuery({
    queryKey: ['provider', pid, 'tasks', ''],
    queryFn: () => api.listTasks(),
    refetchInterval: 5000,
  })

  if (isLoading) return <div role="status" style={{ textAlign: 'center', padding: 80 }}>加载中...</div>
  if (error || !tool) return <div role="alert" style={{ color: 'var(--cw-danger)' }}>工具加载失败：{(error as Error)?.message ?? id}</div>

  const tasks = (recent?.tasks ?? []).filter((t) => t.tool_id === tool.id).slice(0, 5)

  return (
    <EntityDetailLayout
      workspaceAction={<OpenInWorkspace kind="tool" refId={tool.id} title={tool.name} providerId={pid} />}
      title={tool.name}
      tags={
        <>
          <Chip color="accent">{tool.id}</Chip>
          <Chip>v{tool.version}</Chip>
          <Chip>{tool.runtime_kind}</Chip>
        </>
      }
      description={tool.description}
      meta={
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
          <span>超时：{tool.manifest.resources.timeout_s}s</span>
          <span>并发：{tool.manifest.resources.concurrency}</span>
          <span>重试上限：{tool.manifest.resources.max_attempts}</span>
        </div>
      }
      docs={<DocPanel docMd={tool.manifest.doc_md} />}
    >
      <Card><strong style={{ display: 'block', marginBottom: 12 }}>{PORTAL.run.formTitle}</strong>
        <ToolForm tool={tool} onSubmitted={setDrawerHandle} />
      </Card>

      <Card><strong style={{ display: 'block', marginBottom: 12 }}>近期任务</strong>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th>handle</th><th>状态</th><th>创建</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.handle} onClick={() => setDrawerHandle(task.handle)} style={{ cursor: 'pointer' }}><td><code>{task.handle.slice(0, 14)}…</code></td><td><StatusBadge value={task.status} /></td><td>{task.created_at?.slice(0, 19)}</td></tr>)}</tbody></table></div>
      </Card>

      <TaskDetailModal handle={drawerHandle} onClose={() => setDrawerHandle(null)} />
    </EntityDetailLayout>
  )
}
