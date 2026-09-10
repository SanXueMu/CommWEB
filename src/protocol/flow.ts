/** 流输入模板工具：steps 模板 → 顶层 input 键提取（FlowDetail 与工作区 FlowSession 共用）。 */

export function extractInputKeys(steps: { input: Record<string, unknown> }[]): string[] {
  const keys: string[] = []
  for (const step of steps) {
    for (const template of Object.values(step.input)) {
      const text = String(template ?? '')
      for (const match of text.matchAll(/\{\{\s*input\.(\w+)\s*\}\}/g)) {
        if (!keys.includes(match[1])) keys.push(match[1])
      }
    }
  }
  return keys
}

export const FILE_FIELD_RE = /file|path|文档|文件/

export type FlowFieldWidget = 'text' | 'tags' | 'file'

export interface FlowField {
  key: string
  widget: FlowFieldWidget
  title?: string
}

/**
 * 流输入字段推导：key 出现顺序 + 首个引用它的步骤工具的 input_schema 定类型。
 * array → tags（回车逐项），file 特征 → 文件上传，其余 → 多行文本。
 * schema.title 透传（中文 label 来源之一，与 resolver 的 title 优先级一致）。
 */
export function extractFlowFields(
  steps: { tool: string; input: Record<string, unknown> }[],
  toolSchemas: Record<string, { properties?: Record<string, { type?: string; format?: string; title?: string }> }>,
): FlowField[] {
  const keys = extractInputKeys(steps)
  const firstToolByKey: Record<string, string> = {}
  for (const step of steps) {
    for (const template of Object.values(step.input)) {
      const text = String(template ?? '')
      for (const match of text.matchAll(/\{\{\s*input\.(\w+)\s*\}\}/g)) {
        if (!firstToolByKey[match[1]]) firstToolByKey[match[1]] = step.tool
      }
    }
  }
  return keys.map((key) => {
    const schema = toolSchemas[firstToolByKey[key]]?.properties?.[key]
    const title = typeof schema?.title === 'string' ? schema.title : undefined
    if (schema?.type === 'array') return { key, widget: 'tags' as const, title }
    if (FILE_FIELD_RE.test(key) || schema?.format === 'file') return { key, widget: 'file' as const, title }
    return { key, widget: 'text' as const, title }
  })
}
