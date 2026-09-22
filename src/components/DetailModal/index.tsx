/** 详情弹窗壳：头部（标题+标签+描述）+ 主体插槽 + 底部动作区（主操作如「运行」放这里）。
 *  纯装配件零业务语义；与实体详情路由页共用内容组件（组件嵌套）。 */

import type { ReactNode } from 'react'
import { Modal } from '@/ui'

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
    <Modal isOpen={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Modal.Backdrop>
        <div style={{ maxWidth: typeof width === 'number' ? width : width, width: '100%' }}>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  <span style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {title}
                    {tags}
                  </span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {description != null && <p style={{ color: 'var(--cw-text-secondary)', margin: '0 0 12px' }}>{description}</p>}
                {children}
                {footerAction != null && (
                  <div style={{ borderTop: '1px solid var(--cw-border)', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, paddingTop: 12 }}>
                    {footerAction}
                  </div>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </div>
      </Modal.Backdrop>
    </Modal>
  )
}
