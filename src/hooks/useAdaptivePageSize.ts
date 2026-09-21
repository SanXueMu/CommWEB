/**
 * useAdaptivePageSize：按容器高度自适应每页行数（UI 原则①——控高，禁止依赖页面滚动）。
 * ResizeObserver 实测容器内容高 → pageSize = clamp(floor(高/行高), min, max)。
 * 列表容器高度变化（窗口缩放/横竖屏切换）自动重算。
 */

import { useEffect, useRef, useState } from 'react'

export interface AdaptivePageSizeOptions {
  /** 单行高度（px，含分隔/间距） */
  rowHeight: number
  /** 最少行数（容器测量失败时的兜底也用它） */
  min?: number
  /** 最多行数 */
  max?: number
  /** 头部/尾部预留高度（px，如工具栏、分页条） */
  reserve?: number
}

export function useAdaptivePageSize<T extends HTMLElement>(
  options: AdaptivePageSizeOptions,
): [React.RefObject<T | null>, number] {
  const { rowHeight, min = 5, max = 50, reserve = 0 } = options
  const ref = useRef<T>(null)
  const [pageSize, setPageSize] = useState(min)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const usable = el.clientHeight - reserve
      const rows = Math.floor(usable / rowHeight)
      setPageSize(Math.max(min, Math.min(max, rows > 0 ? rows : min)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [rowHeight, min, max, reserve])

  return [ref, pageSize]
}
