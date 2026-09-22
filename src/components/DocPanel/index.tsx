/** 文档面板：markdown 全文渲染（工具/流共用，内容一律来自数据接口）。 */

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card } from '@/ui'

export interface DocPanelProps {
  docMd?: string | null
  title?: string
}

export function DocPanel({ docMd, title = '文档' }: DocPanelProps) {
  if (!docMd) return null
  return (
    <Card style={{ marginTop: 16 }}>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <div className="commweb-doc">
          <Markdown remarkPlugins={[remarkGfm]}>{docMd}</Markdown>
        </div>
      </Card.Content>
    </Card>
  )
}
