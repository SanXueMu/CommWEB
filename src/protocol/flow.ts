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
}

/**
 * 流输入字段推导：key 出现顺序 + 首个引用它的步骤工具的 input_schema 定类型。
 * array → tags（回车逐项），file 特征 → 单行路径，其余 → 多行文本。
 */
export function extractFlowFields(
  steps: { tool: string; input: Record<string, unknown> }[],
  toolSchemas: Record<string, { properties?: Record<string, { type?: string; format?: string }> }>,
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
    if (schema?.type === 'array') return { key, widget: 'tags' as const }
    if (FILE_FIELD_RE.test(key) || schema?.format === 'file') return { key, widget: 'file' as const }
    return { key, widget: 'text' as const }
  })
}
