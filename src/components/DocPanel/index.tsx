/** 文档面板：markdown 全文渲染（工具/流共用，内容一律来自数据接口）。 */

import { Card } from 'antd'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface DocPanelProps {
  docMd?: string | null
  title?: string
}

export function DocPanel({ docMd, title = '文档' }: DocPanelProps) {
  if (!docMd) return null
  return (
    <Card size="small" title={title} style={{ marginTop: 16 }}>
      <div className="commweb-doc">
        <Markdown remarkPlugins={[remarkGfm]}>{docMd}</Markdown>
      </div>
    </Card>
  )
}
