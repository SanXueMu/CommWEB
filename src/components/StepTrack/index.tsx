/** 步骤轨道：每步最新任务状态 + 断点重跑（留档 input 为底的字段级覆盖）。 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Modal, Steps, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { api, apiFor } from '@/api/client'
import type { RunSnapshot } from '@/api/types'
import { FieldControl, fieldPropName } from '@/components/FieldControl'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
import { resolveForm } from '@/protocol/resolver'
import { useActivePid } from '@/transfer/context'

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
      <Steps
        size="small"
        items={steps.map((s) => ({
          title: (
            <span style={{ fontSize: 13 }}>
              {s.step_index}. {s.tool}
            </span>
          ),
          status: stepStatus(s.latest),
          description: (
            <div style={{ fontSize: 12 }}>
              <div>
                {s.skipped ? (
                  <Typography.Text type="secondary" style={{ color: '#bfbfbf' }}>
                    {PORTAL.workspace.skipped}
                  </Typography.Text>
                ) : s.latest ? (
                  <span>
                    <StatusBadge value={s.latest.status} /> · 试 {s.latest.attempt}
                  </span>
                ) : (
                  <Typography.Text type="secondary">未开始</Typography.Text>
                )}
              </div>
              {s.subrun && (
                <div style={{ marginTop: 2 }}>
                  <Typography.Text type="secondary">{PORTAL.workspace.subrun} </Typography.Text>
                  <StatusBadge value={s.subrun.status} />
                </div>
              )}
              <Button
                size="small"
                style={{ marginTop: 4 }}
                disabled={s.skipped || !rerunnable || (s.latest?.status ?? '') === 'queued' || (s.latest?.status ?? '') === 'running'}
                onClick={() => setRerunStep(s)}
              >
                {PORTAL.workspace.rerun}
              </Button>
            </div>
          ),
        }))}
      />
      {rerunStep && <RerunModal runId={runId} step={rerunStep} onClose={() => setRerunStep(null)} />}
    </div>
  )
}

/** 断点重跑弹窗：按步骤工具 schema 生成覆盖表单（留档 input 预填为底）。
 *  覆盖语义：填写即覆盖、留空即沿用留档值，故不设必填校验。 */
function RerunModal({ runId, step, onClose }: { runId: string; step: Step; onClose: () => void }) {
  const pid = useActivePid()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
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
      await api.rerunStep(runId, step.step_index, override)
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runSnapshot', runId] })
      queryClient.invalidateQueries({ queryKey: ['provider', pid, 'runEvents', runId] })
      onClose()
    } catch (err) {
      message.error(String((err as Error).message ?? err))
    }
  }

  return (
    <Modal
      open
      title={`${PORTAL.workspace.rerunTitle} · 第 ${step.step_index} 步`}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        留档输入（原样为底，填写即覆盖、留空即沿用）：
      </Typography.Paragraph>
      <pre style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>
        {JSON.stringify(step.latest?.input ?? {}, null, 2)}
      </pre>
      <Form form={form} layout="vertical" initialValues={step.latest?.input ?? {}} onFinish={submit}>
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
          <Typography.Text type="secondary">该工具无可覆盖字段。</Typography.Text>
        )}
      </Form>
    </Modal>
  )
}
