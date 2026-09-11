/**
 * v3 槽位模板注册表：会员按名引用模板（props 纯数据），CommWEB 白名单渲染。
 * 模板只做「声明 → 组件」的翻译，业务语义留在渲染器/页面壳。
 */

import type { ReactNode } from 'react'
import { DataListPanel } from '@/components/DataListPanel'
import { FilterSidebar, type FilterGroup } from '@/components/FilterSidebar'
import { LifeFlow, type LifeFlowNode } from '@/components/LifeFlow'
import type { DataDecl, SlotDecl } from '@/protocol/slots'
import { resolveSlot, useDeclaredQuery } from '@/protocol/slots'

/** 行/卡渲染器注册表：声明式列表的 renderCard/renderRow 以名引用（JSON 表达不了函数）。 */
export type ItemRenderer = (item: Record<string, unknown>, ctx: RendererContext) => ReactNode
export interface RendererContext {
  pid: string
  onItemClick?: (item: Record<string, unknown>) => void
}
const RENDERERS: Record<string, ItemRenderer> = {}

/** 模板装配入参：声明 props + 声明式取数结果 + 页面壳上下文（受控交互状态）。 */
export interface TemplateSlot {
  props: Record<string, unknown>
  data?: unknown
  dataLoading: boolean
  dataError?: string
  context: SlotContext
}
export interface SlotContext {
  pid: string
  items?: Record<string, unknown>[]
  onItemClick?: (item: Record<string, unknown>) => void
  /** sidebar 受控分组（筛选是页面级交互状态，不走声明） */
  groups?: FilterGroup[]
  onClearFilters?: () => void
  /** 列表搜索回调（关键词过滤在页面壳，过滤结果经 context.items 注入） */
  onSearch?: (keyword: string) => void
}
export interface SlotTemplate {
  render: (slot: TemplateSlot) => ReactNode
}

const listPanel: SlotTemplate = {
  render: ({ props, data, dataLoading, context }) => {
    const p = props as {
      layout?: 'card' | 'row'
      renderer?: string
      rowKey?: string
      searchPlaceholder?: string
      emptyText?: string
      pagination?: boolean | { pageSize: number }
      density?: 'compact'
      bordered?: boolean
    }
    const renderer = p.renderer ? RENDERERS[p.renderer] : undefined
    return (
      <DataListPanel<Record<string, unknown>>
        panelKey={`slot-${p.renderer ?? 'list'}`}
        providerId={context.pid}
        items={context.items ?? (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])}
        loading={dataLoading}
        rowKey={(item) => String(item[p.rowKey ?? 'id'] ?? JSON.stringify(item).slice(0, 32))}
        onItemClick={context.onItemClick}
        onSearch={context.onSearch}
        searchPlaceholder={p.searchPlaceholder}
        emptyText={p.emptyText}
        renderCard={p.layout !== 'row' && renderer ? (item) => renderer(item, { pid: context.pid, onItemClick: context.onItemClick }) : undefined}
        renderRow={p.layout === 'row' && renderer ? (item) => renderer(item, { pid: context.pid, onItemClick: context.onItemClick }) : undefined}
        pagination={p.pagination}
        density={p.density}
        bordered={p.bordered}
      />
    )
  },
}

const sidebarFilter: SlotTemplate = {
  render: ({ props, context }) => (
    <FilterSidebar
      groups={context.groups ?? []}
      onClear={context.onClearFilters}
      width={typeof props.width === 'number' ? props.width : undefined}
    />
  ),
}

const flowLifeFlow: SlotTemplate = {
  render: ({ props, data }) => {
    const p = props as { direction?: 'horizontal' | 'vertical'; size?: 'sm' | 'md' | 'lg' }
    const nodes = (Array.isArray(data) ? data : []) as unknown as LifeFlowNode[]
    return <LifeFlow nodes={nodes} direction={p.direction} size={p.size} />
  },
}

export const SLOT_TEMPLATES: Record<string, SlotTemplate> = {
  'list.panel': listPanel,
  'sidebar.filter': sidebarFilter,
  'flow.lifeflow': flowLifeFlow,
}

/** 槽位渲染器：解析 → 取数 → 模板；失败降级占位（不炸不瞒）。 */
export function SlotRenderer({ decl, pid, context }: { decl: SlotDecl; pid: string; context: SlotContext }) {
  const resolved = resolveSlot(decl)
  const query = useDeclaredQuery(pid, resolved.status === 'ok' ? decl.data : undefined)
  if (resolved.status !== 'ok') {
    return (
      <div style={{ padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8, color: '#999' }}>
        槽位不可用：{resolved.reason}
      </div>
    )
  }
  return SLOT_TEMPLATES[decl.template].render({
    props: decl.props ?? {},
    data: query.data,
    dataLoading: query.isLoading,
    dataError: query.isError ? String(query.error) : undefined,
    context,
  })
}

/** 注册行/卡渲染器（页面模块 import 副作用注册，保持声明层无业务）。 */
export function registerRenderer(name: string, renderer: ItemRenderer) {
  RENDERERS[name] = renderer
}

export type { DataDecl }
