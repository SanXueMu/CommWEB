/** 通用筛选侧栏：分组数据驱动，CheckableTag 云形态 + 清空入口。
 *  ToolsHub / Tasks 等列表页共用，禁止再手搓 aside。 */

import { PORTAL } from '@/config/portal'
import { Button } from '@/ui'

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
        borderRight: '1px solid var(--cw-border)',
        paddingRight: 16,
      }}
    >
      {groups.map((group, gi) => (
        <div key={group.title} style={{ marginBottom: gi < groups.length - 1 ? 16 : 0 }}>
          <div style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
            {group.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {group.items.map((tag) => (
              <Button
                key={tag}
                size="sm"
                variant={group.selected.includes(tag) ? 'primary' : 'tertiary'}
                onClick={() => group.onToggle(tag)}
              >
                {tag}
              </Button>
            ))}
            {group.items.length === 0 && (
              <div style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>
                {group.emptyText ?? PORTAL.empty.noTags}
              </div>
            )}
          </div>
        </div>
      ))}
      {hasSelection && onClear && (
        <button type="button" style={{ background: 'none', border: 0, color: 'var(--cw-primary)', cursor: 'pointer', fontSize: 12, marginTop: 8, padding: 0 }} onClick={onClear}>
          {PORTAL.sidebar.clear}
        </button>
      )}
    </aside>
  )
}
