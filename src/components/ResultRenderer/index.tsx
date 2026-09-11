import { Badge, Collapse, Empty, Table, Typography } from 'antd'
import { PORTAL } from '@/config/portal'
import { detectRenderer, extractTable, extractText, rowNeedsReview } from '@/protocol/renderers'

/** 声明式拆分结果（视图引擎 split 段）：{title?, columns?, rows}[]，来自 output.splits。 */
function extractSplits(output: unknown): { title?: string; columns?: string[]; rows: Record<string, unknown>[] }[] {
  if (output && typeof output === 'object' && Array.isArray((output as Record<string, unknown>).splits)) {
    const arr = (output as Record<string, unknown>).splits as Record<string, unknown>[]
    return arr
      .filter((s) => Array.isArray(s.rows))
      .map((s) => ({
        title: typeof s.title === 'string' ? s.title : undefined,
        columns: Array.isArray(s.columns) ? (s.columns as string[]) : undefined,
        rows: s.rows as Record<string, unknown>[],
      }))
  }
  return []
}

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
    const splits = extractSplits(output)
    return (
      <div>
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
        {splits.length > 0 && (
          <Collapse
            ghost
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
