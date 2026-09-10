/** ToolFace widget 注册表：schema 特征 → widget 类型（默认推导，[ui] 可覆盖）。 */

export type WidgetKind =
  | 'input'
  | 'textarea'
  | 'select'
  | 'multiSelect'
  | 'tags'
  | 'file'
  | 'number'
  | 'switch'
  | 'date'

const WIDGETS = new Set<WidgetKind>([
  'input', 'textarea', 'select', 'multiSelect', 'tags', 'file', 'number', 'switch', 'date',
])

export function isWidgetKind(value: string): value is WidgetKind {
  return WIDGETS.has(value as WidgetKind)
}

interface SchemaLike {
  type?: string
  format?: string
  enum?: unknown[]
  items?: { type?: string; enum?: unknown[] }
  maxLength?: number
}

/** 蓝图 2.2 推导表：string→Input / enum→Select / array→tags或多选 / number→InputNumber / boolean→Switch。 */
export function inferWidget(schema: SchemaLike): WidgetKind {
  if (schema.type === 'boolean') return 'switch'
  if (schema.type === 'number' || schema.type === 'integer') return 'number'
  if (schema.type === 'array') {
    if (schema.items?.enum) return 'multiSelect'
    return 'tags'
  }
  if (schema.type === 'string') {
    if (schema.enum) return 'select'
    if (schema.format === 'date') return 'date'
    if ((schema.maxLength ?? 0) > 200) return 'textarea'
    return 'input'
  }
  return 'input'
}
