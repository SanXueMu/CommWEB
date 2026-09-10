/** 步骤轨道：每步最新任务状态 + 断点重跑（留档 input 为底的字段级覆盖）。 */

import { useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Steps, Typography, message } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import type { RunSnapshot } from '@/api/types'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL } from '@/config/portal'
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
                {s.latest ? (
                  <span>
                    <StatusBadge value={s.latest.status} /> · 试 {s.latest.attempt}
                  </span>
                ) : (
                  <Typography.Text type="secondary">未开始</Typography.Text>
                )}
              </div>
              <Button
                size="small"
                style={{ marginTop: 4 }}
                disabled={!rerunnable || (s.latest?.status ?? '') === 'queued' || (s.latest?.status ?? '') === 'running'}
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

function RerunModal({ runId, step, onClose }: { runId: string; step: Step; onClose: () => void }) {
  const pid = useActivePid()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const submit = async (values: { override?: string }) => {
    let override: Record<string, unknown> | undefined
    if (values.override?.trim()) {
      try {
        override = JSON.parse(values.override)
      } catch {
        message.error('覆盖 JSON 解析失败')
        return
      }
    }
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
        留档输入（原样为底）：
      </Typography.Paragraph>
      <pre style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>
        {JSON.stringify(step.latest?.input ?? {}, null, 2)}
      </pre>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="override" label="字段覆盖">
          <Input.TextArea
            rows={3}
            placeholder={PORTAL.workspace.overridePlaceholder}
            style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
