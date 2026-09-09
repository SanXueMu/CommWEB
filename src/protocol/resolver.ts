/** ToolFace resolver：input_schema + [ui] 声明 → 表单字段模型。纯函数，可单测。 */

import type { UiDecl } from '@/api/types'
import { inferWidget, isWidgetKind, type WidgetKind } from './widgets'

export interface FormField {
  name: string
  label: string
  widget: WidgetKind
  required: boolean
  help?: string
  placeholder?: string
  options?: { label: string; value: unknown }[]
  defaultValue?: unknown
  isFilePath?: boolean
}

interface PropertySchema {
  type?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  items?: { type?: string; enum?: unknown[] }
  properties?: Record<string, PropertySchema>
  required?: string[]
  maxLength?: number
  format?: string
  [key: string]: unknown
}

function toOptions(values: unknown[] | undefined) {
  if (!values) return undefined
  return values.map((v) => ({ label: String(v), value: v }))
}

function flatten(
  properties: Record<string, PropertySchema>,
  required: string[],
  prefix: string,
): { name: string; schema: PropertySchema; required: boolean }[] {
  const fields: { name: string; schema: PropertySchema; required: boolean }[] = []
  for (const [key, schema] of Object.entries(properties)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (schema.type === 'object' && schema.properties) {
      fields.push(...flatten(schema.properties, schema.required ?? [], name))
    } else {
      fields.push({ name, schema, required: required.includes(key) })
    }
  }
  return fields
}

/** 解析：推导默认 widget → [ui] 覆盖 label/help/placeholder/widget → order 排序。 */
export function resolveForm(
  inputSchema: Record<string, unknown>,
  ui?: UiDecl,
  inputTypes?: string[],
): FormField[] {
  const schema = inputSchema as PropertySchema
  const properties = schema.properties ?? {}
  const required = schema.required ?? []
  const hasFileInput = (inputTypes ?? []).some((t) => t.startsWith('file.'))

  let fields = flatten(properties, required, '').map(({ name, schema, required }) => {
    const override = ui?.field?.[name]
    const widget = override?.widget && isWidgetKind(override.widget)
      ? override.widget
      : inferWidget(schema)
    return {
      name,
      label: override?.label ?? name,
      widget,
      required,
      help: override?.help ?? schema.description,
      placeholder: override?.placeholder
        ?? (hasFileInput && widget === 'input' ? '本地路径（绝对路径）' : undefined),
      options: widget === 'select' ? toOptions(schema.enum)
        : widget === 'multiSelect' ? toOptions(schema.items?.enum)
        : undefined,
      defaultValue: schema.default,
      isFilePath: hasFileInput && widget === 'input',
    }
  })

  if (ui?.order) {
    const rank = new Map(ui.order.map((name, i) => [name, i]))
    fields = [...fields].sort(
      (a, b) => (rank.get(a.name) ?? ui.order!.length) - (rank.get(b.name) ?? ui.order!.length),
    )
  }
  return fields
}
