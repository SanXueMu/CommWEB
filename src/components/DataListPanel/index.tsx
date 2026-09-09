/**
 * 通用列表面板：搜索栏（输入即检）+ 右侧动作区（含卡片/列表渲染切换）+ 双形态展示。
 * 工具库与任务中心共用——「货架—柜台」一致体验的落点。
 */

import { BarsOutlined, AppstoreOutlined, SearchOutlined } from '@ant-design/icons'
import { Col, Empty, Input, List, Row, Segmented, Spin } from 'antd'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface DataListPanelProps<T> {
  panelKey: string
  items: T[]
  loading?: boolean
  rowKey: (item: T) => string
  onSearch: (keyword: string) => void
  searchPlaceholder?: string
  extraActions?: ReactNode
  renderCard: (item: T) => ReactNode
  renderRow: (item: T) => ReactNode
  onItemClick?: (item: T) => void
  defaultView?: 'card' | 'list'
  emptyText?: string
}

export function DataListPanel<T>({
  panelKey,
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
}: DataListPanelProps<T>) {
  const storageKey = `commweb.view.${panelKey}`
  const [view, setView] = useState<'card' | 'list'>(
    () => (localStorage.getItem(storageKey) as 'card' | 'list') ?? defaultView,
  )
  const [keyword, setKeyword] = useState('')
  const timer = useRef<number>()

  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onSearch(keyword), 250)
    return () => window.clearTimeout(timer.current)
    // onSearch 由父组件闭包持有过滤逻辑，身份变化无需重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const switchView = (next: 'card' | 'list') => {
    localStorage.setItem(storageKey, next)
    setView(next)
  }

  return (
    <div>
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
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder={searchPlaceholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ maxWidth: 320 }}
        />
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
        <Row gutter={[12, 12]}>
          {items.map((item) => (
            <Col key={rowKey(item)} xs={24} sm={12} lg={8} xl={6}>
              {renderCard(item)}
            </Col>
          ))}
        </Row>
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <div
              className="commweb-list-row"
              onClick={() => onItemClick?.(item)}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              {renderRow(item)}
            </div>
          )}
        />
      )}
    </div>
  )
}
