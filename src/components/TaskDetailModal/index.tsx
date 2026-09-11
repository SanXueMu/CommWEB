import { useQuery } from '@tanstack/react-query'
import { App as AntApp, Alert, Button, Descriptions, Popconfirm, Space, Tooltip, Typography } from 'antd'
import { api } from '@/api/client'
import { DetailModal } from '@/components/DetailModal'
import { EventStream } from '@/components/EventStream'
import { ResultRenderer } from '@/components/ResultRenderer'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'

/** 任务详情弹窗（原侧边抽屉迁移为 DetailModal）：元信息 + 事件流 + 输出渲染 + 取消。 */
export function TaskDetailModal({ handle, onClose }: { handle: string | null; onClose: () => void }) {
  const pid = useActivePid()
  const { message } = AntApp.useApp()
  const { data: task, refetch } = useQuery({
    queryKey: ['provider', pid, 'task', handle],
    queryFn: () => api.getTask(handle!),
    enabled: handle !== null,
    refetchInterval: (query) =>
      query.state.data && ['queued', 'running'].includes(query.state.data.status) ? 1000 : false,
  })

  if (!task) return null
  const cancellable = ['queued', 'running'].includes(task.status)
  const toolLabel = task.tool_name ?? task.tool_id

  return (
    <DetailModal
      open={handle !== null}
      onClose={onClose}
      width={760}
      title={`${PORTAL.taskDetail.titlePrefix}${toolLabel}`}
      description={
        <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
          {task.handle}
        </Typography.Text>
      }
      footerAction={
        cancellable && (
          <Popconfirm
            title={PORTAL.taskDetail.cancelConfirm}
            onConfirm={async () => {
              try {
                const result = await api.cancelTask(task.handle)
                message.success(`${PORTAL.taskDetail.cancelled}: ${result.status}`)
                refetch()
              } catch (error) {
                message.error(`${PORTAL.taskDetail.cancelFailed}: ${(error as Error).message}`)
              }
            }}
          >
            <Button danger size="small">
              {PORTAL.taskDetail.cancel}
            </Button>
          </Popconfirm>
        )
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label={PORTAL.taskDetail.tool}>{toolLabel}</Descriptions.Item>
          <Descriptions.Item label={PORTAL.taskDetail.status}>
            <StatusBadge value={task.status} />
          </Descriptions.Item>
          <Descriptions.Item label={PORTAL.taskDetail.attempt}>
            <Tooltip title={PORTAL.taskDetail.attemptHint}>
              {task.attempt}/{task.max_attempts}
            </Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label={PORTAL.taskDetail.createdAt}>{task.created_at?.slice(0, 19)}</Descriptions.Item>
        </Descriptions>

        <EventStream handle={task.handle} onDone={() => refetch()} />

        {task.error && (
          <Alert type="error" showIcon message={task.error.kind} description={task.error.message} />
        )}

        {task.output != null && <ResultRenderer output={task.output} />}
      </Space>
    </DetailModal>
  )
}
