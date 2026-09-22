/**
 * SidebarShell：响应式侧栏壳（UI 原则③——宽/竖屏一等设计维度）。
 * 宽屏（≥768）：固定侧栏内联渲染；窄屏（<768）：收进 Drawer，由触发按钮唤起。
 * 「已上传原件」「结果库」「筛选栏」等一切侧栏统一走此壳，禁止再写死固定宽度。
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useViewport } from '@/hooks/useViewport'
import { Button, Drawer } from '@/ui'

export interface SidebarShellProps {
  /** 触发按钮/侧栏标题文案 */
  label: string
  /** 宽屏模式侧栏宽度 px（maxWidth 可配合 min() 由调用方控制） */
  width?: number
  children: ReactNode
}

export function SidebarShell({ label, width = 240, children }: SidebarShellProps) {
  const { breakpoint } = useViewport()
  const [open, setOpen] = useState(false)

  if (breakpoint === 'narrow') {
    return (
      <>
        <Button size="sm" onClick={() => setOpen(true)} style={{ marginBottom: 8 }}>
          <span aria-hidden="true">☰</span>
          {label}
        </Button>
        <Drawer.Root isOpen={open} onOpenChange={setOpen}>
          <Drawer.Backdrop>
            <Drawer.Content placement="left">
              <Drawer.Dialog>
                <Drawer.Header>
                  <Drawer.Heading>{label}</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>{children}</Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer.Root>
      </>
    )
  }
  return (
    <div style={{ width: `min(${width}px, 30vw)`, flexShrink: 0 }}>
      <div style={{ position: 'sticky', top: 12 }}>{children}</div>
    </div>
  )
}
