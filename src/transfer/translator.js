/** 翻译（入站归一）：会员原始响应 → 渲染中心标准模型。
 *  字段补默认 / 版本抹平 / providerId 溯源——渲染中心从此不感知会员差异。 */
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asObject(value) {
    return (value && typeof value === 'object' ? value : {});
}
/** 工具摘要：tags 补默认、能力字段容错。 */
export function normalizeToolSummary(raw, pid) {
    const tool = asObject(raw);
    return { ...tool, tags: asArray(tool.tags), providerId: pid };
}
/** 工具详情：manifest 三段容错（io/runtime/resources/ui/doc_md）。 */
export function normalizeToolDetail(raw, pid) {
    const tool = asObject(raw);
    const manifest = asObject(tool.manifest);
    return {
        ...tool,
        tags: asArray(tool.tags),
        providerId: pid,
        manifest: {
            ...manifest,
            tool: { ...manifest.tool, tags: asArray(manifest.tool?.tags) },
            doc_md: manifest.doc_md ?? null,
            ui: asObject(manifest.ui),
            runtime: asObject(manifest.runtime),
            resources: asObject(manifest.resources),
        },
    };
}
/** 任务：错误对象容错。 */
export function normalizeTask(raw, pid) {
    const task = asObject(raw);
    return { ...task, providerId: pid, error: (task.error ?? null) };
}
/** 状态目录：完整形状保底。 */
export function normalizeStatuses(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((item) => {
        const s = asObject(item);
        return { value: String(s.value), label: s.label || s.value, group: s.group || 'other', terminal: Boolean(s.terminal) };
    });
}
/** 流摘要：steps 数组容错。 */
export function normalizePipeline(raw, pid) {
    const flow = asObject(raw);
    return { ...flow, steps: asArray(flow.steps), doc_md: flow.doc_md ?? null, providerId: pid };
}
