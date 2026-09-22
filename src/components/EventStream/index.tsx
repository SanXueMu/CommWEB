import { useEffect, useRef, useState } from 'react'
import { streamTaskEvents } from '@/api/client'
import type { TaskEvent } from '@/api/types'
import { Card, Chip } from '@/ui'

interface ArtifactInfo {
  name?: string
  path?: string
}

/** SSE 事件流：终端日志 + 顶部进度条 + 产物卡片，三合一。 */
export function EventStream({
  handle,
  onDone,
}: {
  handle: string
  onDone?: (payload: { status: string; output: unknown; error: unknown }) => void
}) {
  const [logs, setLogs] = useState<TaskEvent[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])
  const terminalRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    setLogs([])
    setProgress(null)
    setArtifacts([])
    return streamTaskEvents(handle, {
      onEvent: (event) => {
        if (event.type === 'log') setLogs((prev) => [...prev, event])
        if (event.type === 'progress') {
          const data = (event.data ?? {}) as { done?: number; total?: number }
          const done = Number(data.done)
          const total = Number(data.total)
          setProgress(Number.isFinite(done) && Number.isFinite(total) && total > 0 ? { done, total } : null)
        }
        if (event.type === 'artifact') setArtifacts((prev) => [...prev, event.data as ArtifactInfo])
      },
      onDone: (payload) => {
        setLogs((prev) => [
          ...prev,
          { id: -1, type: 'log', data: { message: `── 任务终态：${payload.status} ──` }, created_at: '' },
        ])
        onDone?.(payload)
      },
    })
    // onDone 身份变化不需重订阅
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight })
  }, [logs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {progress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <progress style={{ flex: 1 }} value={progress.done} max={progress.total} />
          <span>{progress.done}/{progress.total}</span>
        </div>
      )}
      {artifacts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {artifacts.map((a, i) => (
            <Card key={i} style={{ background: 'rgba(59,176,147,0.08)' }}>
              <span title={a.path}>{a.name ?? `产物 ${i + 1}`}</span>
              {a.path && (
                <div style={{ marginBottom: 0, fontSize: 12, color: 'var(--cw-text-secondary)' }}>
                  {a.path}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <pre
        ref={terminalRef}
        style={{
          background: 'rgba(0,0,0,0.85)',
          color: 'var(--cw-border-strong)',
          padding: 12,
          borderRadius: 6,
          maxHeight: 240,
          overflow: 'auto',
          fontSize: 12,
          margin: 0,
        }}
      >
        {logs.length === 0 ? '（等待事件…）' : logs.map((l) => JSON.stringify(l.data)).join('\n')}
      </pre>
      <div style={{ display: 'flex', gap: 4 }}>
        <Chip>handle: {handle.slice(0, 14)}…</Chip>
        <Chip color="accent">SSE</Chip>
      </div>
    </div>
  )
}
