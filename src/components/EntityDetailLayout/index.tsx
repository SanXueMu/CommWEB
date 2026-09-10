/** 实体详情布局：头部元信息（PanelCard 基座）→ 文档 → 主体插槽。
 *  「点进详情先看介绍」的标准装配——ToolDetail / FlowDetail 共用，禁止再手搓详情头。 */

import { Space, Typography } from 'antd'
import type { ReactNode } from 'react'
import { PanelCard } from '@/components/ui/PanelCard'

export function EntityDetailLayout({
  title,
  tags,
  description,
  meta,
  workspaceAction,
  docs,
  children,
}: {
  title: ReactNode
  tags?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  workspaceAction?: ReactNode
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
      {docs}
      {children}
    </Space>
  )
}
