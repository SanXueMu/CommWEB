import { useMemo, useState } from 'react'
import { App as AntApp, Button, Form } from 'antd'
import { api } from '@/api/client'
import type { ToolDetail } from '@/api/types'
import { FieldControl, fieldPropName } from '@/components/FieldControl'
import { PORTAL } from '@/config/portal'
import { cachedResolveForm } from '@/protocol/resolver'

/** 自动表单：resolver 产物 → FieldControl 控件。工具零前端代码即得可用表单。 */
export function ToolForm({ tool, onSubmitted }: { tool: ToolDetail; onSubmitted: (handle: string) => void }) {
  const [form] = Form.useForm()
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const fields = useMemo(
    () => cachedResolveForm(tool.manifest.io.input_schema, tool.manifest.ui, tool.manifest.io.input_types),
    [tool],
  )

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        const input = Object.fromEntries(
          Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
        )
        setSubmitting(true)
        try {
          const created = await api.createTask(tool.id, input)
          message.success(`已入队：${created.handle}`)
          onSubmitted(created.handle)
          form.resetFields()
        } catch (error) {
          message.error(`提交失败：${(error as Error).message}`)
        } finally {
          setSubmitting(false)
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
          valuePropName={fieldPropName(field.widget)}
        >
          <FieldControl field={field} />
        </Form.Item>
      ))}
      <Button type="primary" htmlType="submit" loading={submitting}>
        {tool.manifest.ui?.submit_label ?? PORTAL.run.submit}
      </Button>
    </Form>
  )
}
