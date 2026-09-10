import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Space, Spin, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFor } from '@/api/client'
import { TaskDrawer } from '@/components/TaskDrawer'
import { ToolForm } from '@/components/ToolForm'
import { DocPanel } from '@/components/DocPanel'
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

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (error || !tool) return <Typography.Text type="danger">工具加载失败：{(error as Error)?.message ?? id}</Typography.Text>

  const tasks = (recent?.tasks ?? []).filter((t) => t.tool_id === tool.id).slice(0, 5)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" size={4}>
          <Space size={8}>
            <Typography.Title level={4} style={{ margin: 0 }}>{tool.name}</Typography.Title>
            <OpenInWorkspace kind="tool" refId={tool.id} title={tool.name} providerId={pid} />
            <Tag color="blue">{tool.id}</Tag>
            <Tag>v{tool.version}</Tag>
            <Tag>{tool.runtime_kind}</Tag>
          </Space>
          <Typography.Text type="secondary">{tool.description}</Typography.Text>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="超时">{tool.manifest.resources.timeout_s}s</Descriptions.Item>
            <Descriptions.Item label="并发">{tool.manifest.resources.concurrency}</Descriptions.Item>
            <Descriptions.Item label="重试上限">{tool.manifest.resources.max_attempts}</Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Card size="small" title={PORTAL.run.formTitle}>
        <ToolForm tool={tool} onSubmitted={setDrawerHandle} />
      </Card>

      <Card size="small" title="近期任务">
        <Table
          size="small"
          rowKey="handle"
          pagination={false}
          onRow={(record) => ({ onClick: () => setDrawerHandle(record.handle), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'handle', dataIndex: 'handle', render: (v: string) => <code>{v.slice(0, 14)}…</code> },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusBadge value={v} /> },
            { title: '创建', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 19) },
          ]}
          dataSource={tasks}
        />
      </Card>

      <DocPanel docMd={tool.manifest.doc_md} />

      <TaskDrawer handle={drawerHandle} onClose={() => setDrawerHandle(null)} />
    </Space>
  )
}
