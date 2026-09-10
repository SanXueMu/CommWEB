/** 工作区：浏览器式多标签工作台——工具/流会话多开互不干扰，流的全控制操作面板。 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntApp, Button, Card, Dropdown, Empty, Form, Input, Space, Spin, Tabs, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { api } from '@/api/client'
import { AuditTimeline } from '@/components/AuditTimeline'
import { EventStream } from '@/components/EventStream'
import { ResultRenderer } from '@/components/ResultRenderer'
import { RunControlBar } from '@/components/RunControlBar'
import { StatusBadge } from '@/components/StatusBadge'
import { StepTrack } from '@/components/StepTrack'
import { ToolForm } from '@/components/ToolForm'
import { PORTAL } from '@/config/portal'
import { FILE_FIELD_RE, extractInputKeys } from '@/protocol/flow'
import { useWorkspace } from '@/workspace/store'

export function Workspace() {
  const { tabs, activeKey, closeTab, updateTab, openTab, setActive } = useWorkspace()

  const items = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        label: (
          <span>
            {tab.kind === 'flow' ? '⛓ ' : '🔧 '}
            {tab.title}
          </span>
        ),
        closable: true,
        children:
          tab.kind === 'tool' ? (
            <ToolSession tab={tab} update={(patch) => updateTab(tab.key, patch)} />
          ) : (
            <FlowSession tab={tab} update={(patch) => updateTab(tab.key, patch)} />
          ),
      })),
    [tabs, updateTab],
  )

  return (
    <Card size="small">
      <Tabs
        type="card"
        activeKey={activeKey}
        items={items.length ? items : undefined}
        onChange={setActive}
        onEdit={(key, action) => {
          if (action === 'remove' && typeof key === 'string') closeTab(key)
        }}
        tabBarExtraContent={<OpenButton onOpen={openTab} />}
        destroyOnHidden
      />
      {items.length === 0 && (
        <Empty description={PORTAL.empty.workspace} style={{ padding: '48px 0' }} />
      )}
    </Card>
  )
}

function OpenButton({ onOpen }: { onOpen: (tab: { kind: 'tool' | 'flow'; refId: string; title: string }) => void }) {
  const { data: tools } = useQuery({ queryKey: ['tools'], queryFn: api.listTools })
  const { data: flows } = useQuery({ queryKey: ['pipelines'], queryFn: api.listPipelines })
  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'tools',
            label: '打开工具',
            children: (tools?.tools ?? []).map((t) => ({
              key: t.id,
              label: `${t.name}（${t.id}）`,
              onClick: () => onOpen({ kind: 'tool', refId: t.id, title: t.name }),
            })),
          },
          {
            key: 'flows',
            label: '打开流',
            children: (flows?.pipelines ?? []).map((p) => ({
              key: p.id,
              label: `${p.name}（${p.id}）`,
              onClick: () => onOpen({ kind: 'flow', refId: p.id, title: p.name }),
            })),
          },
        ],
      }}
    >
      <Button size="small">＋ 打开</Button>
    </Dropdown>
  )
}

/** 工具会话：表单提交 → tab 内联事件流 + 结果渲染。 */
function ToolSession({ tab, update }: { tab: { refId: string; handle?: string }; update: (patch: { handle?: string }) => void }) {
  const { data: tool, isLoading } = useQuery({
    queryKey: ['tool', tab.refId],
    queryFn: () => api.getTool(tab.refId),
  })
  const { data: task } = useQuery({
    queryKey: ['task', tab.handle],
    queryFn: () => api.getTask(tab.handle!),
    enabled: Boolean(tab.handle),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && ['queued', 'running'].includes(status) ? 1500 : false
    },
  })

  if (isLoading) return <Spin />
  if (!tool) return <Typography.Text type="secondary">工具不存在或已下架</Typography.Text>

  return (
    <div style={{ maxWidth: 860 }}>
      {tab.handle ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space>
            <StatusBadge value={task?.status ?? 'queued'} />
            <Typography.Text code style={{ fontSize: 12 }}>
              {tab.handle}
            </Typography.Text>
            <Button size="small" onClick={() => update({ handle: undefined })}>
              再次提交
            </Button>
            {task && ['queued', 'running'].includes(task.status) && (
              <Button
                size="small"
                danger
                onClick={async () => {
                  try {
                    await api.cancelTask(tab.handle!)
                  } catch (err) {
                    message.error(String((err as Error).message ?? err))
                  }
                }}
              >
                {PORTAL.workspace.abort}
              </Button>
            )}
          </Space>
          {task && <EventStream handle={tab.handle} />}
          {task?.status === 'succeeded' && task.output != null && (
            <Card size="small" title="结果">
              <ResultRenderer output={task.output} highlight={tool.manifest.ui?.render?.highlight} />
            </Card>
          )}
        </Space>
      ) : (
        <ToolForm tool={tool} onSubmitted={(handle) => update({ handle })} />
      )}
    </div>
  )
}

/** 流会话：输入表单 → run 提交 → snapshot 轮询 + 控制条 + 步骤轨道 + 审计。 */
function FlowSession({ tab, update }: { tab: { refId: string; title: string; runId?: string }; update: (patch: { runId?: string }) => void }) {
  const { data: flow, isLoading } = useQuery({
    queryKey: ['pipeline', tab.refId],
    queryFn: () => api.getPipeline(tab.refId),
  })
  const { data: snap } = useQuery({
    queryKey: ['runSnapshot', tab.runId],
    queryFn: () => api.getRunSnapshot(tab.runId!),
    enabled: Boolean(tab.runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status
      return status && ['running', 'paused'].includes(status) ? 2000 : false
    },
  })

  if (isLoading) return <Spin />
  if (!flow) return <Typography.Text type="secondary">流不存在或已下架</Typography.Text>

  if (!tab.runId) {
    return <FlowRunForm flow={flow} onRun={(runId) => update({ runId })} />
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <RunControlBar
          runId={tab.runId}
          status={snap?.run.status ?? 'running'}
          onNewRound={() => update({ runId: undefined })}
        />
        {snap?.run.status === 'paused' && (
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            {PORTAL.workspace.pausedHint}
          </Typography.Text>
        )}
        {snap && <StepTrack runId={tab.runId} steps={snap.steps} runStatus={snap.run.status} />}
        {snap?.run.status === 'succeeded' &&
          snap.steps.at(-1)?.latest?.output != null && (
            <Card size="small" title="最终输出">
              <ResultRenderer output={snap.steps.at(-1)!.latest!.output!} />
            </Card>
          )}
        <AuditTimeline runId={tab.runId} />
      </Space>
    </div>
  )
}

function FlowRunForm({ flow, onRun }: { flow: { id: string; name: string; steps: { tool: string; input: Record<string, unknown> }[] }; onRun: (runId: string) => void }) {
  const [form] = Form.useForm()
  const { message } = AntApp.useApp()
  const [runSubmitting, setRunSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const inputKeys = useMemo(() => extractInputKeys(flow.steps), [flow.steps])

  const submit = async (values: Record<string, unknown>) => {
    setRunSubmitting(true)
    try {
      const created = await api.runPipeline(flow.id, values)
      queryClient.invalidateQueries({ queryKey: ['runSnapshot', created.run_id] })
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
        {inputKeys.map((key) => (
          <Form.Item
            key={key}
            name={key}
            label={key}
            rules={FILE_FIELD_RE.test(key) ? [] : [{ required: true, message: `请填写 ${key}` }]}
          >
            {FILE_FIELD_RE.test(key) ? <Input placeholder={PORTAL.form.filePathPlaceholder} /> : <Input.TextArea rows={2} />}
          </Form.Item>
        ))}
        <Button type="primary" htmlType="submit" loading={runSubmitting}>
          {PORTAL.run.submit}
        </Button>
      </Form>
    </Card>
  )
}
