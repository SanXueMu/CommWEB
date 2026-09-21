/**
 * useViewport：统一视口断点模型（UI 原则③——宽/竖屏一等设计维度）。
 * 断点：wide ≥1200 / medium 768-1199 / narrow <768；orientation 区分横竖屏。
 * 全组件统一消费此 hook，禁止各处自写 window.innerWidth 判断。
 */

import { useEffect, useState } from 'react'

export type ViewportBreakpoint = 'wide' | 'medium' | 'narrow'

export interface Viewport {
  breakpoint: ViewportBreakpoint
  width: number
  /** 竖屏（portrait）= 高 > 宽；横屏（landscape）= 宽 ≥ 高 */
  orientation: 'portrait' | 'landscape'
}

function read(): Viewport {
  const width = window.innerWidth
  const breakpoint: ViewportBreakpoint = width >= 1200 ? 'wide' : width >= 768 ? 'medium' : 'narrow'
  return { breakpoint, width, orientation: window.innerHeight > width ? 'portrait' : 'landscape' }
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)
  useEffect(() => {
    const onResize = () => setVp(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}
