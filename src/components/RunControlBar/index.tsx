/** 运行控制条：暂停/恢复/中止，按钮显隐由 run.status 驱动（目录驱动渲染）。 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useConfirm } from '@/components/ConfirmDialog'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { Button } from '@/ui'

export interface RunControlBarProps {
  runId: string
  status: string
  onNewRound?: () => void
}

export function RunControlBar({ runId, status, onNewRound }: RunControlBarProps) {
  const pid = useActivePid()
  const { confirm } = useConfirm()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runSnapshot', runId] })
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runEvents', runId] })
    } catch (err) {
      setError(String((err as Error).message ?? err))
    }
  }

  const abort = async () => {
    const accepted = await confirm({
      title: '中止运行',
      content: '中止后成果保留可查，确定？',
      options: [{ value: true, label: PORTAL.workspace.abort, danger: true }],
    })
    if (accepted) await act(() => api.abortRun(runId))
  }

  const terminal = ['succeeded', 'failed', 'failed_review', 'cancelled', 'interrupted']
  const buttons =
    status === 'running' ? (
      <>
        <Button size="sm" variant="secondary" onClick={() => act(() => api.pauseRun(runId))}>
          {PORTAL.workspace.pause}
        </Button>
        <Button size="sm" variant="danger" onClick={abort}>{PORTAL.workspace.abort}</Button>
      </>
    ) : status === 'paused' ? (
      <>
        <Button size="sm" variant="primary" onClick={() => act(() => api.resumeRun(runId))}>
          {PORTAL.workspace.resume}
        </Button>
        <Button size="sm" variant="danger" onClick={abort}>{PORTAL.workspace.abort}</Button>
      </>
    ) : terminal.includes(status) && onNewRound ? (
      <Button size="sm" variant="secondary" onClick={onNewRound}>
        {PORTAL.workspace.newRound}
      </Button>
    ) : null

  return (
    <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <StatusBadge value={status} />
      {buttons}
      {error && <span role="alert" style={{ color: 'var(--cw-danger)', fontSize: 12 }}>{error}</span>}
    </div>
  )
}
