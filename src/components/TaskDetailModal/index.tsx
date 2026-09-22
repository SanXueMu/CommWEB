import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { DetailModal } from '@/components/DetailModal'
import { EventStream } from '@/components/EventStream'
import { ResultRenderer } from '@/components/ResultRenderer'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { Button, Card } from '@/ui'
import { useConfirm } from '@/components/ConfirmDialog'

/** 任务详情弹窗（原侧边抽屉迁移为 DetailModal）：元信息 + 事件流 + 输出渲染 + 取消。 */
export function TaskDetailModal({ handle, onClose }: { handle: string | null; onClose: () => void }) {
  const pid = useActivePid()
  const { confirm } = useConfirm()
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
        <code style={{ fontSize: 12 }}>
          {task.handle}
        </code>
      }
      footerAction={
        cancellable && (
          <Button variant="danger" size="sm" onClick={async () => {
            const approved = await confirm({ title: PORTAL.taskDetail.cancelConfirm, options: [{ value: true, label: PORTAL.taskDetail.cancel }] })
            if (approved) {
              try {
                const result = await api.cancelTask(task.handle)
                console.info(`${PORTAL.taskDetail.cancelled}: ${result.status}`)
                refetch()
              } catch (error) {
                console.error(`${PORTAL.taskDetail.cancelFailed}: ${(error as Error).message}`)
              }
            }
          }}>
            {PORTAL.taskDetail.cancel}
          </Button>
        )
      }
    >
      <div style={{ display: 'grid', gap: 16, width: '100%' }}>
        <Card>
          <dl style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', margin: 0 }}>
            <div><dt>{PORTAL.taskDetail.tool}</dt><dd>{toolLabel}</dd></div>
            <div><dt>{PORTAL.taskDetail.status}</dt><dd><StatusBadge value={task.status} /></dd></div>
            <div><dt>{PORTAL.taskDetail.attempt}</dt><dd>
            <span title={PORTAL.taskDetail.attemptHint}>
              {task.attempt}/{task.max_attempts}
            </span>
            </dd></div>
            <div><dt>{PORTAL.taskDetail.createdAt}</dt><dd>{task.created_at?.slice(0, 19)}</dd></div>
          </dl>
        </Card>

        <EventStream handle={task.handle} onDone={() => refetch()} />

        {task.error && (
          <div role="alert" style={{ background: 'var(--cw-danger-soft)', border: '1px solid var(--cw-danger)', borderRadius: 8, padding: 12 }}><strong>{task.error.kind}</strong><div>{task.error.message}</div></div>
        )}

        {task.output != null && <ResultRenderer output={task.output} />}
      </div>
    </DetailModal>
  )
}
