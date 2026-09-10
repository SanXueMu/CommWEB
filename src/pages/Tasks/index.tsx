import { useQuery } from '@tanstack/react-query'
import { Typography } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import type { Task } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskDrawer } from '@/components/TaskDrawer'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL, STATUS_GROUP_LABELS } from '@/config/portal'
import { useStatusCatalog } from '@/config/useStatusCatalog'

/** 柜台（与工具库同构）：左侧状态分组筛选（目录驱动）+ 右侧通用列表面板。 */
export function Tasks() {
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const { byGroup } = useStatusCatalog()
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
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
          {PORTAL.sidebar.status}
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <Typography.Link
            strong={group === ''}
            onClick={() => setGroup('')}
            style={{ color: group === '' ? '#202753' : '#8c8c8c' }}
          >
            全部（{(data?.tasks ?? []).length}）
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

function TaskRow({ task: t }: { task: Task }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
      <div style={{ width: 220, flexShrink: 0 }}>
        <Typography.Text strong>{t.tool_id}</Typography.Text>
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
