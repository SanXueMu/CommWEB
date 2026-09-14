/** CommAND API typed 客户端——本项目唯一出站通道，不含任何 UI 知识。 */

import type {
  FileUploaded,
  OcrDbFile,
  OcrKey,
  PipelineDefinition,
  PipelineRun,
  PipelineRunCreated,
  PipelineSummary,
  RunEvent,
  RunSnapshot,
  RunSummary,
  StatusInfo,
  Task,
  TaskCreated,
  TaskKind,
  TaskEvent,
  ToolDetail,
  ToolStats,
  ToolSummary,
} from './types'

import { registry } from '@/transfer/registry'
import type { FileProbe } from '@/protocol/routeSelect'
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
  /** 通用 GET（协议面端点如 /meta/site，由 Transfer 解析层使用）。 */
  get: <T>(path: string) => request<T>(path, undefined, pid),
  /** 通用出站（管理面同步端点如 /ocr/templates 的 PATCH/POST/DELETE）。 */
  send: <T>(path: string, init: RequestInit) => request<T>(path, init, pid),
  getStatuses: async (): Promise<{ statuses: StatusInfo[] }> => ({ statuses: normalizeStatuses((await request<{ statuses: unknown[] }>('/meta/statuses')).statuses) }),
  getToolCategories: async (): Promise<{ categories: { name: string; subs: string[] }[] }> =>
    request<{ categories: { name: string; subs: string[] }[] }>('/meta/tool-categories'),
  getToolStats: async (toolId: string): Promise<ToolStats> =>
    request<ToolStats>(`/tools/${encodeURIComponent(toolId)}/stats`),
  getPipelineStats: async (pipelineId: string): Promise<ToolStats> =>
    request<ToolStats>(`/pipelines/${encodeURIComponent(pipelineId)}/stats`),
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
  listTasks: (status?: string, kind?: TaskKind, offset?: number, q?: string, limit?: number) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (kind) params.set('kind', kind)
    if (offset) params.set('offset', String(offset))
    if (q) params.set('q', q)
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    return request<{ tasks: Task[]; total?: number }>(`/tasks${qs ? `?${qs}` : ''}`)
  },
  rerunRun: (runId: string, inputOverride?: Record<string, unknown>) =>
    request<{ run_id: string; rerun_of: string; status: string; first_handle: string | null }>(
      `/pipeline-runs/${runId}/rerun`,
      { method: 'POST', body: JSON.stringify({ input: inputOverride ?? {} }) },
    ),
  listPipelines: async (): Promise<{ pipelines: PipelineSummary[] }> => {
    const providerId = pid ?? registry.activeId() ?? 'default'
    const { pipelines } = await request<{ pipelines: unknown[] }>('/pipelines')
    return { pipelines: pipelines.map((p) => normalizePipeline(p, providerId)) }
  },
  getPipeline: async (id: string): Promise<PipelineSummary> => normalizePipeline(await request<unknown>(`/pipelines/${id}`), pid ?? registry.activeId() ?? 'default'),
  /** 建 run；批量（一文件一任务）时带 batch_id，导出可按批次还原原目录结构。 */
  runPipeline: (id: string, input: Record<string, unknown>, batchId?: string) =>
    request<PipelineRunCreated>(`/pipelines/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ input, batch_id: batchId }),
    }),
  getPipelineRun: (runId: string) => request<PipelineRun>(`/pipeline-runs/${runId}`),
  listRuns: (pipelineId?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams()
    if (pipelineId) params.set('pipeline_id', pipelineId)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return request<{ runs: RunSummary[]; total: number }>(`/pipeline-runs?${params.toString()}`)
  },
  deleteRun: (runId: string, purgeFiles = true) =>
    request<{ id: string; status: string; aborted?: boolean; files_removed?: number; bytes_freed?: number }>(
      `/pipeline-runs/${runId}?purge_files=${purgeFiles}`, { method: 'DELETE' }),
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
  /** 批量上传：目录形态（filename 携带相对路径）→ 服务端批次目录 + 文件清单。 */
  uploadFiles: (files: File[], extensions?: string): Promise<BatchUploaded> =>
    apiUploadFiles(files, extensions, pid),
  /** 压缩包上传：服务端解压 → 批次目录 + 文件清单（含被跳过的条目与原因）。 */
  uploadArchive: (file: File, extensions?: string): Promise<BatchUploaded> =>
    apiUploadArchive(file, extensions, pid),
  /** 列举服务器 DATA_DIR 内既有文件（「目录已在服务器上」形态）。 */
  listFiles: (path: string, extensions?: string, recursive = true): Promise<BatchUploaded> => {
    const params = new URLSearchParams({ path, recursive: String(recursive) })
    if (extensions) params.set('extensions', extensions)
    return request<BatchUploaded>(`/files/list?${params.toString()}`, undefined, pid)
  },
  /** 只读探测：扩展名 / PDF 页数 / 有无文字层 → 工作台据此自动选流（扫描件走图片翻译）。 */
  probeFile: (path: string): Promise<FileProbe> =>
    request<FileProbe>(`/files/probe?path=${encodeURIComponent(path)}`, undefined, pid),
  /** 批量打包下载：服务端把多个任务的产物收进一个 zip（返回 zip 路径，再走 downloadUrl 下载）。 */
  packageRuns: (runIds: string[], scope: 'final' | 'all' = 'final', name?: string): Promise<RunPackage> =>
    request<RunPackage>('/files/package', {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds, scope, name }),
    }),
  /** 批次打包下载：按上传清单还原**原目录结构**（根目录加 suffix），未处理/跳过的文件放原文件。 */
  packageBatch: (batchId: string, name?: string, suffix = '_中文'): Promise<RunPackage> =>
    request<RunPackage>('/files/package_batch', {
      method: 'POST',
      body: JSON.stringify({ batch_id: batchId, name, suffix }),
    }),
  /** 批次清单摘要（只读）：刷新后仍能显示「批次根目录名」。 */
  batchNames: (ids: string[]): Promise<{ names: Record<string, string>; count: Record<string, number> }> =>
    request<{ names: Record<string, string>; count: Record<string, number> }>(
      `/files/batches?ids=${encodeURIComponent(ids.join(','))}`),
  /** 任务产物占用报告（只读）：任务列表展示占用 / 删除前预演将释放多少空间。 */
  usageRuns: (runIds?: string[], pipelineId?: string, limit = 50): Promise<RunUsage> =>
    request<RunUsage>('/pipeline-runs/usage', {
      method: 'POST',
      body: JSON.stringify({ run_ids: runIds, pipeline_id: pipelineId, limit }),
    }),
  listKeys: () => request<{ keys: OcrKey[] }>('/keys'),
  putKey: (body: OcrKey) =>
    request<{ name: string; stored: boolean }>(`/keys/${encodeURIComponent(body.name)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteKey: (name: string) =>
    request<{ name: string; deleted: boolean }>(`/keys/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  listDbs: () => request<{ dbs: OcrDbFile[] }>('/data/dbs'),
  createPipeline: (body: PipelineDefinition) =>
    request<PipelineDefinition>('/pipelines', { method: 'POST', body: JSON.stringify(body) }),
  updatePipeline: (id: string, body: PipelineDefinition) =>
    request<PipelineDefinition>(`/pipelines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deletePipeline: (id: string) =>
    request<{ id: string; status: string }>(`/pipelines/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  downloadUrl: (path: string) => `${apiBaseOf(pid)}/files/download?path=${encodeURIComponent(path)}`,
  pageUrl: (path: string, page: number) =>
    `${apiBaseOf(pid)}/files/page?path=${encodeURIComponent(path)}&page=${page}`,
  }
}

/** 上传出站（api 工厂与页面共用）。 */
/** 批量上传/解压/列举的统一返回形态（对应 CommAND /api/files/{batch,archive,list}）。 */
export interface BatchFileEntry {
  path: string
  name: string
  rel?: string
  size: number
  /** 后端按声明分类：本轮不处理（如 PPT），入队后暂停留档 */
  skip?: boolean
  skip_reason?: string
}

export interface BatchUploaded {
  path: string
  name: string
  /** 批次号：同一次目录/压缩包上传的所有文件共享，用于按批次导出原目录结构。 */
  batch_id?: string
  count: number
  size: number
  files: BatchFileEntry[]
  /** 按声明跳过的条目（如 PPT）：仍随批次导出原文件，但本轮不翻译。 */
  skipped?: { name: string; reason: string }[]
  truncated?: boolean
}

/** 批量打包下载（对应 CommAND POST /api/files/package）。 */
export interface RunPackage {
  path: string
  name: string
  scope: string
  count: number
  runs: number
  size: number
  entries: { run_id: string; name: string; arcname: string; step?: number; size?: number }[]
  skipped: { run_id: string; reason: string }[]
  /** 仅批次导出：未翻译/暂停/跳过的文件按原文件放入（附原因）。 */
  passthrough?: { rel: string; name: string; reason: string; arcname: string }[]
  missing?: { rel: string; reason: string }[]
}

/** 任务产物占用（对应 CommAND POST /api/pipeline-runs/usage，只读）。 */
export interface RunUsage {
  runs: { run_id: string; pipeline_id: string; status: string; created_at?: string; files: number; bytes: number; dirs: number }[]
  total: { files: number; bytes: number; dirs: number }
  missing: string[]
}

async function _formPost<T>(path: string, body: FormData, pid?: string): Promise<T> {
  const response = await fetch(`${apiBaseOf(pid)}${path}`, { method: 'POST', body })
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }))
    throw new ApiError(response.status, formatDetail((detail as { detail?: unknown }).detail) || String(response.status))
  }
  return response.json() as Promise<T>
}

function apiUpload(file: File, pid?: string): Promise<FileUploaded> {
  const body = new FormData()
  body.append('file', file)
  return _formPost<FileUploaded>('/files', body, pid)
}

function apiUploadFiles(files: File[], extensions: string | undefined, pid?: string): Promise<BatchUploaded> {
  const body = new FormData()
  for (const file of files) {
    // 第三参 = multipart filename：目录上传时携带相对路径（后端据此还原目录结构）
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    body.append('files', file, rel)
  }
  const qs = extensions ? `?extensions=${encodeURIComponent(extensions)}` : ''
  return _formPost<BatchUploaded>(`/files/batch${qs}`, body, pid)
}

function apiUploadArchive(file: File, extensions: string | undefined, pid?: string): Promise<BatchUploaded> {
  const body = new FormData()
  body.append('file', file)
  const qs = extensions ? `?extensions=${encodeURIComponent(extensions)}` : ''
  return _formPost<BatchUploaded>(`/files/archive${qs}`, body, pid)
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
