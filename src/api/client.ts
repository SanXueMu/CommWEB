/** CommAND API typed 客户端——本项目唯一出站通道，不含任何 UI 知识。 */

import type {
  FileUploaded,
  OcrDbFile,
  OcrKey,
  PipelineDefinition,
  BatchInfo,
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

export class ApiError extends Error {
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
  /** 批次失败项一键重跑：给 run_ids 或 batch_id（服务端取该批次内失败态 run）。 */
  rerunRuns: (body: { run_ids?: string[]; batch_id?: string }): Promise<{
    count: number
    rerun: { from: string; to: string }[]
    skipped: { run_id: string; reason: string }[]
  }> => request('/pipeline-runs/rerun-batch', { method: 'POST', body: JSON.stringify(body) }),
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
  /** 某批次的全部 run：循环分页取全（单页 1000 上限是窗口，批内 run 可超过它）。 */
  listAllRuns: async (batchId: string): Promise<RunSummary[]> => {
    const out: RunSummary[] = []
    for (let offset = 0; ; offset += 1000) {
      const params = new URLSearchParams({ batch_id: batchId, limit: '1000', offset: String(offset) })
      const page = await request<{ runs: RunSummary[]; total: number }>(`/pipeline-runs?${params.toString()}`)
      out.push(...page.runs)
      if (out.length >= page.total || page.runs.length === 0) break
    }
    return out
  },
  listRuns: (pipelineId?: string, limit = 50, offset = 0, batchId?: string) => {
    const params = new URLSearchParams()
    if (pipelineId) params.set('pipeline_id', pipelineId)
    if (batchId) params.set('batch_id', batchId)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    return request<{ runs: RunSummary[]; total: number }>(`/pipeline-runs?${params.toString()}`)
  },
  /** 替换任务原件（如 .doc 另存为 .docx）：落盘同批次目录 + 更新批次清单 + 更新 run.input.file。 */
  replaceRunFile: (runId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return _formPost<{ run_id: string; file: string; replaced: string; manifest_updated: boolean }>(
      `/pipeline-runs/${runId}/replace-file`, form, pid,
    )
  },
  /** 就地修正任务参数（密钥名/模型等）后继续或重跑；换文件用 replaceRunFile。 */
  patchRunInput: (runId: string, input: Record<string, unknown>) =>
    request<{ run_id: string; input: Record<string, unknown> }>(
      `/pipeline-runs/${runId}/input`, { method: 'PATCH', body: JSON.stringify({ input }) },
    ),
  /** 可重跑清单（服务端按**整个批次**聚合）：从未成功过且最新一次失败的文件。 */
  rerunnableRuns: (params: { batch_id?: string; flow_ids?: string[]; limit?: number }) => {
    const q = new URLSearchParams()
    if (params.batch_id) q.set('batch_id', params.batch_id)
    if (params.flow_ids?.length) q.set('flow_ids', params.flow_ids.join(','))
    if (params.limit) q.set('limit', String(params.limit))
    return request<{
      count: number
      run_ids: string[]
      files: { file: string; name: string; run_id: string; status: string; error?: string | null }[]
      /** 已有成功译文的文件（据此把「重跑」置灰，与是否还有失败尝试无关） */
      done_files?: string[]
    }>(`/pipeline-runs/rerunnable?${q.toString()}`)
  },
  deleteRun: (runId: string, purgeFiles = true) =>
    request<{ id: string; status: string; aborted?: boolean; files_removed?: number; bytes_freed?: number; removed_failed_attempts?: { id: string; status: string }[] }>(
      `/pipeline-runs/${runId}?purge_files=${purgeFiles}`, { method: 'DELETE' }),
  deleteOcrDb: (path: string, force = false) =>
    request<{ removed: string[]; forced?: boolean; references?: number }>(
      `/data/dbs?path=${encodeURIComponent(path)}${force ? '&force=true' : ''}`, { method: 'DELETE' }),
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
  listUploads: () =>
    request<{ uploads: { dir: string; date: string; label: string; path: string; count: number; size: number; source: string; batch_id?: string; runs: { count: number; latest_status: string | null } }[] }>('/files/uploads'),
  deleteUploads: (roots: string[]) =>
    request<{ removed: string[] }>('/files/uploads', { method: 'DELETE', body: JSON.stringify({ roots }) }),
  /** AN：某批次目录的文件明细——从「已上传原件」选文件复用，免重新上传。 */
  listUploadFiles: (dir: string) =>
    request<{ dir: string; root: string; count: number; files: UploadFileItem[] }>(
      `/files/uploads/files?dir=${encodeURIComponent(dir)}`),
  uploadFiles: (files: File[], extensions?: string, skip?: string[], source?: string,
    onProgress?: (loaded: number, total: number) => void,
    registerXhr?: (xhr: XMLHttpRequest) => void): Promise<BatchUploaded> =>
    apiUploadFiles(files, extensions, skip, pid, source, onProgress, registerXhr),
  /** 压缩包上传：服务端解压 → 批次目录 + 文件清单（含被跳过的条目与原因）。 */
  uploadArchive: (file: File, extensions?: string, skip?: string[], source?: string,
    onProgress?: (loaded: number, total: number) => void,
    registerXhr?: (xhr: XMLHttpRequest) => void): Promise<BatchUploaded> =>
    apiUploadArchive(file, extensions, skip, pid, source, onProgress, registerXhr),
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
  /** 全部批次（无窗口）：批次下拉以此为准，不再从「最新 N 条 run」反推。 */
  allBatches: (flowIds?: string[]): Promise<{ batches: BatchInfo[] }> =>
    request<{ batches: BatchInfo[] }>(
      `/files/batches${flowIds?.length ? `?flow_ids=${encodeURIComponent(flowIds.join(','))}` : ''}`),
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
  /** 0 字节空文件：跳过且**不建任务**（与 skip 区分） */
  empty?: boolean
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

/** AN：上传批次目录内的单个文件（path 可直接作管线 file 入参）。 */
export interface UploadFileItem {
  rel: string
  name: string
  path: string
  size: number
}

/** 任务产物占用（对应 CommAND POST /api/pipeline-runs/usage，只读）。 */
export interface RunUsage {  runs: { run_id: string; pipeline_id: string; status: string; created_at?: string; files: number; bytes: number; dirs: number }[]
  total: { files: number; bytes: number; dirs: number }
  missing: string[]
}

/** AH2：带上传进度的 form POST（fetch 无上传进度事件，用 XHR）——仅上传类请求用。 */
function _formPostProgress<T>(path: string, body: FormData, pid: string | undefined,
                              onProgress?: (loaded: number, total: number) => void,
                              registerXhr?: (xhr: XMLHttpRequest) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiBaseOf(pid)}${path}`)
    xhr.responseType = 'json'
    if (onProgress) {
      xhr.upload.onprogress = (e) => onProgress(e.loaded, e.total)
    }
    // AH2+：注册 xhr 引用供「取消上传」（abort 后 here 抛「已取消」，网络故障仍报上传中断）
    registerXhr?.(xhr)
    xhr.onabort = () => reject(new Error('已取消上传'))
    xhr.onerror = () => reject(new Error('网络错误（上传中断）'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as T)
      else {
        const detail = (xhr.response as { detail?: unknown } | null)?.detail
        reject(new ApiError(xhr.status, formatDetail(detail) || String(xhr.status)))
      }
    }
    xhr.send(body)
  })
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

function _batchQuery(extensions?: string, skip?: string[]): string {
  const params = new URLSearchParams()
  if (extensions) params.set('extensions', extensions)
  // 声明驱动的「跳过类型」（如 PPT）：交服务端打标（留档 + 不建任务），不在前端偷偷丢掉
  if (skip?.length) params.set('skip', skip.join(','))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function _batchQuery2(extensions?: string, skip?: string[], source?: string): string {
  const qs = _batchQuery(extensions, skip)
  const extra = source ? (qs ? '&' : '?') + `source=${encodeURIComponent(source)}` : ''
  return qs + extra
}

function apiUploadFiles(files: File[], extensions: string | undefined,
                        skip: string[] | undefined, pid?: string,
                        source?: string,
                        onProgress?: (loaded: number, total: number) => void,
                        registerXhr?: (xhr: XMLHttpRequest) => void): Promise<BatchUploaded> {
  const body = new FormData()
  for (const file of files) {
    // 第三参 = multipart filename：目录上传时携带相对路径（后端据此还原目录结构）
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    body.append('files', file, rel)
  }
  return _formPostProgress<BatchUploaded>(`/files/batch${_batchQuery2(extensions, skip, source)}`, body, pid, onProgress, registerXhr)
}

function apiUploadArchive(file: File, extensions: string | undefined,
                          skip: string[] | undefined, pid?: string,
                          source?: string,
                          onProgress?: (loaded: number, total: number) => void,
                          registerXhr?: (xhr: XMLHttpRequest) => void): Promise<BatchUploaded> {
  const body = new FormData()
  body.append('file', file)
  return _formPostProgress<BatchUploaded>(`/files/archive${_batchQuery2(extensions, skip, source)}`, body, pid, onProgress, registerXhr)
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
