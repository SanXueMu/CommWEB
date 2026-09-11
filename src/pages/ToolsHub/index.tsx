import { Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ToolSummary } from '@/api/types'
import { ProviderBadge } from '@/components/ProviderBadge'
import { CatalogBadge } from '@/components/CatalogBadge'
import { DataListPanel } from '@/components/DataListPanel'
import { DisabledBadge } from '@/components/DisabledBadge'
import { FilterSidebar } from '@/components/FilterSidebar'
import { HelpCardModal } from '@/components/HelpCardModal'
import { LifeFlow } from '@/components/LifeFlow'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { HELP_CARDS } from '@/config/helpCards'
import { useToolCategoryCatalog } from '@/config/useToolCategoryCatalog'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { ToolDetailModal } from '@/pages/ToolsHub/ToolDetailModal'
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

/** 数据转化生命周期：输入类型 → 输出类型的横向流线。 */
export function ToolLifeFlow({ tool, size = 'sm' }: { tool: ToolSummary; size?: 'sm' | 'md' | 'lg' }) {
  const nodes = [...tool.input_types, ...tool.output_types].map((label) => ({ key: label, label }))
  return <LifeFlow nodes={nodes} size={size} direction="horizontal" />
}

function ToolCard({ tool }: { tool: ToolSummary }) {
  const off = tool.enabled === false
  return (
    <Link to={`/tools/${tool.id}`} style={{ opacity: off ? 0.55 : 1 }}>
      <PanelCard radius="round">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{tool.name}</Typography.Text>
          {off && <DisabledBadge />}
          <ProviderBadge pid={tool.providerId ?? 'default'} />
        </div>
        <div style={{ margin: '10px 0' }}>
          <ToolLifeFlow tool={tool} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(tool.tags ?? []).map((t) => (
            <CatalogBadge key={t} value={t} catalog={new Map()} fallback="auto" size="sm" plain radius="round" />
          ))}
        </div>
      </PanelCard>
    </Link>
  )
}

function ToolRow({ tool }: { tool: ToolSummary }) {
  const off = tool.enabled === false
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 4px', opacity: off ? 0.55 : 1 }}>
      <div style={{ width: 170, flexShrink: 0 }}>
        <Typography.Text strong>{tool.name}</Typography.Text>
        {off && <DisabledBadge />}
        <ProviderBadge pid={tool.providerId ?? 'default'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <ToolLifeFlow tool={tool} />
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(tool.tags ?? []).map((t) => (
          <CatalogBadge key={t} value={t} catalog={new Map()} fallback="auto" size="sm" plain radius="round" />
        ))}
      </div>
    </div>
  )
}
