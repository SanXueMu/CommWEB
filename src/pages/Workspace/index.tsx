/** 工作区：浏览器式多标签工作台——工具/流会话多开互不干扰，流的全控制操作面板。 */

import { useQuery } from '@tanstack/react-query'
import { Button, Card, Dropdown, Empty, Space, Spin, Tabs, Typography } from 'antd'
import { useMemo } from 'react'
import { apiFor } from '@/api/client'
import { EventStream } from '@/components/EventStream'
import { ResultRenderer } from '@/components/ResultRenderer'
import { StatusBadge } from '@/components/StatusBadge'
import { FlowRunner } from '@/components/FlowRunner'
import { ToolForm } from '@/components/ToolForm'
import { PORTAL } from '@/config/portal'
import { useWorkspace } from '@/workspace/store'
import { useActivePid } from '@/transfer/context'

export function Workspace() {
  const { tabs, activeKey, closeTab, updateTab, openTab, setActive } = useWorkspace()

  const items = useMemo(
    () =>
      tabs.map((tab) => {
        const fullLabel = `${tab.kind === 'flow' ? '⛓' : '🔧'} ${tab.title}${
          tab.providerId && tab.providerId !== 'default' ? `（${tab.providerId}）` : ''
        }`
        return {
          key: tab.key,
          label: (
            <span
              title={fullLabel}
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            >
              {tab.kind === 'flow' ? '⛓ ' : '🔧 '}
              {tab.title}
              {tab.providerId && tab.providerId !== 'default' && (
                <Typography.Text code style={{ fontSize: 10, marginLeft: 6 }}>{tab.providerId}</Typography.Text>
              )}
            </span>
          ),
          closable: true,
          children:
            tab.kind === 'tool' ? (
              <ToolSession tab={tab} update={(patch) => updateTab(tab.key, patch)} />
            ) : (
              <FlowSession tab={tab} update={(patch) => updateTab(tab.key, patch)} />
            ),
        }
      }),
    [tabs, updateTab],
  )

  return (
    <Card size="small">
      <Tabs
        type="card"
        className="workspace-tabs"
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

function OpenButton({ onOpen }: { onOpen: (tab: { kind: 'tool' | 'flow'; refId: string; title: string; providerId: string }) => void }) {
  const pid = useActivePid()
  const { data: toolsData } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() })
  const { data: flowsData } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const tools = toolsData?.tools ?? []
  const flows = flowsData?.pipelines ?? []
  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'tools',
            label: '打开工具',
            children: tools.map((t) => ({
              key: t.id,
              label: `${t.name}（${t.id}）`,
              onClick: () => onOpen({ kind: 'tool', refId: t.id, title: t.name, providerId: pid }),
            })),
          },
          {
            key: 'flows',
            label: '打开流',
            children: flows.map((p) => ({
              key: p.id,
              label: `${p.name}（${p.id}）`,
              onClick: () => onOpen({ kind: 'flow', refId: p.id, title: p.name, providerId: pid }),
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
function ToolSession({ tab, update }: { tab: { refId: string; providerId?: string; handle?: string }; update: (patch: { handle?: string }) => void }) {
  const pid = tab.providerId ?? useActivePid()
  const api = apiFor(pid)
  const { data: tool, isLoading } = useQuery({
    queryKey: ['provider', pid, 'tool', tab.refId],
    queryFn: () => api.getTool(tab.refId),
  })
  const { data: task } = useQuery({
    queryKey: ['provider', pid, 'task', tab.handle],
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
                    console.error('取消失败', err)
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

/** 流会话：FlowRunner 唯一实现，本组件只绑定工作区标签页状态。 */
function FlowSession({ tab, update }: { tab: { refId: string; title: string; providerId?: string; runId?: string }; update: (patch: { runId?: string }) => void }) {
  const pid = tab.providerId ?? useActivePid()
  const { data: flow, isLoading } = useQuery({
    queryKey: ['provider', pid, 'pipeline', tab.refId],
    queryFn: () => apiFor(pid).getPipeline(tab.refId),
  })

  if (isLoading) return <Spin />
  if (!flow) return <Typography.Text type="secondary">流不存在或已下架</Typography.Text>

  return <FlowRunner flow={flow} runId={tab.runId ?? null} onRunIdChange={(id) => update({ runId: id ?? undefined })} />
}
