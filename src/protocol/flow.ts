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
