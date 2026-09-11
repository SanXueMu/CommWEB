/** 工具域行/卡渲染器：v3 槽位 list.panel 以名引用（tool-card / tool-row）。
 * 联动优先级：context.onItemClick（弹窗语义）优先，缺省回落详情路由 Link。 */

import { Link } from 'react-router-dom'
import { Typography } from 'antd'
import { ProviderBadge } from '@/components/ProviderBadge'
import { CatalogBadge } from '@/components/CatalogBadge'
import { DisabledBadge } from '@/components/DisabledBadge'
import { LifeFlow } from '@/components/LifeFlow'
import { PanelCard } from '@/components/ui/PanelCard'
import type { ToolSummary } from '@/api/types'
import { registerRenderer } from '@/protocol/slotTemplates'

/** 数据转化生命周期：输入类型 → 输出类型的横向流线。 */
export function ToolLifeFlow({ tool, size = 'sm' }: { tool: ToolSummary; size?: 'sm' | 'md' | 'lg' }) {
  const nodes = [...tool.input_types, ...tool.output_types].map((label) => ({ key: label, label }))
  return <LifeFlow nodes={nodes} size={size} direction="horizontal" />
}

function ToolLink({ tool, children }: { tool: ToolSummary; children: React.ReactNode }) {
  return <Link to={`/tools/${tool.id}`}>{children}</Link>
}

export function ToolCard({ tool, onOpen }: { tool: ToolSummary; onOpen?: () => void }) {
  const off = tool.enabled === false
  const body = (
    <PanelCard radius="round">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Typography.Text strong>{tool.name}</Typography.Text>
        {off && <DisabledBadge />}
        <ProviderBadge pid={tool.providerId ?? 'default'} />
      </div>
      <div style={{ margin: '10px 0' }}>
        <ToolLifeFlow tool={tool} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(tool.tags ?? []).map((t) => (
          <CatalogBadge key={t} value={t} catalog={new Map()} fallback="auto" size="sm" plain radius="round" />
        ))}
      </div>
    </PanelCard>
  )
  const styled = <div style={{ opacity: off ? 0.55 : 1 }}>{body}</div>
  return onOpen ? <div onClick={onOpen} style={{ cursor: 'pointer' }}>{styled}</div> : <ToolLink tool={tool}>{styled}</ToolLink>
}

export function ToolRow({ tool, onOpen }: { tool: ToolSummary; onOpen?: () => void }) {
  const off = tool.enabled === false
  const body = (
    <div
      onClick={onOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 4px', opacity: off ? 0.55 : 1, cursor: onOpen ? 'pointer' : undefined }}
    >
      <div style={{ width: 170, flexShrink: 0 }}>
        <Typography.Text strong>{tool.name}</Typography.Text>
        {off && <DisabledBadge />}
        <ProviderBadge pid={tool.providerId ?? 'default'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ToolLifeFlow tool={tool} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(tool.tags ?? []).map((t) => (
          <CatalogBadge key={t} value={t} catalog={new Map()} fallback="auto" size="sm" plain radius="round" />
        ))}
      </div>
    </div>
  )
  return onOpen ? body : <ToolLink tool={tool}>{body}</ToolLink>
}

registerRenderer('tool-card', (item, ctx) => (
  <ToolCard tool={item as unknown as ToolSummary} onOpen={ctx.onItemClick ? () => ctx.onItemClick?.(item) : undefined} />
))
registerRenderer('tool-row', (item, ctx) => (
  <ToolRow tool={item as unknown as ToolSummary} onOpen={ctx.onItemClick ? () => ctx.onItemClick?.(item) : undefined} />
))
