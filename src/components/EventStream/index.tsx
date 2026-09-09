import { useEffect, useRef, useState } from 'react'
import { Card, Progress, Space, Tag, Typography } from 'antd'
import { streamTaskEvents } from '@/api/client'
import type { TaskEvent } from '@/api/types'

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
          const data = event.data as { done: number; total: number }
          setProgress({ done: Number(data.done), total: Number(data.total) })
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
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {progress && (
        <Progress
          percent={Math.round((progress.done / Math.max(progress.total, 1)) * 100)}
          size="small"
          format={() => `${progress.done}/${progress.total}`}
        />
      )}
      {artifacts.length > 0 && (
        <Space wrap>
          {artifacts.map((a, i) => (
            <Card key={i} size="small" style={{ background: 'rgba(59,176,147,0.08)' }}>
              <Typography.Text copyable={{ text: a.path }}>
                {a.name ?? `产物 ${i + 1}`}
              </Typography.Text>
              {a.path && (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                  {a.path}
                </Typography.Paragraph>
              )}
            </Card>
          ))}
        </Space>
      )}
      <pre
        ref={terminalRef}
        style={{
          background: 'rgba(0,0,0,0.85)',
          color: '#d9d9d9',
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
      <Space size={4}>
        <Tag>handle: {handle.slice(0, 14)}…</Tag>
        <Tag color="blue">SSE</Tag>
      </Space>
    </Space>
  )
}
