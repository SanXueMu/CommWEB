import { useQuery } from '@tanstack/react-query'
import { Col, Empty, Input, Row, Space, Spin, Typography } from 'antd'
import { useState } from 'react'
import { api } from '@/api/client'
import { ToolCard } from '@/components/ToolCard'

/** 货架：发现工具。新工具注册后刷新即见——「兼容万物」的前端回归点。 */
export function Plaza() {
  const [keyword, setKeyword] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['tools'], queryFn: api.listTools })

  if (isLoading) return <Spin style={{ display: 'block', margin: '80px auto' }} />
  const tools = (data?.tools ?? []).filter(
    (t) => !keyword || t.id.includes(keyword) || t.name.includes(keyword),
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Input.Search
        size="large"
        placeholder="搜索工具（id / 名称）"
        allowClear
        onSearch={setKeyword}
        onChange={(e) => !e.target.value && setKeyword('')}
      />
      {tools.length === 0 ? (
        <Empty description="暂无工具——先在 CommAND 侧 register" style={{ margin: '80px 0' }} />
      ) : (
        <Row gutter={[16, 16]}>
          {tools.map((tool) => (
            <Col key={tool.id} xs={24} sm={12} lg={8} xl={6}>
              <ToolCard tool={tool} />
            </Col>
          ))}
        </Row>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        共 {tools.length} 个工具 · 零前端代码自动上架
      </Typography.Text>
    </Space>
  )
}
