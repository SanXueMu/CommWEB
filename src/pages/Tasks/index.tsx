import { useQuery } from '@tanstack/react-query'
import { Tag, Typography } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import type { Task } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { TaskDrawer } from '@/components/TaskDrawer'
import { STATUS_COLORS } from '@/theme/tokens'

const STATUS_GROUPS: { key: string; label: string; statuses?: string[] }[] = [
  { key: '', label: '全部' },
  { key: 'queued', label: '排队', statuses: ['queued'] },
  { key: 'running', label: '运行中', statuses: ['running'] },
  { key: 'succeeded', label: '成功', statuses: ['succeeded'] },
  { key: 'failed', label: '失败', statuses: ['failed', 'failed_review', 'interrupted', 'cancelled'] },
]

/** 柜台（与工具库同构）：左侧状态筛选 + 右侧通用列表面板。 */
export function Tasks() {
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.listTasks(),
    refetchInterval: 3000,
  })

  const statuses = STATUS_GROUPS.find((g) => g.key === group)?.statuses
  const tasks = (data?.tasks ?? []).filter((t) => {
    const hitStatus = !statuses || statuses.includes(t.status)
    const hitKeyword =
      !keyword ||
      t.tool_id.includes(keyword) ||
      t.handle.includes(keyword) ||
      t.status.includes(keyword)
    return hitStatus && hitKeyword
  })
  const count = (key: string) => {
    const st = STATUS_GROUPS.find((g) => g.key === key)?.statuses
    return (data?.tasks ?? []).filter((t) => !st || st.includes(t.status)).length
  }

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
          状态
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {STATUS_GROUPS.map((g) => (
            <Typography.Link
              key={g.key}
              strong={group === g.key}
              onClick={() => setGroup(g.key)}
              style={{ color: group === g.key ? '#202753' : '#8c8c8c' }}
            >
              {g.label}（{count(g.key)}）
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
          searchPlaceholder="搜索任务（工具 / handle / 状态）"
          defaultView="list"
          onItemClick={(t) => setSelected(t.handle)}
          emptyText="暂无任务"
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
    <div style={{ border: '1px solid #ececec', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Text strong>{t.tool_id}</Typography.Text>
        <Tag color={STATUS_COLORS[t.status]} style={{ marginRight: 0 }}>{t.status}</Tag>
      </div>
      <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
        {t.handle.slice(0, 18)}…
      </Typography.Text>
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t.created_at?.slice(0, 19)} · 尝试 {t.attempt}/{t.max_attempts}
        </Typography.Text>
      </div>
    </div>
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
      <Tag color={STATUS_COLORS[t.status]} style={{ marginRight: 0, flexShrink: 0 }}>
        {t.status}
      </Tag>
    </div>
  )
}
