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

/** 类型匹配（兼容 JSON Schema 联合类型，如 ["boolean","null"]——可空参数已普遍化）。 */
export function schemaIs(schema: SchemaLike, kind: string): boolean {
  return Array.isArray(schema.type) ? schema.type.includes(kind) : schema.type === kind
}

/** 蓝图 2.2 推导表：string→Input / enum→Select / array→tags或多选 / number→InputNumber / boolean→Switch。 */
export function inferWidget(schema: SchemaLike): WidgetKind {
  if (schemaIs(schema, 'boolean')) return 'switch'
  if (schemaIs(schema, 'number') || schemaIs(schema, 'integer')) return 'number'
  if (schemaIs(schema, 'array')) {
    if (schema.items?.enum) return 'multiSelect'
    return 'tags'
  }
  if (schemaIs(schema, 'string')) {
    if (schema.enum) return 'select'
    if (schema.format === 'date') return 'date'
    if (schema.format === 'file') return 'file'
    if ((schema.maxLength ?? 0) > 200) return 'textarea'
    return 'input'
  }
  return 'input'
}
