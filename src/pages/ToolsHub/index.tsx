import { Typography } from 'antd'
import { useMemo, useState } from 'react'
import type { ToolSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { FilterSidebar } from '@/components/FilterSidebar'
import { HelpCardModal } from '@/components/HelpCardModal'
import { PORTAL } from '@/config/portal'
import { HELP_CARDS } from '@/config/helpCards'
import { useToolCategoryCatalog } from '@/config/useToolCategoryCatalog'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { ToolDetailModal } from '@/pages/ToolsHub/ToolDetailModal'
import { ToolCard, ToolRow } from '@/pages/ToolsHub/renderers'
import { slotsOf } from '@/protocol/slots'
import { SlotRenderer } from '@/protocol/slotTemplates'
import { useViewProps } from '@/protocol/ViewPropsContext'
import { useQuery } from '@tanstack/react-query'

/** 货架（packy 风格，T3 聚合模式）：多会员工具混排 + 左侧总类/子类两级标签筛选。 */
export function ToolsHub() {
  const pid = useActivePid()
  const [keyword, setKeyword] = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [selectedSubs, setSelectedSubs] = useState<string[]>([])
  const { categories } = useToolCategoryCatalog()
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() })
  const tools = data?.tools ?? []
  const subItems = useMemo(() => {
    const subs = selectedCat ? (categories.find((c) => c.name === selectedCat)?.subs ?? []) : categories.flatMap((c) => c.subs)
    return subs.filter((s) => tools.some((t) => t.subcategory === s))
  }, [categories, selectedCat, tools])
  const filtered = tools.filter((tool) => {
    const kw = keyword.trim()
    const hitKeyword =
      !kw ||
      tool.id.includes(kw) ||
      tool.name.includes(kw) ||
      (tool.description ?? '').includes(kw) ||
      (tool.tags ?? []).some((t) => t.includes(kw))
    const hitCat = !selectedCat || tool.category === selectedCat
    const hitSubs = selectedSubs.length === 0 || selectedSubs.includes(tool.subcategory ?? '')
    return hitKeyword && hitCat && hitSubs
  })

  const pickCat = (cat: string) => {
    setSelectedCat((prev) => (prev === cat ? null : cat))
    setSelectedSubs([])
  }
  const toggleSub = (sub: string) =>
    setSelectedSubs((prev) => (prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]))
  const [detailToolId, setDetailToolId] = useState<string | null>(null)
  const detailTool = (data?.tools ?? []).find((t) => t.id === detailToolId)

  const viewProps = useViewProps()
  const slots = slotsOf(viewProps)

  /** v3 槽位分支：会员声明 slots 则按声明渲染；detail 为弹窗语义动作（渲染器 onItemClick）。 */
  if (slots.list || slots.sidebar) {
    const groups = [
      { title: PORTAL.sidebar.categories, items: categories.map((c) => c.name), selected: selectedCat ? [selectedCat] : [], onToggle: pickCat },
      { title: PORTAL.sidebar.subcategories, items: subItems, selected: selectedSubs, onToggle: toggleSub },
    ]
    return (
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {slots.sidebar && (
          <SlotRenderer decl={slots.sidebar} pid={pid} context={{ pid, groups, onClearFilters: () => { setSelectedCat(null); setSelectedSubs([]) } }} />
        )}
        <main style={{ flex: 1, minWidth: 0 }}>
          {slots.list && (
            <SlotRenderer
              decl={slots.list}
              pid={pid}
              context={{
                pid,
                items: filtered as unknown as Record<string, unknown>[],
                onItemClick: (t2) => setDetailToolId((t2 as unknown as ToolSummary).id),
                onSearch: setKeyword,
              }}
            />
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            共 {filtered.length} 个工具 · {PORTAL.footNote.tools}
          </Typography.Text>
        </main>
        {detailTool && <ToolDetailModal tool={detailTool} open onClose={() => setDetailToolId(null)} />}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <FilterSidebar
        groups={[
          { title: PORTAL.sidebar.categories, items: categories.map((c) => c.name), selected: selectedCat ? [selectedCat] : [], onToggle: pickCat },
          { title: PORTAL.sidebar.subcategories, items: subItems, selected: selectedSubs, onToggle: toggleSub },
        ]}
        onClear={() => {
          setSelectedCat(null)
          setSelectedSubs([])
        }}
      />

      <main style={{ flex: 1, minWidth: 0 }}>
        <DataListPanel
          providerId={pid}
          panelKey="tools"
          items={filtered}
          loading={isLoading}
          rowKey={(t) => `${t.providerId ?? 'default'}:${t.id}`}
          onSearch={setKeyword}
          searchPlaceholder={PORTAL.search.tools}
          extraActions={<HelpCardModal cards={HELP_CARDS} />}
          onItemClick={(t) => setDetailToolId(t.id)}
          emptyText={PORTAL.empty.tools}
          renderCard={(tool) => <ToolCard tool={tool} />}
          renderRow={(tool) => <ToolRow tool={tool} />}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          共 {filtered.length} 个工具 · {PORTAL.footNote.tools}
        </Typography.Text>
      </main>
      {detailTool && (
        <ToolDetailModal tool={detailTool} open onClose={() => setDetailToolId(null)} />
      )}
    </div>
  )
}
