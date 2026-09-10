/** 翻译（入站归一）：会员原始响应 → 渲染中心标准模型。
 *  字段补默认 / 版本抹平 / providerId 溯源——渲染中心从此不感知会员差异。 */

import type { PipelineSummary, StatusInfo, Task, ToolDetail, ToolSummary } from '@/api/types'

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asObject<T extends object>(value: unknown): T {
  return (value && typeof value === 'object' ? value : {}) as T
}

/** 工具摘要：tags 补默认、能力字段容错。 */
export function normalizeToolSummary(raw: unknown, pid: string): ToolSummary {
  const tool = asObject<ToolSummary & Record<string, unknown>>(raw)
  return { ...tool, tags: asArray<string>(tool.tags), providerId: pid }
}

/** 工具详情：manifest 三段容错（io/runtime/resources/ui/doc_md）。 */
export function normalizeToolDetail(raw: unknown, pid: string): ToolDetail {
  const tool = asObject<ToolDetail & Record<string, unknown>>(raw)
  const manifest = asObject<ToolDetail['manifest']>(tool.manifest)
  return {
    ...tool,
    tags: asArray<string>(tool.tags),
    providerId: pid,
    manifest: {
      ...manifest,
      tool: { ...manifest.tool, tags: asArray<string>(manifest.tool?.tags) },
      doc_md: manifest.doc_md ?? null,
      ui: asObject<NonNullable<ToolDetail['manifest']['ui']>>(manifest.ui),
      runtime: asObject(manifest.runtime),
      resources: asObject(manifest.resources),
    },
  }
}

/** 任务：错误对象容错。 */
export function normalizeTask(raw: unknown, pid: string): Task {
  const task = asObject<Task & Record<string, unknown>>(raw)
  return { ...task, providerId: pid, error: (task.error ?? null) as Task['error'] }
}

/** 状态目录：完整形状保底。 */
export function normalizeStatuses(raw: unknown): StatusInfo[] {
  const list = Array.isArray(raw) ? raw : []
  return list.map((item) => {
    const s = asObject<StatusInfo>(item)
    return { value: String(s.value), label: s.label || s.value, group: s.group || 'other', terminal: Boolean(s.terminal) }
  })
}

/** 流摘要：steps 数组容错。 */
export function normalizePipeline(raw: unknown, pid: string): PipelineSummary {
  const flow = asObject<PipelineSummary & Record<string, unknown>>(raw)
  return { ...flow, steps: asArray<PipelineSummary['steps'][number]>(flow.steps), doc_md: flow.doc_md ?? null, providerId: pid }
}
