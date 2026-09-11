/** 实体详情布局：头部元信息（PanelCard 基座）→ 分级内容区（sections）→ 文档 → 主体插槽。
 *  「点进详情先看介绍」的标准装配——ToolDetail / FlowDetail 共用，禁止再手搓详情头。
 *  sections 支持标题/正文分级，content 可嵌套 LifeFlow / 表格等小页面组件（组件嵌套复用）。 */

import { Space, Typography } from 'antd'
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
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PanelCard>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={8}>
            {workspaceAction}
            <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
            {tags}
          </Space>
          {description && <Typography.Text type="secondary">{description}</Typography.Text>}
          {meta}
        </Space>
      </PanelCard>
      {sections?.map((s, i) => (
        <Space direction="vertical" size={8} style={{ width: '100%' }} key={s.heading ?? i}>
          {s.heading &&
            (s.level === 1 ? (
              <Typography.Title level={5} style={{ margin: 0 }}>
                {s.heading}
              </Typography.Title>
            ) : (
              <Typography.Text type="secondary" strong>
                {s.heading}
              </Typography.Text>
            ))}
          {s.content}
        </Space>
      ))}
      {docs}
      {children}
    </Space>
  )
}
