/** 任务中心：三层归类筛选（颜色标签）+ 中文工具名列表（分页/检索）+ 详情弹窗。 */
import { useState } from 'react'
import { CatalogBadge } from '@/components/CatalogBadge'
import { DataListPanel } from '@/components/DataListPanel'
import { PanelCard } from '@/components/ui/PanelCard'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { StatusBadge } from '@/components/StatusBadge'
import { PORTAL, STATUS_GROUP_LABELS, TASK_KIND_COLORS, TASK_KIND_LABELS } from '@/config/portal'
import type { Task, TaskKind } from '@/api/types'
import { api } from '@/api/client'
import { useActivePid } from '@/transfer/context'
import { useStatusCatalog } from '@/config/useStatusCatalog'
import { useQuery } from '@tanstack/react-query'
import { Typography } from 'antd'

const KIND_ORDER = ['', 'tool', 'flow', 'workflow'] as const

/** 任务中心：三层归类颜色标签筛选 + 中文工具名分页列表 + 详情弹窗。 */
export function Tasks() {
  const pid = useActivePid()
  const [kind, setKind] = useState<TaskKind | ''>('')
  const [group, setGroup] = useState('')
  const [keyword, setKeyword] = useState('')
  const [detailHandle, setDetailHandle] = useState<string | null>(null)
  const { byGroup } = useStatusCatalog()
  const { data, isLoading } = useQuery({
    queryKey: ['provider', pid, 'tasks', kind],
    queryFn: () => api.listTasks(undefined, kind || undefined),
    refetchInterval: 3000,
  })

  const tasks = (data?.tasks ?? []).filter((t) => {
    const hitStatus = !group || (byGroup[group] ?? []).some((s) => s.value === t.status)
    const label = t.tool_name ?? t.tool_id
    const hitKeyword =
      !keyword ||
      label.includes(keyword) ||
      t.tool_id.includes(keyword) ||
      t.handle.includes(keyword) ||
      t.status.includes(keyword)
    return hitStatus && hitKeyword
  })

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <aside
        style={{
          width: 128,
          flexShrink: 0,
          position: 'sticky',
          top: 76,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 16,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {PORTAL.sidebar.kind}
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 16, alignItems: 'flex-start' }}>
          {KIND_ORDER.map((k) => (
            <span key={k || 'all'} onClick={() => setKind(k)} style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <KindChip label={k ? TASK_KIND_LABELS[k] : PORTAL.sidebar.all} kind={k} active={kind === k} />
            </span>
          ))}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {PORTAL.sidebar.status}
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, alignItems: 'flex-start' }}>
          {Object.keys(STATUS_GROUP_LABELS).map((g) => (
            <span key={g} onClick={() => setGroup(g === group ? '' : g)} style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <CatalogBadge
                value={STATUS_GROUP_LABELS[g]}
                catalog={new Map()}
                fallback={group === g ? '#202753' : 'auto'}
                size="sm"
                radius="round"
                plain={group !== g}
              />
            </span>
          ))}
        </div>
      </aside>

      <DataListPanel
        panelKey="tasks"
        providerId={pid}
        items={tasks}
        loading={isLoading}
        rowKey={(t) => t.handle}
        searchPlaceholder={PORTAL.search.tasks}
        onSearch={setKeyword}
        pagination={{ pageSize: 20 }}
        renderCard={(t) => <TaskCard task={t} onOpen={() => setDetailHandle(t.handle)} />}
        renderRow={(t) => <TaskRow task={t} onOpen={() => setDetailHandle(t.handle)} />}
      />

      <TaskDetailModal handle={detailHandle} onClose={() => setDetailHandle(null)} />
    </div>
  )
}

/** kind 分类标签（全部=auto 色板；选中实底、未选中描边）。 */
function KindChip({ label, kind, active }: { label: string; kind: '' | TaskKind; active: boolean }) {
  if (!kind) {
    return <CatalogBadge value={label} catalog={new Map()} fallback={active ? '#202753' : 'auto'} size="sm" radius="round" plain={!active} />
  }
  const color = TASK_KIND_COLORS[kind] ?? '#8c8c8c'
  return (
    <span
      style={{
        background: active ? color : 'transparent',
        color: active ? '#fff' : color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '0 10px',
        fontSize: 12,
        lineHeight: '22px',
      }}
    >
      {label}
    </span>
  )
}

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

function TaskRow({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
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

function TaskCard({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
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
