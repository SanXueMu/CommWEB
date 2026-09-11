/** 面板卡片壳：细灰边框 + hover 浮起，工具/流/任务卡片的统一外观（消复制粘贴）。
 *  可定制：背景色 / 头部标题与标题色 / 弧形直角边框（radius: 'round'=10px | 'sharp'=0 | 数值）。 */

import type { CSSProperties, ReactNode } from 'react'

export function PanelCard({
  children,
  onClick,
  style,
  bgColor,
  title,
  titleColor,
  radius = 'round',
}: {
  children: ReactNode
  onClick?: () => void
  style?: CSSProperties
  bgColor?: string
  title?: ReactNode
  titleColor?: string
  radius?: number | 'round' | 'sharp'
}) {
  const resolvedRadius = radius === 'round' ? 10 : radius === 'sharp' ? 0 : radius
  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid #ececec',
        borderRadius: resolvedRadius,
        padding: 16,
        height: '100%',
        background: bgColor ?? '#fff',
        transition: 'box-shadow .2s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {title != null && (
        <div style={{ color: titleColor, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      )}
      {children}
    </div>
  )
}
