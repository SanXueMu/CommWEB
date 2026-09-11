import { Badge, Empty, Table, Tabs, Typography } from 'antd'
import { PORTAL } from '@/config/portal'
import { detectRenderer, extractSplits, extractTable, extractText, rowNeedsReview } from '@/protocol/renderers'

/** 输出渲染：table（主表 + 可选 splits 页签）/ text / json 三形态自动分派。highlight 来自 manifest [ui.render]。 */
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
    // splits 是子表集合：主表提取必须排除，否则空主表会被子表顶替成一张错表
    // （detectRenderer 仍按不排除来判定形态，故空主表 + 有 splits 会走进这里）
    const table = extractTable(output, ['splits'])
    const splits = extractSplits(output)
    return (
      <div>
        {table ? (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            pagination={false}
            scroll={{ x: 'max-content', y: 360 }}
            rowClassName={(row) => (rowNeedsReview(row as Record<string, unknown>, highlight) ? 'commweb-review-row' : '')}
            columns={table.columns.map((col) => ({
              title: PORTAL.META_COLUMN_LABELS[col] ?? col,
              dataIndex: col,
              key: col,
              ellipsis: true,
              render: (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')),
            }))}
            dataSource={table.rows}
          />
        ) : (
          <Empty description="主表无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
        {splits.length > 0 && (
          <Tabs
            size="small"
            style={{ marginTop: 8 }}
            items={splits.map((s, i) => ({
              key: String(i),
              label: <Badge count={s.rows.length} size="small" offset={[10, 2]}>{s.title ?? `拆分 ${i + 1}`}</Badge>,
              children: (
                <Table
                  size="small"
                  rowKey={(_, j) => String(j)}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  columns={(s.columns ?? Object.keys(s.rows[0] ?? {})).map((col: string) => ({
                    title: col,
                    dataIndex: col,
                    key: col,
                    ellipsis: true,
                    render: (value: unknown) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')),
                  }))}
                  dataSource={s.rows}
                />
              ),
            }))}
          />
        )}
      </div>
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
