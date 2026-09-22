/** 实体详情布局：头部元信息（PanelCard 基座）→ 分级内容区（sections）→ 文档 → 主体插槽。
 *  「点进详情先看介绍」的标准装配——ToolDetail / FlowDetail 共用，禁止再手搓详情头。
 *  sections 支持标题/正文分级，content 可嵌套 LifeFlow / 表格等小页面组件（组件嵌套复用）。 */

import type { ReactNode } from 'react'
import { PanelCard } from '@/components/ui/PanelCard'

export interface EntitySection {
  heading?: string
  /** 1=区块大标题（H5 级），2=小节标题（H6 级）；默认 2 */
  level?: 1 | 2
  content: ReactNode
}

export function EntityDetailLayout({
  title,
  tags,
  description,
  meta,
  workspaceAction,
  sections,
  docs,
  children,
}: {
  title: ReactNode
  tags?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  workspaceAction?: ReactNode
  sections?: EntitySection[]
  docs?: ReactNode
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <PanelCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {workspaceAction}
            <h4 style={{ fontSize: 20, lineHeight: 1.4, margin: 0 }}>{title}</h4>
            {tags}
          </div>
          {description && <div style={{ color: 'var(--cw-text-secondary)' }}>{description}</div>}
          {meta}
        </div>
      </PanelCard>
      {sections?.map((s, i) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }} key={s.heading ?? i}>
          {s.heading &&
            (s.level === 1 ? (
              <h5 style={{ fontSize: 16, lineHeight: 1.4, margin: 0 }}>{s.heading}</h5>
            ) : (
              <strong style={{ color: 'var(--cw-text-secondary)' }}>{s.heading}</strong>
            ))}
          {s.content}
        </div>
      ))}
      {docs}
      {children}
    </div>
  )
}
