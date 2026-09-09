/** ToolFace 渲染器注册表：输出 JSON → 呈现形态（table / json / text）。纯函数。 */

export type RendererKind = 'table' | 'json' | 'text'

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject)
}

/** 提取表格：顶层对象数组，或对象内首个对象数组（一深度探测）。 */
export function extractTable(output: unknown): { columns: string[]; rows: Record<string, unknown>[] } | null {
  let rows: Record<string, unknown>[] | null = null
  if (isArrayOfObjects(output)) rows = output
  else if (isPlainObject(output)) {
    for (const value of Object.values(output)) {
      if (isArrayOfObjects(value)) {
        rows = value
        break
      }
    }
  }
  if (!rows) return null
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return { columns, rows }
}

export function detectRenderer(output: unknown): RendererKind {
  if (output == null) return 'json'
  if (typeof output === 'string') return 'text'
  if (Array.isArray(output) && output.every((v) => typeof v === 'string')) return 'text'
  if (extractTable(output)) return 'table'
  return 'json'
}

/** 质检高亮：行内含 review_flags 非空或 review_ 前缀真值字段 → 待审行。 */
export function rowNeedsReview(row: Record<string, unknown>): boolean {
  if (Array.isArray(row.review_flags) && row.review_flags.length > 0) return true
  return Object.entries(row).some(
    ([key, value]) => key.startsWith('review_') && Boolean(value),
  )
}

/** 纯文本提取：数组字符串逐行，字符串整体。 */
export function extractText(output: unknown): string {
  if (Array.isArray(output)) return output.map(String).join('\n')
  return String(output)
}
