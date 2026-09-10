/** 字段控件渲染件：widget → AntD 控件唯一映射。
 *  ToolForm / FlowRunner / RerunModal 等一切表单共用，禁止再手写控件 switch。 */

import { DatePicker, Input, InputNumber, Select, Switch } from 'antd'
import { FileUpload } from '@/components/FileUpload'
import { PORTAL } from '@/config/portal'
import type { FormField } from '@/protocol/resolver'

/** Form.Item 的 valuePropName 约定：switch 用 checked，其余 value。 */
export const fieldPropName = (widget: FormField['widget']) =>
  widget === 'switch' ? 'checked' : 'value'

export function FieldControl({ field }: { field: FormField }) {
  switch (field.widget) {
    case 'textarea':
      return <Input.TextArea rows={4} placeholder={field.placeholder} />
    case 'select':
      return <Select options={field.options} placeholder={field.placeholder} />
    case 'multiSelect':
      return <Select mode="multiple" options={field.options} />
    case 'tags':
      return <Select mode="tags" placeholder={field.placeholder ?? PORTAL.form.tagsPlaceholder} open={false} />
    case 'file':
      return <FileUpload />
    case 'number':
      return <InputNumber style={{ width: '100%' }} />
    case 'switch':
      return <Switch />
    case 'date':
      return <DatePicker style={{ width: '100%' }} />
    default:
      return <Input placeholder={field.placeholder} />
  }
}
