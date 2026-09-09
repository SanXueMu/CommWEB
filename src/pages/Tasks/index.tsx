import { useQuery } from '@tanstack/react-query'
import { Space, Spin, Table, Tabs, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { api } from '@/api/client'
import type { Task } from '@/api/types'
import { TaskDrawer } from '@/components/TaskDrawer'
import { STATUS_COLORS } from '@/theme/tokens'

const TABS = [
  { key: '', label: '全部' },
  { key: 'queued', label: '排队' },
  { key: 'running', label: '运行中' },
  { key: 'succeeded', label: '成功' },
  { key: 'failed', label: '失败' },
]

/** 柜台：跟踪任务。行点击开抽屉看事件流与输出。 */
export function Tasks() {
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', status],
    queryFn: () => api.listTasks(status || undefined),
    refetchInterval: 3000,
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Tabs activeKey={status} onChange={setStatus} items={TABS} />
      {isLoading ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : (
        <Table
          size="small"
          rowKey="handle"
          pagination={{ pageSize: 20 }}
          onRow={(record) => ({ onClick: () => setSelected(record.handle), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'handle', dataIndex: 'handle', render: (v: string) => <code>{v.slice(0, 14)}…</code> },
            { title: '工具', dataIndex: 'tool_id' },
            {
              title: '状态', dataIndex: 'status',
              render: (v: string) => <Tag color={STATUS_COLORS[v]}>{v}</Tag>,
            },
            { title: '尝试', dataIndex: 'attempt', render: (_: unknown, r: Task) => `${r.attempt}/${r.max_attempts}` },
            { title: '创建时间', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 19) },
          ] as ColumnsType<Task>}
          dataSource={data?.tasks ?? []}
        />
      )}
      <TaskDrawer handle={selected} onClose={() => setSelected(null)} />
    </Space>
  )
}
