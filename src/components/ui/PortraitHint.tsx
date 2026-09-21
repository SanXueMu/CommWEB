/**
 * PortraitHint：竖屏柔性引导 Banner（UI 原则③）。
 * 仅窄屏+竖屏时显示「横屏体验更佳」，可关闭、不阻断操作；
 * 引导而非门槛——竖屏下全部功能仍可用（组件已响应式适配）。
 */

import { Alert } from 'antd'
import { useState } from 'react'
import { useViewport } from '@/hooks/useViewport'

export function PortraitHint({ text = '当前为竖屏，转横屏体验更佳' }: { text?: string }) {
  const { breakpoint, orientation } = useViewport()
  const [closed, setClosed] = useState(false)
  if (breakpoint !== 'narrow' || orientation !== 'portrait' || closed) return null
  return (
    <Alert
      message={text}
      type="info"
      showIcon
      closable
      afterClose={() => setClosed(true)}
      style={{ marginBottom: 8 }}
    />
  )
}
