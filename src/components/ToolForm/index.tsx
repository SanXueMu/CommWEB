import { useMemo, useState } from 'react'
import { App as AntApp, Button, Form } from 'antd'
import type { FormInstance } from 'antd'
import { api } from '@/api/client'
import type { ToolDetail } from '@/api/types'
import { FieldControl, fieldPropName } from '@/components/FieldControl'
import { PORTAL } from '@/config/portal'
import { cachedResolveForm } from '@/protocol/resolver'

/** 自动表单：resolver 产物 → FieldControl 控件。工具零前端代码即得可用表单。
 *  外控：form 实例可外传（详情弹窗底部统一运行按钮触发提交）；showSubmit=false 隐藏内置按钮。 */
export function ToolForm({ tool, onSubmitted, form: externalForm, showSubmit = true, onSubmittingChange }: {
  tool: ToolDetail
  onSubmitted: (handle: string) => void
  form?: FormInstance
  showSubmit?: boolean
  onSubmittingChange?: (submitting: boolean) => void
}) {
  const [internalForm] = Form.useForm()
  const form = externalForm ?? internalForm
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const fields = useMemo(
    () => cachedResolveForm(tool.manifest.io.input_schema, tool.manifest.ui, tool.manifest.io.input_types),
    [tool],
  )

  const setBusy = (busy: boolean) => {
    setSubmitting(busy)
    onSubmittingChange?.(busy)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        const input = Object.fromEntries(
          Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
        )
        setBusy(true)
        try {
          const created = await api.createTask(tool.id, input)
          message.success(`${PORTAL.run.queued}${created.handle}`)
          onSubmitted(created.handle)
          form.resetFields()
        } catch (error) {
          message.error(`${PORTAL.run.submitFailed}${(error as Error).message}`)
        } finally {
          setBusy(false)
        }
      }}
    >
      {fields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name.split('.')}
          label={field.label}
          help={field.help}
          rules={field.required ? [{ required: true, message: `${field.label} ${PORTAL.run.requiredSuffix}` }] : undefined}
          valuePropName={fieldPropName(field.widget)}
        >
          <FieldControl field={field} />
        </Form.Item>
      ))}
      {showSubmit && (
        <Button type="primary" htmlType="submit" loading={submitting}>
          {tool.manifest.ui?.submit_label ?? PORTAL.run.submit}
        </Button>
      )}
    </Form>
  )
}
