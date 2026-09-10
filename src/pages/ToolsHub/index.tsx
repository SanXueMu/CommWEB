import { Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ToolSummary } from '@/api/types'
import { ProviderBadge } from '@/components/ProviderBadge'
import { DataListPanel } from '@/components/DataListPanel'
import { FilterSidebar, normalizeTags } from '@/components/FilterSidebar'
import { HelpCardModal } from '@/components/HelpCardModal'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { HELP_CARDS } from '@/config/helpCards'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'

const norm = (t: string) => t.trim().toLowerCase()

/** 货架（packy 风格，T3 聚合模式）：多会员工具混排 + 左侧标签/会员双筛选。 */
export function ToolsHub() {
  const navigate = useNavigate()
  const pid = useActivePid()
  const [keyword, setKeyword] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() })
  const tools = data?.tools ?? []
  const allTags = useMemo(() => normalizeTags(tools.flatMap((t) => t.tags ?? [])), [tools])
  const filtered = tools.filter((tool) => {
    const kw = keyword.trim()
    const hitKeyword =
      !kw ||
      tool.id.includes(kw) ||
      tool.name.includes(kw) ||
      (tool.description ?? '').includes(kw) ||
      (tool.tags ?? []).some((t) => t.includes(kw))
    const hitTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => (tool.tags ?? []).some((t) => norm(t) === norm(tag)))
    return hitKeyword && hitTags
  })

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <FilterSidebar
        groups={[{ title: PORTAL.sidebar.tags, items: allTags, selected: selectedTags, onToggle: toggleTag }]}
        onClear={() => setSelectedTags([])}
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
          onItemClick={(t) => navigate(`/tools/${encodeURIComponent(t.id)}?provider=${t.providerId ?? 'default'}`)}
          emptyText={PORTAL.empty.tools}
          renderCard={(tool) => <ToolCard tool={tool} />}
          renderRow={(tool) => <ToolRow tool={tool} />}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          共 {filtered.length} 个工具 · {PORTAL.footNote.tools}
        </Typography.Text>
      </main>
    </div>
  )
}

function DisabledBadge() {
  return (
    <span style={{ background: '#fff1f0', color: '#cf1322', borderRadius: 4, padding: '0 6px', fontSize: 11, lineHeight: '18px', flexShrink: 0 }}>
      {PORTAL.toolDisabled}
    </span>
  )
}

function ToolCard({ tool }: { tool: ToolSummary }) {
  const off = tool.enabled === false
  return (
    <Link to={`/tools/${tool.id}`} style={{ opacity: off ? 0.55 : 1 }}>
      <PanelCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{tool.name}</Typography.Text>
          {off && <DisabledBadge />}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            v{tool.version}
          </Typography.Text>
          <ProviderBadge pid={tool.providerId ?? 'default'} />
        </div>
        <Typography.Paragraph
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ margin: '6px 0 10px', minHeight: 44, fontSize: 13 }}
        >
          {tool.description || '（无描述）'}
        </Typography.Paragraph>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {normalizeTags(tool.tags ?? []).map((t) => (
            <Tag key={t} style={{ marginRight: 0 }}>{t}</Tag>
          ))}
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
            {tool.input_types.join(', ')} → {tool.output_types.join(', ')}
          </Typography.Text>
        </div>
      </PanelCard>
    </Link>
  )
}

function ToolRow({ tool }: { tool: ToolSummary }) {
  const off = tool.enabled === false
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', opacity: off ? 0.55 : 1 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Typography.Text strong>{tool.name}</Typography.Text>
        {off && <DisabledBadge />}
        <ProviderBadge pid={tool.providerId ?? 'default'} />
        <div>
          <Typography.Text code type="secondary" style={{ fontSize: 12 }}>
            {tool.id}
          </Typography.Text>
        </div>
      </div>
      <Typography.Text
        type="secondary"
        ellipsis
        style={{ flex: 1, fontSize: 13 }}
      >
        {tool.description || '（无描述）'}
      </Typography.Text>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {normalizeTags(tool.tags ?? []).map((t) => (
          <Tag key={t} style={{ marginRight: 0 }}>{t}</Tag>
        ))}
      </div>
    </div>
  )
}
