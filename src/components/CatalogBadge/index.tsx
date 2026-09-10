/** 目录徽章基座：value 经目录解析为 label + color 后渲染 Tag（目录驱动徽章族唯一底座）。
 *  目录与颜色策略由调用方注入——StatusBadge = statuses 目录 + 主题色组；
 *  流类型徽章 / 启停徽章等同模式扩展，禁止再手写 value→Tag 的目录消费逻辑。 */

import { Tag } from 'antd'
import type { CSSProperties } from 'react'

export function CatalogBadge<V extends string, E extends { label?: string }>({
  value,
  catalog,
  resolveColor,
  fallback = '#8c8c8c',
  style,
}: {
  value: V
  catalog: Map<V, E>
  resolveColor?: (value: V, entry: E | undefined) => string
  fallback?: string
  style?: CSSProperties
}) {
  const entry = catalog.get(value)
  const color = resolveColor ? resolveColor(value, entry) : fallback
  return (
    <Tag color={color} style={{ marginRight: 0, ...style }}>
      {entry?.label ?? value}
    </Tag>
  )
}
