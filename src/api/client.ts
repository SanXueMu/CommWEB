/** CommAND API typed 客户端——本项目唯一出站通道，不含任何 UI 知识。 */

import type {
  FileUploaded,
  PipelineRun,
  PipelineRunCreated,
  PipelineSummary,
  RunEvent,
  RunSnapshot,
  StatusInfo,
  Task,
  TaskCreated,
  TaskEvent,
  ToolDetail,
  ToolSummary,
} from './types'

import { registry } from '@/transfer/registry'

/** 出站基址：当前活跃会员（Transfer T1 切换制，api 方法签名保持不变）。 */
function apiBase(): string {
  return registry.baseUrlOf(registry.activeId())
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}


function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const item = e as { loc?: unknown[]; msg?: string }
        const loc = (item.loc ?? []).filter((x) => x !== 'body').join('.')
        return loc ? `${loc}: ${item.msg ?? ''}` : (item.msg ?? '')
      })
      .join('；')
  }
  return JSON.stringify(detail)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, formatDetail((detail as { detail?: unknown }).detail) || String(response.status))
  }
  return response.json() as Promise<T>
}

export const api = {
  getStatuses: () => request<{ statuses: StatusInfo[] }>('/meta/statuses'),
  listTools: () => request<{ tools: ToolSummary[] }>('/tools'),
  getTool: (id: string) => request<ToolDetail>(`/tools/${id}`),
  createTask: (tool: string, input: Record<string, unknown>) =>
    request<TaskCreated>('/tasks', { method: 'POST', body: JSON.stringify({ tool, input }) }),
  getTask: (handle: string) => request<Task>(`/tasks/${handle}`),
  cancelTask: (handle: string) =>
    request<{ handle: string; status: string }>(`/tasks/${handle}/cancel`, { method: 'POST' }),
  listTasks: (status?: string) =>
    request<{ tasks: Task[] }>(`/tasks${status ? `?status=${status}` : ''}`),
  listPipelines: () => request<{ pipelines: PipelineSummary[] }>('/pipelines'),
  getPipeline: (id: string) => request<PipelineSummary>(`/pipelines/${id}`),
  runPipeline: (id: string, input: Record<string, unknown>) =>
    request<PipelineRunCreated>(`/pipelines/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),
  getPipelineRun: (runId: string) => request<PipelineRun>(`/pipeline-runs/${runId}`),
  getRunSnapshot: (runId: string) => request<RunSnapshot>(`/pipeline-runs/${runId}/snapshot`),
  listRunEvents: (runId: string, limit = 200) =>
    request<{ events: RunEvent[] }>(`/pipeline-runs/${runId}/events?limit=${limit}`),
  pauseRun: (runId: string) => request<{ run_id: string; status: string }>(`/pipeline-runs/${runId}/pause`, { method: 'POST' }),
  resumeRun: (runId: string) =>
    request<{ run_id: string; status: string; dispatched?: string }>(`/pipeline-runs/${runId}/resume`, { method: 'POST' }),
  abortRun: (runId: string) => request<{ run_id: string; status: string }>(`/pipeline-runs/${runId}/abort`, { method: 'POST' }),
  abortStep: (runId: string, stepIndex: number) =>
    request<{ run_id: string; step_index: number; status: string }>(`/pipeline-runs/${runId}/steps/${stepIndex}/abort`, { method: 'POST' }),
  rerunStep: (runId: string, stepIndex: number, override?: Record<string, unknown>) =>
    request<{ run_id: string; step_index: number; handle: string; status: string }>(`/pipeline-runs/${runId}/steps/${stepIndex}/rerun`, {
      method: 'POST',
      body: JSON.stringify({ override: override ?? null }),
    }),
  uploadFile: (file: File): Promise<FileUploaded> => {
    const body = new FormData()
    body.append('file', file)
    return fetch(`${apiBase()}/files`, { method: 'POST', body }).then(async (response) => {
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: response.statusText }))
        throw new ApiError(response.status, formatDetail((detail as { detail?: unknown }).detail) || String(response.status))
      }
      return response.json() as Promise<FileUploaded>
    })
  },
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
  const source = new EventSource(`${apiBase()}/tasks/${handle}/events`)
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
