/** 面板卡片壳：细灰边框 + hover 浮起，工具/流/任务卡片的统一外观（消复制粘贴）。 */

import type { CSSProperties, ReactNode } from 'react'

export function PanelCard({
  children,
  onClick,
  style,
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #ececec',
        borderRadius: 10,
        padding: 16,
        height: '100%',
        background: '#fff',
        transition: 'box-shadow .2s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {children}
    </div>
  )
}
