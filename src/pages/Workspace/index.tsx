/** 工作区：浏览器式多标签工作台——工具/流会话多开互不干扰，流的全控制操作面板。 */

import { useQuery } from '@tanstack/react-query'
import { Button, Card } from '@/ui'
import { useMemo, useState } from 'react'
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
                <code style={{ fontSize: 10, marginLeft: 6 }}>{tab.providerId}</code>
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
    <Card>
      <div className="workspace-tabs" style={{ display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto', paddingBottom: 12 }}>
        {items.map((item) => <button key={item.key} type="button" onClick={() => setActive(item.key)} style={{ border: '1px solid var(--cw-border)', background: item.key === activeKey ? 'var(--cw-surface-raised)' : 'transparent', padding: '6px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{item.label} <span onClick={(event) => { event.stopPropagation(); closeTab(item.key) }}>×</span></button>)}
        <OpenButton onOpen={openTab} />
      </div>
      {items.length ? items.find((item) => item.key === activeKey)?.children : <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--cw-text-secondary)' }}>{PORTAL.empty.workspace}</div>}
    </Card>
  )
}

function OpenButton({ onOpen }: { onOpen: (tab: { kind: 'tool' | 'flow'; refId: string; title: string; providerId: string }) => void }) {
  const [open, setOpen] = useState(false)
  const pid = useActivePid()
  const { data: toolsData } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() })
  const { data: flowsData } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const tools = toolsData?.tools ?? []
  const flows = flowsData?.pipelines ?? []
  return <div style={{ position: 'relative' }}><Button size="sm" onClick={() => setOpen((value) => !value)}>＋ 打开</Button>{open && <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 5, background: 'var(--cw-surface)', border: '1px solid var(--cw-border)', padding: 8, minWidth: 220 }}>{[['工具', tools, 'tool'], ['流', flows, 'flow']].map(([label, values, kind]) => <div key={String(label)}><strong>{label as string}</strong>{(values as Array<{ id: string; name: string }>).map((item) => <button key={item.id} type="button" style={{ display: 'block', width: '100%', textAlign: 'left', padding: 6, border: 0, background: 'transparent' }} onClick={() => { onOpen({ kind: kind as 'tool' | 'flow', refId: item.id, title: item.name, providerId: pid }); setOpen(false) }}>{item.name}（{item.id}）</button>)}</div>)}</div>}</div>
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

  if (isLoading) return <div role="status">加载中...</div>
  if (!tool) return <span style={{ color: 'var(--cw-text-secondary)' }}>工具不存在或已下架</span>

  return (
    <div style={{ maxWidth: 860 }}>
      {tab.handle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge value={task?.status ?? 'queued'} />
            <code style={{ fontSize: 12 }}>
              {tab.handle}
            </code>
              <Button size="sm" onClick={() => update({ handle: undefined })}>
              再次提交
            </Button>
            {task && ['queued', 'running'].includes(task.status) && (
              <Button
                size="sm"
                variant="danger"
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
          </div>
          {task && <EventStream handle={tab.handle} />}
          {task?.status === 'succeeded' && task.output != null && (
            <Card><strong style={{ display: 'block', marginBottom: 8 }}>结果</strong>
              <ResultRenderer output={task.output} highlight={tool.manifest.ui?.render?.highlight} />
            </Card>
          )}
        </div>
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

  if (isLoading) return <div role="status">加载中...</div>
  if (!flow) return <span style={{ color: 'var(--cw-text-secondary)' }}>流不存在或已下架</span>

  return <FlowRunner flow={flow} runId={tab.runId ?? null} onRunIdChange={(id) => update({ runId: id ?? undefined })} />
}
