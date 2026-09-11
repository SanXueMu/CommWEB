/** 流域行/卡渲染器：v3 槽位 list.panel 以名引用（flow-card / flow-row）。 */

import { Space, Typography } from 'antd'
import { ProviderBadge } from '@/components/ProviderBadge'
import { FlowTypeBadge } from '@/components/ui/FlowTypeBadge'
import { LifeFlow } from '@/components/LifeFlow'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import type { PipelineSummary } from '@/api/types'
import { registerRenderer } from '@/protocol/slotTemplates'

/** 卡片式：不渲染生命周期（D2.2），标题短名 + 类型标签。 */
export function FlowCard({ flow, onOpen }: { flow: PipelineSummary; onOpen: () => void }) {
  return (
    <PanelCard radius="round" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Typography.Text strong>{flow.name}</Typography.Text>
        <FlowTypeBadge flow={flow} />
        <ProviderBadge pid={flow.providerId ?? 'default'} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {flow.steps.length} 步
        </Typography.Text>
      </div>
    </PanelCard>
  )
}

/** 列表式：渲染横向生命周期（D2.2），不渲染英文名 id。 */
export function FlowRow({ flow, onOpen }: { flow: PipelineSummary; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Typography.Text strong style={{ display: 'block' }}>{flow.name}</Typography.Text>
        <Space size={6} style={{ marginTop: 2 }}>
          <FlowTypeBadge flow={flow} />
          <ProviderBadge pid={flow.providerId ?? 'default'} />
        </Space>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LifeFlow
          size="sm"
          nodes={flow.steps.map((s, i) => ({ key: `${s.tool ?? s.pipeline ?? 'step'}-${i}`, label: s.tool ?? s.pipeline ?? '步骤' }))}
        />
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={flow.providerId} />
      </span>
    </div>
  )
}

registerRenderer('flow-card', (item, ctx) => (
  <FlowCard flow={item as unknown as PipelineSummary} onOpen={() => ctx.onItemClick?.(item)} />
))
registerRenderer('flow-row', (item, ctx) => (
  <FlowRow flow={item as unknown as PipelineSummary} onOpen={() => ctx.onItemClick?.(item)} />
))
