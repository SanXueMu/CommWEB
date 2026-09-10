import { Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ToolSummary } from '@/api/types'
import { ProviderBadge } from '@/components/ProviderBadge'
import { DataListPanel } from '@/components/DataListPanel'
import { HelpCardModal } from '@/components/HelpCardModal'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { HELP_CARDS } from '@/config/helpCards'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'

/** 货架（packy 风格，T3 聚合模式）：多会员工具混排 + 左侧标签/会员双筛选。 */
export function ToolsHub() {
  const navigate = useNavigate()
  const pid = useActivePid()
  const [keyword, setKeyword] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() })
  const tools = data?.tools ?? []
  const allTags = useMemo(
    () => [...new Set(tools.flatMap((t) => t.tags ?? []))],
    [tools],
  )
  const filtered = tools.filter((tool) => {
    const hitKeyword =
      !keyword ||
      tool.id.includes(keyword) ||
      tool.name.includes(keyword) ||
      (tool.description ?? '').includes(keyword) ||
      (tool.tags ?? []).some((t) => t.includes(keyword))
    const hitTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => (tool.tags ?? []).includes(tag))
    return hitKeyword && hitTags
  })

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <aside
        style={{
          width: 168,
          flexShrink: 0,
          position: 'sticky',
          top: 76,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 16,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          标签
        </Typography.Text>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {allTags.map((tag) => (
            <Tag.CheckableTag
              key={tag}
              checked={selectedTags.includes(tag)}
              onChange={() => toggleTag(tag)}
            >
              {tag}
            </Tag.CheckableTag>
          ))}
          {allTags.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {PORTAL.empty.noTags}
            </Typography.Text>
          )}
        </div>
        {selectedTags.length > 0 && (
          <Typography.Link
            style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}
            onClick={() => setSelectedTags([])}
          >
            清空筛选
          </Typography.Link>
        )}
      </aside>

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

function ToolCard({ tool }: { tool: ToolSummary }) {
  return (
    <Link to={`/tools/${tool.id}`}>
      <PanelCard>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography.Text strong>{tool.name}</Typography.Text>
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
          {(tool.tags ?? []).map((t) => (
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Typography.Text strong>{tool.name}</Typography.Text>
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
        {(tool.tags ?? []).map((t) => (
          <Tag key={t} style={{ marginRight: 0 }}>{t}</Tag>
        ))}
      </div>
    </div>
  )
}
