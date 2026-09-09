import { useMemo } from 'react'
import { App as AntApp, Button, DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd'
import { api } from '@/api/client'
import type { ToolDetail } from '@/api/types'
import { resolveForm } from '@/protocol/resolver'

/** 自动表单：resolver 产物 → AntD 控件。工具零前端代码即得可用表单。 */
export function ToolForm({ tool, onSubmitted }: { tool: ToolDetail; onSubmitted: (handle: string) => void }) {
  const [form] = Form.useForm()
  const { message } = AntApp.useApp()
  const fields = useMemo(
    () => resolveForm(tool.manifest.io.input_schema, tool.manifest.ui, tool.manifest.io.input_types),
    [tool],
  )

  const renderControl = (widget: string, field: ReturnType<typeof resolveForm>[number]) => {
    switch (widget) {
      case 'textarea':
        return <Input.TextArea rows={4} placeholder={field.placeholder} />
      case 'select':
        return <Select options={field.options} placeholder={field.placeholder} />
      case 'multiSelect':
        return <Select mode="multiple" options={field.options} />
      case 'tags':
        return <Select mode="tags" placeholder={field.placeholder ?? '回车逐项添加'} open={false} />
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

  const valuePropName = (widget: string) => (widget === 'switch' ? 'checked' : 'value')

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        const input = Object.fromEntries(
          Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
        )
        try {
          const created = await api.createTask(tool.id, input)
          message.success(`已入队：${created.handle}`)
          onSubmitted(created.handle)
          form.resetFields()
        } catch (error) {
          message.error(`提交失败：${(error as Error).message}`)
        }
      }}
    >
      {fields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name.split('.')}
          label={field.label}
          help={field.help}
          rules={field.required ? [{ required: true, message: `${field.label} 必填` }] : undefined}
          valuePropName={valuePropName(field.widget)}
        >
          {renderControl(field.widget, field)}
        </Form.Item>
      ))}
      <Button type="primary" htmlType="submit">
        {tool.manifest.ui?.submit_label ?? '提交任务'}
      </Button>
    </Form>
  )
}
