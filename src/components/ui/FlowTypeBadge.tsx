/** 流类型徽章（06 10a）：flow=普通流 / workflow=工作流；缺省（v1 会员）不显示。
 *  标签走门户文案（FLOW_TYPE_LABELS），配色为组件层 UI 常量。 */

import type { PipelineSummary } from '@/api/types'
import { FLOW_TYPE_LABELS } from '@/config/portal'

const PALETTE: Record<string, { bg: string; fg: string }> = {
  flow: { bg: '#e6f4f1', fg: '#0F6E56' },
  workflow: { bg: '#f1ecfb', fg: '#6b3fc4' },
}

export function FlowTypeBadge({ flow, plain = false, strong = false }: {
  flow: Pick<PipelineSummary, 'type'>
  /** plain：无背景色（仅描边文字），侧栏筛选未选中态用。 */
  plain?: boolean
  /** strong：选中加粗，侧栏筛选选中态用。 */
  strong?: boolean
}) {
  if (!flow.type) return null
  const p = PALETTE[flow.type]
  const label = FLOW_TYPE_LABELS[flow.type]
  if (!p || !label) return null
  return (
    <span
      style={{
        background: plain ? 'transparent' : p.bg,
        color: p.fg,
        border: plain ? `1px solid ${p.fg}` : '1px solid transparent',
        borderRadius: 4,
        padding: '0 6px',
        fontSize: 11,
        lineHeight: '18px',
        flexShrink: 0,
        fontWeight: strong ? 600 : undefined,
      }}
    >
      {label}
    </span>
  )
}
