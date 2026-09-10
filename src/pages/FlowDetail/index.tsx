/** 流工作台：步骤链总览 + 自动运行表单（模板键 → 字段；file 键 → 上传组件）+ 运行跟踪。 */

import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Form, Input, Space, Spin, Steps, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { PipelineRun } from '@/api/types'
import { FileUpload } from '@/components/FileUpload'
import { DocPanel } from '@/components/DocPanel'
import { StatusBadge } from '@/components/StatusBadge'

import { FILE_FIELD_RE, extractInputKeys } from '@/protocol/flow'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'

export function FlowDetail() {
  const { id = '' } = useParams()
  const [form] = Form.useForm()
  const [runId, setRunId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { data: flow, isLoading, error } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: () => api.getPipeline(id),
  })

  const { data: runDetail } = useQuery({
    queryKey: ['pipeline-run', runId],
    queryFn: () => api.getPipelineRun(runId!),
    enabled: runId !== null,
    refetchInterval: (query) => {
      const status = (query.state.data as PipelineRun | undefined)?.run.status
      return status === 'succeeded' || status === 'failed' ? false : 2000
    },
  })

  useEffect(() => {
    if (runDetail?.run.status === 'failed') {
      message.error(`流运行失败：${runDetail.run.error?.message ?? ''}`)
    }
  }, [runDetail?.run.status, runDetail?.run.error])

  const inputKeys = useMemo(
    () => (flow ? extractInputKeys(flow.steps) : []),
    [flow],
  )

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  if (error || !flow) return <Typography.Text type="danger">流加载失败：{(error as Error)?.message ?? id}</Typography.Text>

  const tasksByStep = new Map((runDetail?.tasks ?? []).map((t) => [t.step_index, t]))
  const run = runDetail?.run

  const submit = async (values: Record<string, string>) => {
    setSubmitting(true)
    try {
      const created = await api.runPipeline(flow.id, values)
      message.success(`已提交：${created.run_id}`)
      setRunId(created.run_id)
    } catch (err) {
      message.error(`提交失败：${(err as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small">
        <Space direction="vertical" size={4}>
          <Space size={8}>
            <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} />
            <Typography.Title level={4} style={{ margin: 0 }}>{flow.name}</Typography.Title>
            <Tag color="purple">{flow.id}</Tag>
            <Tag>{flow.steps.length} 步</Tag>
          </Space>
          {run && (
            <Descriptions size="small" column={3} style={{ marginTop: 8 }}>
              <Descriptions.Item label="运行 ID"><code>{run.id}</code></Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusBadge value={run.status} />
              </Descriptions.Item>
              <Descriptions.Item label="完成">{run.finished_at?.slice(0, 19) ?? '—'}</Descriptions.Item>
            </Descriptions>
          )}
          {run?.status === 'failed' && run.error && (
            <Alert type="error" showIcon message={run.error.message} style={{ marginTop: 8 }} />
          )}
        </Space>
      </Card>

      <Card size="small" title="步骤链（每步一个工具任务，可逐步追踪）">
        <Steps
          direction="vertical"
          size="small"
          current={run ? currentStepIndex(runDetail!.tasks) : -1}
          status={run?.status === 'failed' ? 'error' : run?.status === 'succeeded' ? 'finish' : 'process'}
          items={flow.steps.map((step, index) => {
            const task = tasksByStep.get(index)
            return {
              title: `${index + 1}. ${step.tool}`,
              description: task
                ? `${task.status}${task.error ? ` · ${task.error.message.slice(0, 80)}` : ''}${
                    task.output?.path ? ` · 产物 ${task.output.path}` : ''
                  }`
                : '等待上游',
            }
          })}
        />
      </Card>

      <DocPanel docMd={flow.doc_md} />

      <Card size="small" title="运行（表单由管线模板自动生成）">
        <Form form={form} layout="vertical" onFinish={submit}>
          {inputKeys.map((key) => (
            <Form.Item
              key={key}
              name={key}
              label={key}
              rules={FILE_FIELD_RE.test(key) ? [] : [{ required: true, message: `请填写 ${key}` }]}
            >
              {FILE_FIELD_RE.test(key) ? (
                <FileUpload />
              ) : (
                <Input placeholder={`{{ input.${key} }}`} />
              )}
            </Form.Item>
          ))}
          {inputKeys.length === 0 && (
            <Typography.Text type="secondary">该管线不引用任何 input 参数。</Typography.Text>
          )}
          <Button type="primary" htmlType="submit" loading={submitting} disabled={run?.status === 'running'}>
            提交运行
          </Button>
        </Form>
      </Card>
    </Space>
  )
}

function currentStepIndex(tasks: PipelineRun['tasks']): number {
  const active = tasks.find((t) => t.status === 'running' || t.status === 'queued')
  if (active) return active.step_index
  const done = tasks.filter((t) => t.status === 'succeeded')
  return done.length ? done.length : 0
}
