/** 流运行会话（唯一实现）：输入表单 → run 提交 → 控制条 + 步骤轨道 + 审计轨迹。
 *  页面（FlowDetail）与工作区（FlowSession）共用，禁止再自绘流运行 UI。 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { apiFor } from '@/api/client'
import { AuditTimeline } from '@/components/AuditTimeline'
import { FlowForm, FormBody, cascadeOf } from '@/components/FlowForm'
import { ResultRenderer } from '@/components/ResultRenderer'
import { RunControlBar } from '@/components/RunControlBar'
import { StepTrack } from '@/components/StepTrack'
import { LifeFlow } from '@/components/LifeFlow'
import type { LifeFlowNode } from '@/components/LifeFlow'
import { PORTAL } from '@/config/portal'
import { extractFlowFields } from '@/protocol/flow'
import type { FlowField } from '@/protocol/flow'
import type { FormField } from '@/protocol/resolver'
import { resolveForm } from '@/protocol/resolver'
import { useActivePid } from '@/transfer/context'
import { Button, Card, Modal } from '@/ui'
import { Form, useForm } from '@/ui/form'

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
  const [rerunOpen, setRerunOpen] = useState(false)

  /** 右侧流程栏节点：步骤工具中文名 + 运行态状态联动（无 run 时全 pending）。 */
  const flowNodes = useMemo(() => {
    const nameMap: Record<string, string> = {}
    toolQueries.forEach((q) => {
      const d = q.data as { id?: string; name?: string } | undefined
      if (d?.id) nameMap[d.id] = d.name ?? d.id
    })
    const stepStatus = (i: number): LifeFlowNode['status'] => {
      const s = snap?.steps[i]?.latest?.status
      if (s === 'succeeded') return 'done'
      if (s === 'running') return 'running'
      if (s === 'failed') return 'error'
      return 'pending'
    }
    return flow.steps.map((s, i) => ({
      key: `${i}`,
      label: (s.tool && nameMap[s.tool]) || s.tool || s.pipeline || `步骤 ${i + 1}`,
      status: stepStatus(i),
    }))
  }, [flow.steps, toolQueries, snap])

  /** 被 steps 模板引用的 input 键集合（{{input.xxx}}），用于表单字段提示。 */
  const refKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const step of flow.steps) {
      for (const m of JSON.stringify(step.input ?? {}).matchAll(/\{\{\s*input\.(\w+)\s*\}\}/g)) keys.add(m[1])
    }
    return keys
  }, [flow.steps])

  if (!runId) {
    return <FlowForm flow={flow} fields={formFields} providerId={pid} refKeys={refKeys} onRun={(id) => onRunIdChange(id)} />
  }

  const status = snap?.run.status ?? 'running'
  const rerunnable = status !== 'running' && status !== 'paused'
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
        <RunControlBar runId={runId} status={status} onNewRound={() => onRunIdChange(null)} />
        <div>
          <Button size="sm" isDisabled={!rerunnable} onClick={() => setRerunOpen(true)}>
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
          <span style={{ color: 'var(--cw-warning)', fontSize: 12 }}>
            {PORTAL.workspace.pausedHint}
          </span>
        )}
        {snap?.run.status === 'failed' && snap.run.error != null ? (
          <div role="alert" style={{ color: 'var(--cw-danger)', padding: 8 }}>{PORTAL.flowFailedPrefix}{String((snap.run.error as { message?: unknown })?.message ?? '')}</div>
        ) : null}
        {snap && <StepTrack runId={runId} steps={snap.steps} runStatus={status} />}
        {snap?.run.status === 'succeeded' && snap.steps.at(-1)?.latest?.output != null && (
          <Card>
            <strong style={{ display: 'block', marginBottom: 8 }}>最终输出</strong>
            <ResultRenderer output={snap.steps.at(-1)!.latest!.output!} />
          </Card>
        )}
        <AuditTimeline runId={runId} />
      </div>
      <aside style={{ width: 220, flexShrink: 0, position: 'sticky', top: 76, borderLeft: '1px solid var(--cw-border)', paddingLeft: 16 }}>
        <span style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
          {PORTAL.workspace.flowOutline}
        </span>
        <div style={{ marginTop: 12 }}>
          <LifeFlow nodes={flowNodes} direction="vertical" size="md" />
        </div>
      </aside>
    </div>
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
  const [form] = useForm()
  const [submitting, setSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const submit = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const created = await apiFor(providerId).rerunRun(runId, values)
      queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'runSnapshot', created.run_id] })
      console.info(`${PORTAL.workspace.rerunFlowSuccessPrefix}${created.run_id.slice(0, 14)}…`)
      onRerun(created.run_id)
    } catch (err) {
      console.error(`重跑失败：${(err as Error).message ?? err}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={open}>
      <Modal.Backdrop />
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>{PORTAL.workspace.rerunFlowTitle}</Modal.Header>
          <Modal.Body>
      <p style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
        {PORTAL.workspace.rerunFlowHint}
      </p>
      <Form form={form} initialValues={lastInput} onFinish={submit}>
        <FormBody fields={fields} cascade={cascadeOf(inputSchema)} providerId={providerId} />
      </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline" onClick={onClose}>取消</Button>
            <Button variant="primary" isDisabled={submitting} onClick={() => form.submit()}>{PORTAL.workspace.rerunFlowOk}</Button>
          </Modal.Footer>
          <Modal.CloseTrigger />
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  )
}
