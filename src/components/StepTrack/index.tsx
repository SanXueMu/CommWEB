/** 步骤轨道：每步最新任务状态 + 断点重跑（留档 input 为底的字段级覆盖）。 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { apiFor } from '@/api/client'
import type { RunSnapshot } from '@/api/types'
import { FieldControl, fieldPropName } from '@/components/FieldControl'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
import { resolveForm } from '@/protocol/resolver'
import { useActivePid } from '@/transfer/context'
import { Button, Card, Modal } from '@/ui'
import { Form, useForm } from '@/ui/form'

type Step = RunSnapshot['steps'][number]

function stepStatus(latest: Step['latest']): 'wait' | 'process' | 'finish' | 'error' {
  if (!latest) return 'wait'
  if (latest.status === 'succeeded') return 'finish'
  if (latest.status === 'queued' || latest.status === 'running' || latest.status === 'paused') return 'process'
  return 'error'
}

export function StepTrack({ runId, steps, runStatus }: { runId: string; steps: Step[]; runStatus: string }) {
  const [rerunStep, setRerunStep] = useState<Step | null>(null)
  const rerunnable = runStatus !== 'running'

  return (
    <div>
      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map((s) => (
          <Card key={s.step_index} className={`cw-step-${stepStatus(s.latest)}`}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.step_index}. {s.tool}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <div>
                {s.skipped ? (
                  <span style={{ color: 'var(--cw-text-muted)' }}>{PORTAL.workspace.skipped}</span>
                ) : s.latest ? (
                  <span>
                    <StatusBadge value={s.latest.status} /> · 试 {s.latest.attempt}
                  </span>
                ) : (
                  <span style={{ color: 'var(--cw-text-secondary)' }}>未开始</span>
                )}
              </div>
              {s.subrun && (
                <div style={{ marginTop: 2 }}>
                  <span style={{ color: 'var(--cw-text-secondary)' }}>{PORTAL.workspace.subrun} </span>
                  <StatusBadge value={s.subrun.status} />
                </div>
              )}
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={s.skipped || !rerunnable || (s.latest?.status ?? '') === 'queued' || (s.latest?.status ?? '') === 'running'}
                onClick={() => setRerunStep(s)}
              >
                {PORTAL.workspace.rerun}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {rerunStep && <RerunModal runId={runId} step={rerunStep} onClose={() => setRerunStep(null)} />}
    </div>
  )
}

/** 断点重跑弹窗：按步骤工具 schema 生成覆盖表单（留档 input 预填为底）。
 *  覆盖语义：填写即覆盖、留空即沿用留档值，故不设必填校验。 */
function RerunModal({ runId, step, onClose }: { runId: string; step: Step; onClose: () => void }) {
  const pid = useActivePid()
  const queryClient = useQueryClient()
  const [form] = useForm()
  const { data: tool } = useQuery({
    queryKey: ['provider', pid, 'tool', step.tool],
    queryFn: () => apiFor(pid).getTool(step.tool),
    staleTime: 60_000,
  })
  const fields = useMemo(
    () => (tool ? resolveForm(tool.manifest.io.input_schema, tool.manifest.ui) : []),
    [tool],
  )

  const submit = async (values: Record<string, unknown>) => {
    const override = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== undefined && v !== ''),
    )
    try {
      await apiFor(pid).rerunStep(runId, step.step_index, override)
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runSnapshot', runId] })
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runEvents', runId] })
      onClose()
    } catch (err) {
      console.error(String((err as Error).message ?? err))
    }
  }

  return (
    <Modal>
      <Modal.Backdrop />
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>{`${PORTAL.workspace.rerunTitle} · 第 ${step.step_index} 步`}</Modal.Header>
          <Modal.Body>
      <p style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
        留档输入（原样为底，填写即覆盖、留空即沿用）：
      </p>
      <pre style={{ background: 'var(--cw-fill)', border: '1px solid var(--cw-border)', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>
        {JSON.stringify(step.latest?.input ?? {}, null, 2)}
      </pre>
      <Form form={form} initialValues={step.latest?.input ?? {}} onFinish={submit}>
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name.split('.')}
            label={field.label}
            help={field.help}
            valuePropName={fieldPropName(field.widget)}
          >
            <FieldControl field={field} />
          </Form.Item>
        ))}
        {tool && fields.length === 0 && (
          <span style={{ color: 'var(--cw-text-secondary)' }}>该工具无可覆盖字段。</span>
        )}
      </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onClick={onClose}>取消</Button>
            <Button variant="primary" onClick={() => form.submit()}>确认重跑</Button>
          </Modal.Footer>
          <Modal.CloseTrigger />
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  )
}
