/**
 * 通用列表面板：搜索栏（输入即检）+ 右侧动作区（含卡片/列表渲染切换）+ 双形态展示。
 * 工具库与任务中心共用——「货架—柜台」一致体验的落点。
 * 可配置（默认行为不变）：分页 / 搜索开关 / 多选 / 行内动作 / 密度 / 边框 / 卡片间隔 / 长宽（style）。
 */

import { BarsOutlined, AppstoreOutlined, SearchOutlined } from '@ant-design/icons'
import { Checkbox, Col, Empty, Input, List, Pagination, Row, Segmented, Spin } from 'antd'
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
  renderCard: (item: T) => ReactNode
  renderRow: (item: T) => ReactNode
  onItemClick?: (item: T) => void
  defaultView?: 'card' | 'list'
  emptyText?: string
  /** 分页：true=默认每页 10；对象可指定 pageSize；仅列表形态生效 */
  pagination?: boolean | { pageSize?: number }
  /** 多选：列表形态每行前置 Checkbox，变化即回调 */
  selectable?: { onChange: (keys: React.Key[], items: T[]) => void }
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
  const [checked, setChecked] = useState<React.Key[]>([])
  const timer = useRef<number>()
  const pageSize = typeof pagination === 'object' ? (pagination.pageSize ?? 10) : 10

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

  const paged = pagination && view === 'list'
    ? items.slice((page - 1) * pageSize, page * pageSize)
    : items

  const toggle = (key: React.Key) => {
    const next = checked.includes(key) ? checked.filter((k) => k !== key) : [...checked, key]
    setChecked(next)
    selectable?.onChange(next, items.filter((it) => next.includes(rowKey(it))))
  }


  return (
    <div style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 12,
          marginBottom: 16,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {onSearch && (
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder={searchPlaceholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        )}
        <div style={{ flex: 1 }} />
        {extraActions}
        <Segmented
          value={view}
          onChange={(v) => switchView(v as 'card' | 'list')}
          options={[
            { value: 'card', icon: <AppstoreOutlined />, title: '卡片式' },
            { value: 'list', icon: <BarsOutlined />, title: '列表式' },
          ]}
        />
      </div>

      {loading ? (
        <Spin style={{ display: 'block', margin: '60px auto' }} />
      ) : items.length === 0 ? (
        <Empty description={emptyText} style={{ margin: '60px 0' }} />
      ) : view === 'card' ? (
        <Row gutter={cardGutter}>
          {items.map((item) => (
            <Col key={rowKey(item)} xs={24} sm={12} lg={8} xl={6}>
              {renderCard(item)}
            </Col>
          ))}
        </Row>
      ) : (
        <>
          <List
            dataSource={paged}
            split={bordered}
            renderItem={(item) => {
              const key = rowKey(item)
              return (
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
                      ? { border: '1px solid #f0f0f0', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }
                      : undefined),
                  }}
                >
                  {selectable && (
                    <Checkbox
                      checked={checked.includes(key)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggle(key)}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>{renderRow(item)}</div>
                  {rowActions && (
                    <div onClick={(e) => e.stopPropagation()}>{rowActions(item)}</div>
                  )}
                </div>
              )
            }}
          />
          {paged && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
              <Pagination
                size={density === 'compact' ? 'small' : undefined}
                current={page}
                pageSize={pageSize}
                total={items.length}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
