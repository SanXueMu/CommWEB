/** 字段控件渲染件：widget → HeroUI/native 控件唯一映射。
 *  ToolForm / FlowRunner / RerunModal 等一切表单共用，禁止再手写控件 switch。 */

import { FileUpload } from '@/components/FileUpload'
import { PORTAL } from '@/config/portal'
import type { FormField } from '@/protocol/resolver'
import { Input } from '@/ui'

/** Form.Item 的 valuePropName 约定：switch 用 checked，其余 value。 */
export const fieldPropName = (widget: FormField['widget']) =>
  widget === 'switch' ? 'checked' : 'value'

export function FieldControl({ field }: { field: FormField }) {
  switch (field.widget) {
    case 'textarea':
      return <textarea rows={4} placeholder={field.placeholder} style={controlStyle} />
    case 'select':
      return <select defaultValue="" style={controlStyle}>
        <option value="" disabled>{field.placeholder ?? '请选择'}</option>
        {(field.options ?? []).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
      </select>
    case 'multiSelect':
      return <select multiple style={{ ...controlStyle, minHeight: 84 }}>
        {(field.options ?? []).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
      </select>
    case 'tags':
      return <Input placeholder={field.placeholder ?? PORTAL.form.tagsPlaceholder} />
    case 'file':
      return <FileUpload />
    case 'number':
      return <Input type="number" />
    case 'switch':
      return <input type="checkbox" />
    case 'date':
      return <Input type="date" />
    default:
      return <Input placeholder={field.placeholder} />
  }
}

const controlStyle = {
  background: 'var(--cw-surface)',
  border: '1px solid var(--cw-border)',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
  color: 'var(--cw-text)',
  font: 'inherit',
  padding: '8px 10px',
  width: '100%',
}
