/** 目录徽章基座：value 经目录解析为 label + color 后渲染 Tag（目录驱动徽章族唯一底座）。
 *  目录与颜色策略由调用方注入——StatusBadge = statuses 目录 + 主题色组；
 *  流类型徽章 / 启停徽章等同模式扩展，禁止再手写 value→Tag 的目录消费逻辑。
 *  可定制：三档大小 / 圆角（'round'=胶囊） / plain 无背景（仅描边文字色）。 */

import { Tag } from 'antd'
import type { CSSProperties } from 'react'

const SIZE_STYLES = {
  sm: { fontSize: 11, padding: '0 6px', lineHeight: '18px' },
  md: {}, // md = AntD Tag 默认
  lg: { fontSize: 14, padding: '2px 12px', lineHeight: '24px' },
} as const

/** fallback='auto' 时按 value hash 稳定取色的轻色板（纯文本标签的默认配色策略）。 */
const AUTO_PALETTE = ['#3bb093', '#202753', '#1677ff', '#722ed1', '#d46b08', '#0958d9', '#5b8c00', '#c41d7f']

function autoColor(value: string): string {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return AUTO_PALETTE[h % AUTO_PALETTE.length]
}

export function CatalogBadge<V extends string, E extends { label?: string }>({
  value,
  catalog,
  resolveColor,
  fallback = '#8c8c8c',
  style,
  size = 'md',
  radius,
  plain,
}: {
  value: V
  catalog: Map<V, E>
  resolveColor?: (value: V, entry: E | undefined) => string
  fallback?: string
  style?: CSSProperties
  size?: keyof typeof SIZE_STYLES
  radius?: number | 'round'
  plain?: boolean
}) {
  const entry = catalog.get(value)
  const color = resolveColor ? resolveColor(value, entry) : fallback === 'auto' ? autoColor(value) : fallback
  return (
    <Tag
      color={plain ? undefined : color}
      style={{
        marginRight: 0,
        ...SIZE_STYLES[size],
        ...(plain
          ? { background: 'transparent', border: `1px solid ${color}`, color }
          : undefined),
        ...(radius === 'round' ? { borderRadius: 999 } : undefined),
        ...style,
      }}
    >
      {entry?.label ?? value}
    </Tag>
  )
}
