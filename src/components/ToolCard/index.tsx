import { Card, Space, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import type { ToolSummary } from '@/api/types'

/** 货架单元：id/名称/描述/类型标签/runtime 形态。 */
export function ToolCard({ tool }: { tool: ToolSummary }) {
  return (
    <Link to={`/tools/${tool.id}`}>
      <Card hoverable size="small" style={{ height: '100%' }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong>{tool.name}</Typography.Text>
          <Typography.Text type="secondary" code style={{ fontSize: 12 }}>
            {tool.id}
          </Typography.Text>
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0, minHeight: 44 }}>
            {tool.description || '（无描述）'}
          </Typography.Paragraph>
          <Space size={4} wrap>
            {tool.input_types.map((t) => (
              <Tag key={t} color="blue">{t}</Tag>
            ))}
            <span style={{ color: '#8c8c8c' }}>→</span>
            {tool.output_types.map((t) => (
              <Tag key={t} color="green">{t}</Tag>
            ))}
            <Tag>{tool.runtime_kind}</Tag>
          </Space>
        </Space>
      </Card>
    </Link>
  )
}
