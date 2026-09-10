import { useQuery } from '@tanstack/react-query'
import { Typography } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import type { Task, TaskKind } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskDrawer } from '@/components/TaskDrawer'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL, STATUS_GROUP_LABELS, TASK_KIND_LABELS } from '@/config/portal'
import { useStatusCatalog } from '@/config/useStatusCatalog'
import { useActivePid } from '@/transfer/context'

/** 柜台（与工具库同构）：左侧任务分类 + 状态分组筛选（目录驱动）+ 右侧通用列表面板。 */
export function Tasks() {
  const pid = useActivePid()
  const [kind, setKind] = useState<TaskKind | ''>('')
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const { byGroup } = useStatusCatalog()
  const { data, isLoading } = useQuery({
    queryKey: ['provider', pid, 'tasks', kind],
    queryFn: () => api.listTasks(undefined, kind || undefined),
    refetchInterval: 3000,
  })

  const tasks = (data?.tasks ?? []).filter((t) => {
    const hitStatus = !group || (byGroup[group] ?? []).some((s) => s.value === t.status)
    const hitKeyword =
      !keyword ||
      t.tool_id.includes(keyword) ||
      t.handle.includes(keyword) ||
      t.status.includes(keyword)
    return hitStatus && hitKeyword
  })
  const count = (key: string) =>
    (data?.tasks ?? []).filter((t) => (byGroup[key] ?? []).some((s) => s.value === t.status)).length

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, marginBottom: 16 }}>
          {(['', 'tool', 'flow', 'workflow'] as const).map((k) => (
            <Typography.Link
              key={k || 'all'}
              strong={kind === k}
              onClick={() => setKind(k)}
              style={{ color: kind === k ? '#202753' : '#8c8c8c' }}
            >
              {k ? TASK_KIND_LABELS[k] : PORTAL.sidebar.all}（
                {k
                  ? (data?.tasks ?? []).filter((t) => t.task_kind === k).length
                  : (data?.tasks ?? []).length}
              ）
            </Typography.Link>
          ))}
        </div>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {PORTAL.sidebar.status}
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <Typography.Link
            strong={group === ''}
            onClick={() => setGroup('')}
            style={{ color: group === '' ? '#202753' : '#8c8c8c' }}
          >
            {PORTAL.sidebar.all}（{(data?.tasks ?? []).length}）
          </Typography.Link>
          {Object.entries(byGroup).map(([key]) => (
            <Typography.Link
              key={key}
              strong={group === key}
              onClick={() => setGroup(key)}
              style={{ color: group === key ? '#202753' : '#8c8c8c' }}
            >
              {STATUS_GROUP_LABELS[key] ?? key}（{count(key)}）
            </Typography.Link>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <DataListPanel
          providerId={pid}
          panelKey="tasks"
          items={tasks}
          loading={isLoading}
          rowKey={(t) => t.handle}
          onSearch={setKeyword}
          searchPlaceholder={PORTAL.search.tasks}
          defaultView="list"
          onItemClick={(t) => setSelected(t.handle)}
          emptyText={PORTAL.empty.tasks}
          renderCard={(t) => <TaskCard task={t} />}
          renderRow={(t) => <TaskRow task={t} />}
        />
      </main>

      <TaskDrawer handle={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function TaskCard({ task: t }: { task: Task }) {
  return (
    <PanelCard>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Text strong>{t.tool_id}</Typography.Text>
        <StatusBadge value={t.status} />
      </div>
      <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
        {t.handle.slice(0, 18)}…
      </Typography.Text>
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t.created_at?.slice(0, 19)} · 尝试 {t.attempt}/{t.max_attempts}
        </Typography.Text>
      </div>
    </PanelCard>
  )
}

function TaskKindBadge({ kind }: { kind?: TaskKind }) {
  if (!kind || kind === 'tool') return null
  const palette = kind === 'flow' ? { bg: '#e6f4f1', fg: '#0F6E56' } : { bg: '#f1ecfb', fg: '#6b3fc4' }
  return (
    <span style={{ background: palette.bg, color: palette.fg, borderRadius: 4, padding: '0 6px', fontSize: 11, lineHeight: '18px' }}>
      {TASK_KIND_LABELS[kind]}
    </span>
  )
}

function TaskRow({ task: t }: { task: Task }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <Typography.Text strong>{t.tool_id}</Typography.Text>
        <TaskKindBadge kind={t.task_kind} />
        <div>
          <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
            {t.handle.slice(0, 14)}…
          </Typography.Text>
        </div>
      </div>
      <Typography.Text type="secondary" style={{ flex: 1, fontSize: 12 }}>
        {t.created_at?.slice(0, 19)}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
        {t.attempt}/{t.max_attempts}
      </Typography.Text>
      <StatusBadge value={t.status} />
    </div>
  )
}
