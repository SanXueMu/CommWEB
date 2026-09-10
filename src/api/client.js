/** CommAND API typed 客户端——本项目唯一出站通道，不含任何 UI 知识。 */
import { registry } from '@/transfer/registry';
import { normalizePipeline, normalizeStatuses, normalizeTask, normalizeToolDetail, normalizeToolSummary } from '@/transfer/translator';
/** 出站基址解析：显式 pid 优先，缺省跟随活跃会员。 */
function apiBaseOf(pid) {
    return registry.baseUrlOf(pid ?? pid ?? registry.activeId() ?? 'default');
}
class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function formatDetail(detail) {
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((e) => {
            const item = e;
            const loc = (item.loc ?? []).filter((x) => x !== 'body').join('.');
            return loc ? `${loc}: ${item.msg ?? ''}` : (item.msg ?? '');
        })
            .join('；');
    }
    return JSON.stringify(detail);
}
async function request(path, init, pid) {
    const response = await fetch(`${apiBaseOf(pid)}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: response.statusText }));
        throw new ApiError(response.status, formatDetail(detail.detail) || String(response.status));
    }
    return response.json();
}
function createApi(pid) {
    return {
        /** 通用 GET（协议面端点如 /meta/site，由 Transfer 解析层使用）。 */
        get: (path) => request(path, undefined, pid),
        getStatuses: async () => ({ statuses: normalizeStatuses((await request('/meta/statuses')).statuses) }),
        listTools: async () => {
            const providerId = pid ?? registry.activeId() ?? 'default';
            const { tools } = await request('/tools');
            return { tools: tools.map((t) => normalizeToolSummary(t, providerId)) };
        },
        getTool: async (id) => normalizeToolDetail(await request(`/tools/${id}`), pid ?? registry.activeId() ?? 'default'),
        createTask: (tool, input) => request('/tasks', { method: 'POST', body: JSON.stringify({ tool, input }) }),
        getTask: async (handle) => normalizeTask(await request(`/tasks/${handle}`), pid ?? registry.activeId() ?? 'default'),
        cancelTask: (handle) => request(`/tasks/${handle}/cancel`, { method: 'POST' }),
        listTasks: (status) => request(`/tasks${status ? `?status=${status}` : ''}`),
        listPipelines: async () => {
            const providerId = pid ?? registry.activeId() ?? 'default';
            const { pipelines } = await request('/pipelines');
            return { pipelines: pipelines.map((p) => normalizePipeline(p, providerId)) };
        },
        getPipeline: async (id) => normalizePipeline(await request(`/pipelines/${id}`), pid ?? registry.activeId() ?? 'default'),
        runPipeline: (id, input) => request(`/pipelines/${id}/run`, {
            method: 'POST',
            body: JSON.stringify({ input }),
        }),
        getPipelineRun: (runId) => request(`/pipeline-runs/${runId}`),
        getRunSnapshot: (runId) => request(`/pipeline-runs/${runId}/snapshot`),
        listRunEvents: (runId, limit = 200) => request(`/pipeline-runs/${runId}/events?limit=${limit}`),
        pauseRun: (runId) => request(`/pipeline-runs/${runId}/pause`, { method: 'POST' }),
        resumeRun: (runId) => request(`/pipeline-runs/${runId}/resume`, { method: 'POST' }),
        abortRun: (runId) => request(`/pipeline-runs/${runId}/abort`, { method: 'POST' }),
        abortStep: (runId, stepIndex) => request(`/pipeline-runs/${runId}/steps/${stepIndex}/abort`, { method: 'POST' }),
        rerunStep: (runId, stepIndex, override) => request(`/pipeline-runs/${runId}/steps/${stepIndex}/rerun`, {
            method: 'POST',
            body: JSON.stringify({ override: override ?? null }),
        }),
        uploadFile: (file) => apiUpload(file, pid),
        listKeys: () => request('/keys'),
        putKey: (body) => request(`/keys/${encodeURIComponent(body.name)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
        deleteKey: (name) => request(`/keys/${encodeURIComponent(name)}`, { method: 'DELETE' }),
        listDbs: () => request('/data/dbs'),
        createPipeline: (body) => request('/pipelines', { method: 'POST', body: JSON.stringify(body) }),
        updatePipeline: (id, body) => request(`/pipelines/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
        deletePipeline: (id) => request(`/pipelines/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        downloadUrl: (path) => `${apiBaseOf(pid)}/files/download?path=${encodeURIComponent(path)}`,
    };
}
/** 上传出站（api 工厂与页面共用）。 */
function apiUpload(file, pid) {
    const body = new FormData();
    body.append('file', file);
    return fetch(`${apiBaseOf(pid)}/files`, { method: 'POST', body }).then(async (response) => {
        if (!response.ok) {
            const detail = await response.json().catch(() => ({ detail: response.statusText }));
            throw new ApiError(response.status, formatDetail(detail.detail) || String(response.status));
        }
        return response.json();
    });
}
/** 活跃会员视图（页面级跟随切换）。 */
export const api = createApi();
/** 会员绑定视图（工作区 tab 级：出站固定，切换全局不影响已开 tab）。 */
export function apiFor(pid) {
    return createApi(pid);
}
/** SSE 订阅：log/progress/artifact 逐事件回调，done 后自动关闭。 */
export function streamTaskEvents(handle, handlers, pid) {
    const source = new EventSource(`${apiBaseOf(pid)}/tasks/${handle}/events`);
    const parse = (e) => {
        const raw = JSON.parse(e.data);
        return { id: Number(e.lastEventId), type: e.type, data: raw.data, created_at: raw.created_at };
    };
    for (const type of ['log', 'progress', 'artifact']) {
        source.addEventListener(type, (e) => handlers.onEvent?.(parse(e)));
    }
    source.addEventListener('done', (e) => {
        handlers.onDone?.(JSON.parse(e.data));
        source.close();
    });
    source.onerror = (e) => {
        if (source.readyState === EventSource.CLOSED)
            return;
        handlers.onError?.(e);
    };
    return () => source.close();
}
