/**
 * SidebarShell：响应式侧栏壳（UI 原则③——宽/竖屏一等设计维度）。
 * 宽屏（≥768）：固定侧栏内联渲染；窄屏（<768）：收进 Drawer，由触发按钮唤起。
 * 「已上传原件」「结果库」「筛选栏」等一切侧栏统一走此壳，禁止再写死固定宽度。
 */

import { MenuOutlined } from '@ant-design/icons'
import { Button, Drawer } from 'antd'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useViewport } from '@/hooks/useViewport'

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
        <Button size="small" icon={<MenuOutlined />} onClick={() => setOpen(true)} style={{ marginBottom: 8 }}>
          {label}
        </Button>
        <Drawer title={label} placement="left" open={open} onClose={() => setOpen(false)} width="80%">
          {children}
        </Drawer>
      </>
    )
  }
  return (
    <div style={{ width: `min(${width}px, 30vw)`, flexShrink: 0 }}>
      <div style={{ position: 'sticky', top: 12 }}>{children}</div>
    </div>
  )
}
