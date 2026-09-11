/** 详情弹窗壳：头部（标题+标签+描述）+ 主体插槽 + 底部动作区（主操作如「运行」放这里）。
 *  纯装配件零业务语义；与实体详情路由页共用内容组件（组件嵌套）。 */

import { Modal, Space, Typography } from 'antd'
import type { ReactNode } from 'react'

export function DetailModal({
  open,
  onClose,
  title,
  tags,
  description,
  width = 880,
  footerAction,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  tags?: ReactNode
  description?: ReactNode
  width?: number | string
  footerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      destroyOnHidden
      title={
        <Space size={8} wrap>
          <span>{title}</span>
          {tags}
        </Space>
      }
    >
      {description != null && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {description}
        </Typography.Paragraph>
      )}
      {children}
      {footerAction != null && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            borderTop: '1px solid #f0f0f0',
            paddingTop: 12,
            marginTop: 12,
          }}
        >
          {footerAction}
        </div>
      )}
    </Modal>
  )
}
