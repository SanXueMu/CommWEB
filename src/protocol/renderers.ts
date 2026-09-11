/** ToolFace 渲染器注册表：输出 JSON → 呈现形态（table / json / text）。纯函数。 */

export type RendererKind = 'table' | 'json' | 'text'

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject)
}

/** 深度探测提取表格：顶层对象数组，或对象内首个对象数组（一深度）。
 *  excludeKeys：显式跳过的键（如 splits——子表集合不得被当主表吞掉）。 */
export function extractTable(
  output: unknown,
  excludeKeys: readonly string[] = [],
): { columns: string[]; rows: Record<string, unknown>[] } | null {
  let rows: Record<string, unknown>[] | null = null
  if (isArrayOfObjects(output)) rows = output
  else if (isPlainObject(output)) {
    for (const [key, value] of Object.entries(output)) {
      if (excludeKeys.includes(key)) continue
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

/** 拆分表（视图引擎 split 段）：output.splits → [{title, columns, rows}]。
 *  引擎产出用 `key` 作分组名，故 title 缺省时回落到 key。 */
export function extractSplits(output: unknown): {
  title?: string
  columns?: string[]
  rows: Record<string, unknown>[]
}[] {
  const raw = isPlainObject(output) ? output.splits : undefined
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (s): s is Record<string, unknown> =>
        isPlainObject(s) && Array.isArray((s as Record<string, unknown>).rows),
    )
    .map((s) => ({
      title: typeof s.title === 'string' ? s.title : typeof s.key === 'string' ? s.key : undefined,
      columns: Array.isArray(s.columns) ? (s.columns as string[]) : undefined,
      rows: s.rows as Record<string, unknown>[],
    }))
}

export function detectRenderer(output: unknown): RendererKind {
  if (output == null) return 'json'
  if (typeof output === 'string') return 'text'
  if (Array.isArray(output) && output.every((v) => typeof v === 'string')) return 'text'
  if (extractTable(output)) return 'table'
  return 'json'
}

/** 待审行判定（通用数据约定，不含业务字段名）：
 *  ① 任意键名以 `_flags` 结尾且值为非空数组；② 工具声明 highlight 字段命中且真值。 */
export function rowNeedsReview(row: Record<string, unknown>, highlight?: string[]): boolean {
  if (
    Object.entries(row).some(
      ([key, value]) => key.endsWith('_flags') && Array.isArray(value) && value.length > 0,
    )
  ) {
    return true
  }
  return (highlight ?? []).some((key) => Boolean(row[key]))
}

/** 纯文本提取：数组字符串逐行，字符串整体。 */
export function extractText(output: unknown): string {
  if (Array.isArray(output)) return output.map(String).join('\n')
  return String(output)
}
