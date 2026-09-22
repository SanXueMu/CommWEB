import { useState } from 'react'
import { PORTAL } from '@/config/portal'
import { detectRenderer, extractSplits, extractTable, extractText, rowNeedsReview } from '@/protocol/renderers'

function renderValue(value: unknown) {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
}

function DataTable({ columns, rows, highlight }: { columns: string[]; rows: Record<string, unknown>[]; highlight?: string[] }) {
  return <div style={{ overflow: 'auto', maxHeight: 360 }}><table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
    <thead><tr>{columns.map((col) => <th key={col} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--cw-border)' }}>{PORTAL.META_COLUMN_LABELS[col] ?? col}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index} className={rowNeedsReview(row, highlight) ? 'commweb-review-row' : undefined}>{columns.map((col) => <td key={col} style={{ padding: 8, verticalAlign: 'top' }}>{renderValue(row[col])}</td>)}</tr>)}</tbody>
  </table></div>
}

/** 输出渲染：table（主表 + 可选 splits 页签）/ text / json 三形态自动分派。 */
export function ResultRenderer({ output, highlight }: { output: unknown; highlight?: string[] }) {
  const kind = detectRenderer(output)
  const [activeSplit, setActiveSplit] = useState(0)
  if (output == null) return <div>无输出</div>
  if (kind === 'text') return <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6 }}>{extractText(output)}</pre>
  if (kind === 'table') {
    const table = extractTable(output, ['splits'])
    const splits = extractSplits(output)
    const split = splits[activeSplit]
    return <div>
      {table ? <DataTable columns={table.columns} rows={table.rows} highlight={highlight} /> : <div>主表无数据</div>}
      {splits.length > 0 && <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--cw-border)', paddingBottom: 6 }}>
          {splits.map((item, index) => <button type="button" key={index} onClick={() => setActiveSplit(index)} style={{ border: 0, background: index === activeSplit ? 'var(--cw-accent)' : 'transparent', padding: '4px 8px', cursor: 'pointer' }}>{item.title ?? `拆分 ${index + 1}`} ({item.rows.length})</button>)}
        </div>
        {split && <DataTable columns={split.columns ?? Object.keys(split.rows[0] ?? {})} rows={split.rows} />}
      </div>}
    </div>
  }
  return <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{JSON.stringify(output, null, 2)}</pre>
}
