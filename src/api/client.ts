/** CommAND API typed 客户端——本项目唯一出站通道，不含任何 UI 知识。 */

import type { Task, TaskCreated, TaskEvent, ToolDetail, ToolSummary } from './types'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, (detail as { detail?: string }).detail ?? String(response.status))
  }
  return response.json() as Promise<T>
}

export const api = {
  listTools: () => request<{ tools: ToolSummary[] }>('/tools'),
  getTool: (id: string) => request<ToolDetail>(`/tools/${id}`),
  createTask: (tool: string, input: Record<string, unknown>) =>
    request<TaskCreated>('/tasks', { method: 'POST', body: JSON.stringify({ tool, input }) }),
  getTask: (handle: string) => request<Task>(`/tasks/${handle}`),
  cancelTask: (handle: string) =>
    request<{ handle: string; status: string }>(`/tasks/${handle}/cancel`, { method: 'POST' }),
  listTasks: (status?: string) =>
    request<{ tasks: Task[] }>(`/tasks${status ? `?status=${status}` : ''}`),
}

/** SSE 订阅：log/progress/artifact 逐事件回调，done 后自动关闭。 */
export function streamTaskEvents(
  handle: string,
  handlers: {
    onEvent?: (event: TaskEvent) => void
    onDone?: (payload: { status: string; output: unknown; error: unknown }) => void
    onError?: (error: Event) => void
  },
): () => void {
  const source = new EventSource(`${API_BASE}/tasks/${handle}/events`)
  const parse = (e: MessageEvent): TaskEvent => {
    const raw = JSON.parse(e.data as string) as { data: Record<string, unknown>; created_at: string }
    return { id: Number(e.lastEventId), type: e.type as TaskEvent['type'], data: raw.data, created_at: raw.created_at }
  }
  for (const type of ['log', 'progress', 'artifact'] as const) {
    source.addEventListener(type, (e) => handlers.onEvent?.(parse(e as MessageEvent)))
  }
  source.addEventListener('done', (e) => {
    handlers.onDone?.(JSON.parse((e as MessageEvent).data as string))
    source.close()
  })
  source.onerror = (e) => {
    if (source.readyState === EventSource.CLOSED) return
    handlers.onError?.(e)
  }
  return () => source.close()
}
