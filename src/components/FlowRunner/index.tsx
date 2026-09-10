/** 流运行会话（唯一实现）：输入表单 → run 提交 → 控制条 + 步骤轨道 + 审计轨迹。
 *  页面（FlowDetail）与工作区（FlowSession）共用，禁止再自绘流运行 UI。 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Alert, Button, Card, Form, Input, Select, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { apiFor } from '@/api/client'
import { AuditTimeline } from '@/components/AuditTimeline'
import { FileUpload } from '@/components/FileUpload'
import { ResultRenderer } from '@/components/ResultRenderer'
import { RunControlBar } from '@/components/RunControlBar'
import { StepTrack } from '@/components/StepTrack'
import { PORTAL } from '@/config/portal'
import { extractFlowFields } from '@/protocol/flow'
import { useActivePid } from '@/transfer/context'

interface FlowLike {
  id: string
  name: string
  steps: { tool: string; input: Record<string, unknown> }[]
}

export function FlowRunner({ flow, runId, onRunIdChange, providerId }: {
  flow: FlowLike
  runId: string | null | undefined
  onRunIdChange: (runId: string | null) => void
  providerId?: string
}) {
  const pid = providerId ?? useActivePid()
  const toolIds = useMemo(() => [...new Set(flow.steps.map((s) => s.tool))], [flow.steps])
  const toolQueries = useQueries({
    queries: toolIds.map((id) => ({ queryKey: ['provider', pid, 'tool', id], queryFn: () => apiFor(pid).getTool(id), staleTime: 60_000 })),
  })
  const schemaMap = useMemo(() => {
    const map: Record<string, Record<string, unknown>> = {}
    toolQueries.forEach((q) => {
      if (q.data) map[q.data.id] = (q.data as { manifest: { io: { input_schema: Record<string, unknown> } } }).manifest.io.input_schema
    })
    return map
  }, [toolQueries])
  const fields = useMemo(() => extractFlowFields(flow.steps, schemaMap as never), [flow.steps, schemaMap])

  const { data: snap } = useQuery({
    queryKey: ['provider', pid, 'runSnapshot', runId],
    queryFn: () => apiFor(pid).getRunSnapshot(runId!),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status
      return status && ['running', 'paused'].includes(status) ? 2000 : false
    },
  })

  if (!runId) {
    return <FlowRunForm flow={flow} fields={fields} providerId={pid} onRun={(id) => onRunIdChange(id)} />
  }

  const status = snap?.run.status ?? 'running'
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <RunControlBar runId={runId} status={status} onNewRound={() => onRunIdChange(null)} />
      {status === 'paused' && (
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          {PORTAL.workspace.pausedHint}
        </Typography.Text>
      )}
      {snap?.run.status === 'failed' && snap.run.error != null ? (
        <Alert type="error" showIcon message={`${PORTAL.flowFailedPrefix}${String((snap.run.error as { message?: unknown })?.message ?? '')}`} />
      ) : null}
      {snap && <StepTrack runId={runId} steps={snap.steps} runStatus={status} />}
      {snap?.run.status === 'succeeded' && snap.steps.at(-1)?.latest?.output != null && (
        <Card size="small" title="最终输出">
          <ResultRenderer output={snap.steps.at(-1)!.latest!.output!} />
        </Card>
      )}
      <AuditTimeline runId={runId} />
    </Space>
  )
}

function FlowRunForm({ flow, fields, providerId, onRun }: {
  flow: FlowLike
  fields: { key: string; widget: 'text' | 'tags' | 'file' }[]
  providerId: string
  onRun: (runId: string) => void
}) {
  const pid = providerId
  const [form] = Form.useForm()
  const { message } = AntApp.useApp()
  const [runSubmitting, setRunSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const submit = async (values: Record<string, unknown>) => {
    setRunSubmitting(true)
    try {
      const created = await apiFor(pid).runPipeline(flow.id, values)
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runSnapshot', created.run_id] })
      onRun(created.run_id)
    } catch (err) {
      message.error(`提交失败：${(err as Error).message ?? err}`)
    } finally {
      setRunSubmitting(false)
    }
  }

  return (
    <Card size="small" title={`运行 ${flow.name}（${flow.steps.length} 步）`}>
      <Form form={form} layout="vertical" onFinish={submit} style={{ maxWidth: 560 }}>
        {fields.map((field) => (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.key}
            rules={field.widget === 'file' ? [] : [{ required: true, message: `请填写 ${field.key}` }]}
          >
            {field.widget === 'file' ? (
              <FileUpload />
            ) : field.widget === 'tags' ? (
              <Select mode="tags" open={false} placeholder={PORTAL.form.tagsPlaceholder} style={{ width: '100%' }} />
            ) : (
              <Input.TextArea rows={2} placeholder={`{{ input.${field.key} }}`} />
            )}
          </Form.Item>
        ))}
        {fields.length === 0 && (
          <Typography.Text type="secondary">该管线不引用任何 input 参数。</Typography.Text>
        )}
        <Button type="primary" htmlType="submit" loading={runSubmitting}>
          {PORTAL.run.submit}
        </Button>
      </Form>
    </Card>
  )
}
