/** 任务域行/卡渲染器：v3 槽位 list.panel 以名引用（task-card / task-row）。 */

import { Typography } from 'antd'
import { PanelCard } from '@/components/ui/PanelCard'
import { StatusBadge } from '@/components/StatusBadge'
import { TASK_KIND_COLORS, TASK_KIND_LABELS } from '@/config/portal'
import type { Task, TaskKind } from '@/api/types'
import { registerRenderer } from '@/protocol/slotTemplates'

function TaskKindBadge({ kind }: { kind?: TaskKind }) {
  if (!kind || kind === 'tool') return null
  const color = TASK_KIND_COLORS[kind] ?? '#8c8c8c'
  return (
    <span
      style={{
        background: `${color}1a`,
        color,
        borderRadius: 4,
        padding: '0 6px',
        fontSize: 11,
        lineHeight: '18px',
        marginLeft: 6,
      }}
    >
      {TASK_KIND_LABELS[kind]}
    </span>
  )
}

export function TaskRow({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        <Typography.Text strong ellipsis style={{ maxWidth: 260 }}>
          {t.tool_name ?? t.tool_id}
        </Typography.Text>
        <TaskKindBadge kind={t.task_kind} />
      </div>
      <StatusBadge value={t.status} />
    </div>
  )
}

export function TaskCard({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <PanelCard onClick={onOpen} style={{ height: '100%', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text strong ellipsis style={{ flex: 1 }}>
          {t.tool_name ?? t.tool_id}
        </Typography.Text>
        <TaskKindBadge kind={t.task_kind} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusBadge value={t.status} />
      </div>
    </PanelCard>
  )
}

registerRenderer('task-card', (item, ctx) => (
  <TaskCard task={item as unknown as Task} onOpen={() => ctx.onItemClick?.(item)} />
))
registerRenderer('task-row', (item, ctx) => (
  <TaskRow task={item as unknown as Task} onOpen={() => ctx.onItemClick?.(item)} />
))
