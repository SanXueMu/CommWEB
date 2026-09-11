/** 流运行会话（唯一实现）：输入表单 → run 提交 → 控制条 + 步骤轨道 + 审计轨迹。
 *  页面（FlowDetail）与工作区（FlowSession）共用，禁止再自绘流运行 UI。 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Alert, Button, Card, Form, Modal, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { apiFor } from '@/api/client'
import { AuditTimeline } from '@/components/AuditTimeline'
import { FlowForm, FormBody, cascadeOf } from '@/components/FlowForm'
import { ResultRenderer } from '@/components/ResultRenderer'
import { RunControlBar } from '@/components/RunControlBar'
import { StepTrack } from '@/components/StepTrack'
import { PORTAL } from '@/config/portal'
import { extractFlowFields } from '@/protocol/flow'
import type { FlowField } from '@/protocol/flow'
import type { FormField } from '@/protocol/resolver'
import { resolveForm } from '@/protocol/resolver'
import { useActivePid } from '@/transfer/context'

interface FlowLike {
  id: string
  name: string
  steps: { tool?: string; pipeline?: string; input: Record<string, unknown> }[]
  /** 06 三.1/10b：流级 input_schema 存在时表单走声明驱动，不再猜键。 */
  input_schema?: Record<string, unknown> | null
}

export function FlowRunner({ flow, runId, onRunIdChange, providerId }: {
  flow: FlowLike
  runId: string | null | undefined
  onRunIdChange: (runId: string | null) => void
  providerId?: string
}) {
  const pid = providerId ?? useActivePid()
  const toolIds = useMemo(() => [...new Set(flow.steps.map((s) => s.tool).filter((x): x is string => Boolean(x)))], [flow.steps])
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
  const fields = useMemo<FlowField[]>(() => {
    if (flow.input_schema?.properties) {
      // 10b：流级 input_schema 声明驱动（resolveForm 已含 title 中文化与 [ui] 覆盖）
      return resolveForm(flow.input_schema as never).map((f) => ({
        key: f.name,
        title: f.label,
        widget: f.widget === 'tags' ? ('tags' as const) : f.widget === 'file' ? ('file' as const) : ('text' as const),
      }))
    }
    return extractFlowFields(flow.steps as never, schemaMap as never) // v1 回退：猜键
  }, [flow.input_schema, flow.steps, schemaMap])
  const formFields = useMemo<FormField[]>(
    () =>
      fields.map((f) => ({
        name: f.key,
        label: f.title ?? f.key,
        widget: f.widget === 'text' ? 'textarea' : f.widget,
        required: f.widget !== 'file',
        placeholder: f.widget === 'text' ? `{{ input.${f.key} }}` : undefined,
      })),
    [fields],
  )

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
    return <FlowForm flow={flow} fields={formFields} providerId={pid} onRun={(id) => onRunIdChange(id)} />
  }

  const status = snap?.run.status ?? 'running'
  const [rerunOpen, setRerunOpen] = useState(false)
  const rerunnable = status !== 'running' && status !== 'paused'
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <RunControlBar runId={runId} status={status} onNewRound={() => onRunIdChange(null)} />
      <div>
        <Button size="small" disabled={!rerunnable} onClick={() => setRerunOpen(true)}>
          {PORTAL.workspace.rerunFlowFull}
        </Button>
      </div>
      <RerunFlowModal
        open={rerunOpen}
        fields={formFields}
        inputSchema={flow.input_schema}
        lastInput={snap?.run.input ?? {}}
        providerId={pid}
        runId={runId}
        onClose={() => setRerunOpen(false)}
        onRerun={(newRunId) => { setRerunOpen(false); onRunIdChange(newRunId) }}
      />
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

function RerunFlowModal({ open, fields, inputSchema, lastInput, providerId, runId, onClose, onRerun }: {
  open: boolean
  fields: FormField[]
  inputSchema?: Record<string, unknown> | null
  lastInput: Record<string, unknown>
  providerId: string
  runId: string
  onClose: () => void
  onRerun: (newRunId: string) => void
}) {
  const [form] = Form.useForm()
  const { message } = AntApp.useApp()
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const submit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const created = await apiFor(providerId).rerunRun(runId, values)
      queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'runSnapshot', created.run_id] })
      message.success(`${PORTAL.workspace.rerunFlowSuccessPrefix}${created.run_id.slice(0, 14)}…`)
      onRerun(created.run_id)
    } catch (err) {
      message.error(`重跑失败：${(err as Error).message ?? err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={PORTAL.workspace.rerunFlowTitle}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText={PORTAL.workspace.rerunFlowOk}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {PORTAL.workspace.rerunFlowHint}
      </Typography.Paragraph>
      <Form form={form} layout="vertical" initialValues={lastInput} onFinish={submit}>
        <FormBody fields={fields} cascade={cascadeOf(inputSchema)} providerId={providerId} />
      </Form>
    </Modal>
  )
}





