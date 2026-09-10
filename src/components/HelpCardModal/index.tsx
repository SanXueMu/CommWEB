/** 阅读卡片弹窗：纯渲染 cards props，内容来自 config（组件零文案）。 */

import { BookOutlined } from '@ant-design/icons'
import { Button, Card, Modal, Space, Typography } from 'antd'
import { useState } from 'react'

export interface HelpCardModalProps {
  cards: { title: string; body: string }[]
  title?: string
}

export function HelpCardModal({ cards, title = '阅读卡片' }: HelpCardModalProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="text" icon={<BookOutlined />} onClick={() => setOpen(true)} title={title} />
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} width={680} title={title}>
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          {cards.map((card) => (
            <Card key={card.title} size="small" style={{ border: '1px solid #f0f0f0' }}>
              <Typography.Text strong>{card.title}</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                {card.body}
              </Typography.Paragraph>
            </Card>
          ))}
        </Space>
      </Modal>
    </>
  )
}
