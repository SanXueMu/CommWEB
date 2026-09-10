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
import { normalizePipeline, normalizeStatuses, normalizeTask, normalizeToolDetail, normalizeToolSummary } from '@/transfer/translator'

/** 出站基址解析：显式 pid 优先，缺省跟随活跃会员。 */
function apiBaseOf(pid?: string): string {
  return registry.baseUrlOf(pid ?? pid ?? registry.activeId() ?? 'default')
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

async function request<T>(path: string, init?: RequestInit, pid?: string): Promise<T> {
  const response = await fetch(`${apiBaseOf(pid)}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, formatDetail((detail as { detail?: unknown }).detail) || String(response.status))
  }
  return response.json() as Promise<T>
}

function createApi(pid?: string) {
  return {
  getStatuses: async (): Promise<{ statuses: StatusInfo[] }> => ({ statuses: normalizeStatuses((await request<{ statuses: unknown[] }>('/meta/statuses')).statuses) }),
  listTools: async (): Promise<{ tools: ToolSummary[] }> => {
    const providerId = pid ?? registry.activeId() ?? 'default'
    const { tools } = await request<{ tools: unknown[] }>('/tools')
    return { tools: tools.map((t) => normalizeToolSummary(t, providerId)) }
  },
  getTool: async (id: string): Promise<ToolDetail> => normalizeToolDetail(await request<unknown>(`/tools/${id}`), pid ?? registry.activeId() ?? 'default'),
  createTask: (tool: string, input: Record<string, unknown>) =>
    request<TaskCreated>('/tasks', { method: 'POST', body: JSON.stringify({ tool, input }) }),
  getTask: async (handle: string): Promise<Task> => normalizeTask(await request<unknown>(`/tasks/${handle}`), pid ?? registry.activeId() ?? 'default'),
  cancelTask: (handle: string) =>
    request<{ handle: string; status: string }>(`/tasks/${handle}/cancel`, { method: 'POST' }),
  listTasks: (status?: string) =>
    request<{ tasks: Task[] }>(`/tasks${status ? `?status=${status}` : ''}`),
  listPipelines: async (): Promise<{ pipelines: PipelineSummary[] }> => {
    const providerId = pid ?? registry.activeId() ?? 'default'
    const { pipelines } = await request<{ pipelines: unknown[] }>('/pipelines')
    return { pipelines: pipelines.map((p) => normalizePipeline(p, providerId)) }
  },
  getPipeline: async (id: string): Promise<PipelineSummary> => normalizePipeline(await request<unknown>(`/pipelines/${id}`), pid ?? registry.activeId() ?? 'default'),
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
  uploadFile: (file: File): Promise<FileUploaded> => apiUpload(file, pid),
  }
}

/** 上传出站（api 工厂与页面共用）。 */
function apiUpload(file: File, pid?: string): Promise<FileUploaded> {
  const body = new FormData()
  body.append('file', file)
  return fetch(`${apiBaseOf(pid)}/files`, { method: 'POST', body }).then(async (response) => {
    if (!response.ok) {
      const detail = await response.json().catch(() => ({ detail: response.statusText }))
      throw new ApiError(response.status, formatDetail((detail as { detail?: unknown }).detail) || String(response.status))
    }
    return response.json() as Promise<FileUploaded>
  })
}

/** 活跃会员视图（页面级跟随切换）。 */
export const api = createApi()

/** 会员绑定视图（工作区 tab 级：出站固定，切换全局不影响已开 tab）。 */
export function apiFor(pid: string) {
  return createApi(pid)
}

/** SSE 订阅：log/progress/artifact 逐事件回调，done 后自动关闭。 */
export function streamTaskEvents(
  handle: string,
  handlers: {
    onEvent?: (event: TaskEvent) => void
    onDone?: (payload: { status: string; output: unknown; error: unknown }) => void
    onError?: (error: Event) => void
  },
  pid?: string,
): () => void {
  const source = new EventSource(`${apiBaseOf(pid)}/tasks/${handle}/events`)
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
