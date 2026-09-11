/** 流运行表单（FlowRunner 与详情弹窗共用，B4/D 收编）：级联表单体 + 提交动作。
 *  form 可外控（showSubmit=false 时由外部底部按钮触发 form.submit()）。 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Button, Form, Select } from 'antd'
import type { FormInstance } from 'antd'
import { useMemo, useState } from 'react'
import { apiFor } from '@/api/client'
import { FieldControl, fieldPropName } from '@/components/FieldControl'
import { PORTAL } from '@/config/portal'
import type { FormField } from '@/protocol/resolver'
import { resolveForm } from '@/protocol/resolver'

/** I2 级联表单协议：流 input_schema 顶层 x-form-cascade 声明（键字段 → 列表/详情端点 → 增量 schema）。 */
export interface FormCascade {
  keyField: string
  listPath: string
  detailPath: string
  schemaFrom: string
}

interface TemplateBrief {
  id: string
  name?: string | null
  enabled?: boolean
}

export function cascadeOf(schema?: Record<string, unknown> | null): FormCascade | null {
  const c = schema?.['x-form-cascade'] as FormCascade | undefined
  return c && c.keyField && c.listPath && c.detailPath && c.schemaFrom ? c : null
}

/** 级联表单体（发起/重跑共用）：公共字段 + 键字段下拉（选模版）→ 详情端点增量字段。 */
export function FormBody({ fields, cascade, providerId, refKeys }: {
  fields: FormField[]
  cascade: FormCascade | null
  providerId: string
  /** 被 steps args 模板引用的 input 键集合；命中的字段显示自动注入提示。 */
  refKeys?: Set<string>
}) {
  const form = Form.useFormInstance()
  const templateId = Form.useWatch(cascade?.keyField ?? '__none__', form) as string | undefined
  const listQuery = useQuery({
    queryKey: ['provider', providerId, 'cascadeList', cascade?.listPath],
    queryFn: () => apiFor(providerId).get<{ templates: TemplateBrief[] }>(cascade!.listPath),
    enabled: Boolean(cascade),
  })
  const detailQuery = useQuery({
    queryKey: ['provider', providerId, 'cascadeDetail', cascade?.detailPath, templateId],
    queryFn: () =>
      apiFor(providerId).get<Record<string, unknown>>(
        cascade!.detailPath.replace('{id}', encodeURIComponent(templateId!)),
      ),
    enabled: Boolean(cascade && templateId),
  })
  const extraFields = useMemo<FormField[]>(() => {
    if (!cascade || !detailQuery.data) return []
    const schema = detailQuery.data[cascade.schemaFrom] as Record<string, unknown> | null | undefined
    return schema?.properties ? resolveForm(schema as never) : []
  }, [cascade, detailQuery.data])

  const base = cascade ? fields.filter((f) => f.name !== cascade.keyField) : fields
  const keyField = cascade ? fields.find((f) => f.name === cascade.keyField) : undefined
  const renderItem = (f: FormField) => (
    <Form.Item
      key={f.name}
      name={f.name}
      label={f.label}
      initialValue={f.defaultValue}
      rules={f.required ? [{ required: true, message: `请填写 ${f.label}` }] : undefined}
      valuePropName={fieldPropName(f.widget)}
      extra={refKeys?.has(f.name) ? PORTAL.workspace.refHint.replace('{key}', f.name) : undefined}
    >
      <FieldControl field={f} />
    </Form.Item>
  )
  return (
    <>
      {keyField && (
        <Form.Item
          name={keyField.name}
          label={keyField.label}
          rules={keyField.required ? [{ required: true, message: `请选择 ${keyField.label}` }] : undefined}
        >
          <Select
            loading={listQuery.isLoading}
            showSearch
            optionFilterProp="label"
            placeholder="选择后表单自动适配（提示词/字段/钩子随模版）"
            options={(listQuery.data?.templates ?? []).map((tpl) => ({
              value: tpl.id,
              label: `${tpl.name ?? tpl.id}（${tpl.id}）`,
              disabled: tpl.enabled === false,
            }))}
          />
        </Form.Item>
      )}
      {base.map(renderItem)}
      {extraFields.map(renderItem)}
    </>
  )
}

export function FlowForm({ flow, fields, providerId, form: externalForm, showSubmit = true, refKeys, onRun, onSubmittingChange }: {
  flow: { id: string; name: string; steps: unknown[] }
  fields: FormField[]
  providerId: string
  form?: FormInstance<Record<string, unknown>>
  showSubmit?: boolean
  refKeys?: Set<string>
  onRun: (runId: string) => void
  onSubmittingChange?: (v: boolean) => void
}) {
  const [internalForm] = Form.useForm<Record<string, unknown>>()
  const form = externalForm ?? internalForm
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const submit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const created = await apiFor(providerId).runPipeline(flow.id, values)
      queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'runSnapshot', created.run_id] })
      onRun(created.run_id)
    } catch (err) {
      message.error(`提交失败：${(err as Error).message ?? err}`)
    } finally {
      setSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 560 }}>
      <FormBody fields={fields} cascade={cascadeOf((flow as { input_schema?: Record<string, unknown> | null }).input_schema)} providerId={providerId} refKeys={refKeys} />
      {showSubmit && (
        <Button type="primary" htmlType="submit" loading={submitting}>
          {PORTAL.run.submit}
        </Button>
      )}
    </Form>
  )
}
