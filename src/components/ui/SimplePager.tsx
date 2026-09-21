/**
 * SimplePager：简约翻页符（UI 原则①②——控高 + 美观）。
 * 总页数 ≤ simplePages（默认 3）时只渲染 ‹ › 与「n/m」，不显示页码列表；
 * 超过阈值回落完整分页。窄屏（narrow）一律简约形态。
 */

import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Pagination } from 'antd'
import { useViewport } from '@/hooks/useViewport'

export interface SimplePagerProps {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
  /** 简约阈值：总页数 ≤ 此值用 ‹ › 形态 */
  simplePages?: number
  size?: 'small' | 'middle'
}

export function SimplePager({ page, pageSize, total, onChange, simplePages = 3, size = 'small' }: SimplePagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const { breakpoint } = useViewport()
  const simple = pages <= simplePages || breakpoint === 'narrow'
  if (!simple) {
    return (
      <Pagination
        size={size === 'small' ? 'small' : undefined}
        current={page}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        showSizeChanger={false}
      />
    )
  }
  const btn = (disabled: boolean, icon: React.ReactNode, delta: number) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(page + delta)}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--cw-text-muted)' : 'inherit',
        padding: '0 6px',
        fontSize: 13,
        lineHeight: '22px',
      }}
    >
      {icon}
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, color: 'var(--cw-text-muted)' }}>
      {btn(page <= 1, <LeftOutlined />, -1)}
      <span style={{ minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {page}/{pages}
      </span>
      {btn(page >= pages, <RightOutlined />, 1)}
    </div>
  )
}
