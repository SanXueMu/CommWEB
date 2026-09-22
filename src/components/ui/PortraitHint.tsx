/**
 * PortraitHint：竖屏柔性引导 Banner（UI 原则③）。
 * 仅窄屏+竖屏时显示「横屏体验更佳」，可关闭、不阻断操作；
 * 引导而非门槛——竖屏下全部功能仍可用（组件已响应式适配）。
 */

import { useState } from 'react'
import { useViewport } from '@/hooks/useViewport'
import { Button } from '@/ui'

export function PortraitHint({ text = '当前为竖屏，转横屏体验更佳' }: { text?: string }) {
  const { breakpoint, orientation } = useViewport()
  const [closed, setClosed] = useState(false)
  if (breakpoint !== 'narrow' || orientation !== 'portrait' || closed) return null
  return (
    <div
      role="status"
      style={{
        alignItems: 'center',
        background: 'color-mix(in srgb, var(--cw-primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--cw-primary) 30%, transparent)',
        borderRadius: 8,
        display: 'flex',
        gap: 8,
        justifyContent: 'space-between',
        marginBottom: 8,
        padding: '8px 12px',
      }}
    >
      <span>{text}</span>
      <Button size="sm" variant="tertiary" onClick={() => setClosed(true)} aria-label="关闭提示">
        关闭
      </Button>
    </div>
  )
}
