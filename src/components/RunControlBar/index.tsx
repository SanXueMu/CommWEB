/** 运行控制条：暂停/恢复/中止，按钮显隐由 run.status 驱动（目录驱动渲染）。 */

import { useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Button, Popconfirm, Space } from 'antd'
import { api } from '@/api/client'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'

export interface RunControlBarProps {
  runId: string
  status: string
  onNewRound?: () => void
}

export function RunControlBar({ runId, status, onNewRound }: RunControlBarProps) {
  const { message } = AntApp.useApp()
  const queryClient = useQueryClient()

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      queryClient.invalidateQueries({ queryKey: ['runSnapshot', runId] })
      queryClient.invalidateQueries({ queryKey: ['runEvents', runId] })
    } catch (err) {
      message.error(String((err as Error).message ?? err))
    }
  }

  const terminal = ['succeeded', 'failed', 'failed_review', 'cancelled', 'interrupted']
  const buttons =
    status === 'running' ? (
      <>
        <Button size="small" onClick={() => act(() => api.pauseRun(runId))}>
          {PORTAL.workspace.pause}
        </Button>
        <Popconfirm title="中止后成果保留可查，确定？" onConfirm={() => act(() => api.abortRun(runId))}>
          <Button size="small" danger>
            {PORTAL.workspace.abort}
          </Button>
        </Popconfirm>
      </>
    ) : status === 'paused' ? (
      <>
        <Button size="small" type="primary" onClick={() => act(() => api.resumeRun(runId))}>
          {PORTAL.workspace.resume}
        </Button>
        <Popconfirm title="中止后成果保留可查，确定？" onConfirm={() => act(() => api.abortRun(runId))}>
          <Button size="small" danger>
            {PORTAL.workspace.abort}
          </Button>
        </Popconfirm>
      </>
    ) : terminal.includes(status) && onNewRound ? (
      <Button size="small" onClick={onNewRound}>
        {PORTAL.workspace.newRound}
      </Button>
    ) : null

  return (
    <Space size={12}>
      <StatusBadge value={status} />
      {buttons}
    </Space>
  )
}
