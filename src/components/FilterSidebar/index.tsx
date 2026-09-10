/** 通用筛选侧栏：分组数据驱动，CheckableTag 云形态 + 清空入口。
 *  ToolsHub / Tasks 等列表页共用，禁止再手搓 aside。 */

import { Tag, Typography } from 'antd'
import { PORTAL } from '@/config/portal'

/** 标签归一：trim 去空、大小写变体聚合保首个、中文拼音序。 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of tags) {
    const tag = raw.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (!seen.has(key)) seen.set(key, tag)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

export interface FilterGroup {
  title: string
  items: string[]
  selected: string[]
  onToggle: (key: string) => void
  emptyText?: string
}

export function FilterSidebar({ groups, onClear, width = 168 }: {
  groups: FilterGroup[]
  onClear?: () => void
  width?: number
}) {
  const hasSelection = groups.some((g) => g.selected.length > 0)
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        position: 'sticky',
        top: 76,
        borderRight: '1px solid #f0f0f0',
        paddingRight: 16,
      }}
    >
      {groups.map((group, gi) => (
        <div key={group.title} style={{ marginBottom: gi < groups.length - 1 ? 16 : 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {group.title}
          </Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {group.items.map((tag) => (
              <Tag.CheckableTag
                key={tag}
                checked={group.selected.includes(tag)}
                onChange={() => group.onToggle(tag)}
              >
                {tag}
              </Tag.CheckableTag>
            ))}
            {group.items.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {group.emptyText ?? PORTAL.empty.noTags}
              </Typography.Text>
            )}
          </div>
        </div>
      ))}
      {hasSelection && onClear && (
        <Typography.Link
          style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}
          onClick={onClear}
        >
          {PORTAL.sidebar.clear}
        </Typography.Link>
      )}
    </aside>
  )
}
