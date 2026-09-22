/** 阅读卡片弹窗：纯渲染 cards props，内容来自 config（组件零文案）。 */

import { useState } from 'react'
import { Button, Card, Modal } from '@/ui'

export interface HelpCardModalProps {
  cards: { title: string; body: string }[]
  title?: string
}

export function HelpCardModal({ cards, title = '阅读卡片' }: HelpCardModalProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="tertiary" onClick={() => setOpen(true)} aria-label={title}>
        阅读
      </Button>
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {cards.map((card) => (
            <Card key={card.title} variant="secondary">
              <Card.Content>
                <strong>{card.title}</strong>
                <p style={{ color: 'var(--cw-text-secondary)', margin: '4px 0 0' }}>
                {card.body}
                </p>
              </Card.Content>
            </Card>
          ))}
                </div>
              </Modal.Body>
              <Modal.CloseTrigger>关闭</Modal.CloseTrigger>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  )
}
