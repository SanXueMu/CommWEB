/** 阅读卡片弹窗：工具库的使用说明（如何上架 / 标签从哪来 / ToolFace 一句话）。 */

import { BookOutlined } from '@ant-design/icons'
import { Button, Card, Modal, Space, Typography } from 'antd'
import { useState } from 'react'

const CARDS = [
  {
    title: '这里是什么',
    body: '工具库是 CommAND 注册表的前端货架。每个工具只需一份 tool.toml 清单，刷新即自动上架——零前端代码。',
  },
  {
    title: '如何让工具上架',
    body: '在 CommAND 的 tools/ 下建目录，写 tool.toml（id / 输入输出 schema / runtime 形态），执行 register 即可。表单由 input_schema 自动推导。',
  },
  {
    title: '标签从哪来',
    body: '标签写在 tool.toml 的 [tool] tags 里，随注册进入注册表，用于左侧筛选。建议用稳定的类型词（文本 / 表格 / 文档…）。',
  },
  {
    title: 'ToolFace 协议',
    body: 'schema 推导为基线（零代码可用），[ui] 声明为增强（改文案 / 换控件 / 排序），render 声明改善输出呈现。协议住进 manifest，随 API 下发。',
  },
]

export function HelpCardModal() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="text"
        icon={<BookOutlined />}
        onClick={() => setOpen(true)}
        title="阅读卡片"
      />
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={680}
        title="阅读卡片 · 工具库说明"
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          {CARDS.map((card) => (
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
