import { useQuery } from '@tanstack/react-query'
import { App as AntApp, Button, Descriptions, Drawer, Popconfirm, Space } from 'antd'
import { api } from '@/api/client'
import { EventStream } from '@/components/EventStream'
import { ResultRenderer } from '@/components/ResultRenderer'
import { StatusBadge } from '@/components/StatusBadge'

/** 任务详情抽屉：状态徽章 + SSE 事件流 + 输出渲染 + 取消。 */
export function TaskDrawer({ handle, onClose }: { handle: string | null; onClose: () => void }) {
  const { message } = AntApp.useApp()
  const { data: task, refetch } = useQuery({
    queryKey: ['task', handle],
    queryFn: () => api.getTask(handle!),
    enabled: handle !== null,
    refetchInterval: (query) =>
      query.state.data && ['queued', 'running'].includes(query.state.data.status) ? 1000 : false,
  })

  if (!task) return null
  const cancellable = ['queued', 'running'].includes(task.status)

  return (
    <Drawer
      open={handle !== null}
      onClose={onClose}
      width={720}
      title={`任务 ${task.handle.slice(0, 18)}…`}
      extra={
        cancellable && (
          <Popconfirm title="确认取消该任务？" onConfirm={async () => {
            try {
              const result = await api.cancelTask(task.handle)
              message.success(`已请求取消：${result.status}`)
              refetch()
            } catch (error) {
              message.error(`取消失败：${(error as Error).message}`)
            }
          }}>
            <Button danger size="small">取消任务</Button>
          </Popconfirm>
        )
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="工具">{task.tool_id}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusBadge value={task.status} />
          </Descriptions.Item>
          <Descriptions.Item label="尝试">{task.attempt}/{task.max_attempts}</Descriptions.Item>
          <Descriptions.Item label="创建">{task.created_at?.slice(0, 19)}</Descriptions.Item>
        </Descriptions>

        <EventStream handle={task.handle} onDone={() => refetch()} />

        {task.error && (
          <Descriptions size="small" column={1} bordered title="错误">
            <Descriptions.Item label={task.error.kind}>{task.error.message}</Descriptions.Item>
          </Descriptions>
        )}

        {task.output != null && <ResultRenderer output={task.output} />}
      </Space>
    </Drawer>
  )
}
