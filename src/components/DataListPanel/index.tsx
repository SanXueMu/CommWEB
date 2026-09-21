/**
 * 通用列表面板：搜索栏（输入即检）+ 右侧动作区（含卡片/列表渲染切换）+ 双形态展示。
 * 工具库与任务中心共用——「货架—柜台」一致体验的落点。
 * 可配置（默认行为不变）：分页 / 搜索开关 / 多选 / 行内动作 / 密度 / 边框 / 卡片间隔 / 长宽（style）。
 */

import { BarsOutlined, AppstoreOutlined, DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons'
import { Checkbox, Col, Empty, Input, List, Popover, Row, Segmented, Spin } from 'antd'
import { SimplePager } from '@/components/ui/SimplePager'
import { getViewPrefs, setViewProp } from '@/transfer/preferences'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DataListPanelProps<T> {
  panelKey: string
  providerId?: string
  items: T[]
  loading?: boolean
  rowKey: (item: T) => string
  /** 搜索开关：传 undefined 启用（默认），false 关闭搜索栏 */
  onSearch?: (keyword: string) => void
  searchPlaceholder?: string
  extraActions?: ReactNode
  renderCard?: (item: T) => ReactNode
  renderRow?: (item: T) => ReactNode
  onItemClick?: (item: T) => void
  defaultView?: 'card' | 'list'
  emptyText?: string
  /** 分页：true=默认每页 10；对象可指定 pageSize；仅列表形态生效 */
  pagination?: boolean | { pageSize?: number }
  /** 多选：列表形态每行前置 Checkbox，变化即回调。
   *  selectedKeys（受控）：由父组件持有勾选集——侧栏「清空」等操作改父状态即可同步勾选框，
   *  非受控用法（不传）保持组件内部自理。 */
  selectable?: { onChange: (keys: React.Key[], items: T[]) => void; selectedKeys?: React.Key[] }
  /** 行内动作（编辑/删除等维护入口），渲染在行尾 */
  rowActions?: (item: T) => ReactNode
  /** 列表密度：compact 收紧行距 */
  density?: 'compact' | 'default'
  /** 列表项边框 */
  bordered?: boolean
  /** 卡片栅格间隔 [横, 纵] */
  cardGutter?: [number, number]
  /** 面板整体长宽 */
  style?: React.CSSProperties
  /** 收纳（UI 原则①）：面板可折叠，defaultCollapsed=true 初始收起（如「已上传原件」列表） */
  collapsible?: { label?: string; defaultCollapsed?: boolean }
  /** 行 hover 详情（UI 原则①）：返回内容以 Popover 浮层展示，行内不再挤详情 */
  hoverDetail?: (item: T) => ReactNode
  /** 多选框与行内容的间距 px（默认 8） */
  checkboxGap?: number
}

export function DataListPanel<T>({
  panelKey,
  providerId,
  items,
  loading,
  rowKey,
  onSearch,
  searchPlaceholder = '搜索…',
  extraActions,
  renderCard,
  renderRow,
  onItemClick,
  defaultView = 'card',
  emptyText = '暂无数据',
  pagination,
  selectable,
  rowActions,
  density = 'default',
  bordered,
  cardGutter = [12, 12],
  style,
  collapsible,
  hoverDetail,
  checkboxGap = 8,
}: DataListPanelProps<T>) {
/** 布局偏好收编（蓝图03 §4.4）：有 providerId 时走 preferences（按会员隔离），否则回落旧 localStorage 键。 */
  const readLayout = (): 'card' | 'list' => {
    if (providerId) {
      const fromPrefs = getViewPrefs(providerId).viewProps[panelKey]?.defaultLayout
      if (fromPrefs === 'card' || fromPrefs === 'list') return fromPrefs
    }
    const legacy = localStorage.getItem(`commweb.view.${panelKey}`) as 'card' | 'list' | null
    return legacy ?? defaultView
  }
  const [view, setView] = useState<'card' | 'list'>(() => readLayout())
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [checkedInternal, setCheckedInternal] = useState<React.Key[]>([])
  const timer = useRef<number>()
  const pageSize = typeof pagination === 'object' ? (pagination.pageSize ?? 10) : 10
  const [collapsed, setCollapsed] = useState<boolean>(Boolean(collapsible?.defaultCollapsed))

  useEffect(() => {
    if (!onSearch) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSearch(keyword), 250)
    return () => window.clearTimeout(timer.current)
    // onSearch 由父组件闭包持有过滤逻辑，身份变化无需重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  useEffect(() => setPage(1), [items.length, view])

  const switchView = (next: 'card' | 'list') => {
    if (providerId) setViewProp(providerId, panelKey, 'defaultLayout', next)
    else localStorage.setItem(`commweb.view.${panelKey}`, next)
    setView(next)
  }

  // 无 renderCard 的面板（如结果库侧栏）只提供列表形态——卡片视图没有渲染实现，
  // 切过去是空栅格；同时隐藏切换钮，避免误切。
  const effectiveView: 'card' | 'list' = renderCard && view === 'card' ? 'card' : 'list'
  const paged = pagination && effectiveView === 'list'
    ? items.slice((page - 1) * pageSize, page * pageSize)
    : items

  // 受控勾选集优先（父组件持有）；未传时回落内部状态
  const checked = selectable?.selectedKeys ?? checkedInternal
  const toggle = (key: React.Key) => {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key]
    if (selectable?.selectedKeys === undefined) setCheckedInternal(next)
    selectable?.onChange(next, items.filter((it) => next.includes(rowKey(it))))
  }


  return (
    <div style={style}>
      {collapsible && (
        <div
          onClick={() => setCollapsed((v) => !v)}
          style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--cw-text)', marginBottom: collapsed ? 0 : 8 }}
        >
          {collapsed ? <RightOutlined style={{ fontSize: 11, marginRight: 6 }} /> : <DownOutlined style={{ fontSize: 11, marginRight: 6 }} />}
          <span style={{ fontSize: 13 }}>{collapsible.label ?? '列表'}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--cw-text-muted)' }}>({items.length})</span>
        </div>
      )}
      {!collapsed && (
      <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px 10px',
          marginBottom: 14,
          borderBottom: '1px solid var(--cw-border)',
        }}
      >
        {onSearch && (
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--cw-text-muted)' }} />}
            placeholder={searchPlaceholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ maxWidth: 'min(320px, 60%)' }}
          />
        )}
        <div style={{ flex: 1 }} />
        {extraActions}
        {renderCard && (
          <Segmented
            value={view}
            onChange={(v) => switchView(v as 'card' | 'list')}
            options={[
              { value: 'card', icon: <AppstoreOutlined />, title: '卡片式' },
              { value: 'list', icon: <BarsOutlined />, title: '列表式' },
            ]}
          />
        )}
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : items.length === 0 ? (
        <Empty description={emptyText} style={{ margin: '60px 0' }} />
      ) : effectiveView === 'card' ? (
        <Row gutter={cardGutter}>
          {items.map((item) => (
            <Col key={rowKey(item)} xs={24} sm={12} lg={8} xl={6}>
              {renderCard?.(item)}
            </Col>
          ))}
        </Row>
      ) : (
        <div style={{ padding: '0 12px' }}>
          <List
            dataSource={paged}
            split={bordered}
            renderItem={(item) => {
              const key = rowKey(item)
              const rowBody = (
                <div
                  className="commweb-list-row"
                  onClick={() => onItemClick?.(item)}
                  style={{
                    cursor: onItemClick ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: density === 'compact' ? '6px 0' : undefined,
                    ...(bordered
                      ? { border: '1px solid var(--cw-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }
                      : undefined),
                  }}
                >
                  {selectable && (
                    <Checkbox
                      checked={checked.includes(key)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(key)}
                      style={{ marginRight: checkboxGap - 8 > 0 ? checkboxGap - 8 : 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>{renderRow?.(item)}</div>
                  {rowActions && (
                    <div onClick={(e) => e.stopPropagation()}>{rowActions(item)}</div>
                  )}
                </div>
              )
              return hoverDetail ? (
                <Popover content={hoverDetail(item)} placement="right" mouseEnterDelay={0.4} destroyTooltipOnHide>
                  {rowBody}
                </Popover>
              ) : (
                rowBody
              )
            }}
          />
          {paged && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
              <SimplePager
                size={density === 'compact' ? 'small' : 'middle'}
                page={page}
                pageSize={pageSize}
                total={items.length}
                onChange={setPage}
              />
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
