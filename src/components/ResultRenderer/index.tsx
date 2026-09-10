import { Empty, Table, Typography } from 'antd'
import { detectRenderer, extractTable, extractText, rowNeedsReview } from '@/protocol/renderers'

/** 输出渲染：table（待审行高亮）/ text / json 三形态自动分派。highlight 来自 manifest [ui.render]。 */
export function ResultRenderer({ output, highlight }: { output: unknown; highlight?: string[] }) {
  const kind = detectRenderer(output)

  if (output == null) return <Empty description="无输出" image={Empty.PRESENTED_IMAGE_SIMPLE} />

  if (kind === 'text') {
    return (
      <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6 }}>
        {extractText(output)}
      </pre>
    )
  }

  if (kind === 'table') {
    const table = extractTable(output)!
    return (
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        pagination={false}
        scroll={{ x: 'max-content', y: 360 }}
        rowClassName={(row) => (rowNeedsReview(row as Record<string, unknown>, highlight) ? 'commweb-review-row' : '')}
        columns={table.columns.map((col) => ({
          title: col,
          dataIndex: col,
          key: col,
          ellipsis: true,
          render: (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')),
        }))}
        dataSource={table.rows}
      />
    )
  }

  return (
    <Typography.Paragraph>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>
        {JSON.stringify(output, null, 2)}
      </pre>
    </Typography.Paragraph>
  )
}
