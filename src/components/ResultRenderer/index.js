import { jsx as _jsx } from "react/jsx-runtime";
import { Empty, Table, Typography } from 'antd';
import { detectRenderer, extractTable, extractText, rowNeedsReview } from '@/protocol/renderers';
/** 输出渲染：table（待审行高亮）/ text / json 三形态自动分派。highlight 来自 manifest [ui.render]。 */
export function ResultRenderer({ output, highlight }) {
    const kind = detectRenderer(output);
    if (output == null)
        return _jsx(Empty, { description: "\u65E0\u8F93\u51FA", image: Empty.PRESENTED_IMAGE_SIMPLE });
    if (kind === 'text') {
        return (_jsx("pre", { style: { whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.04)', padding: 12, borderRadius: 6 }, children: extractText(output) }));
    }
    if (kind === 'table') {
        const table = extractTable(output);
        return (_jsx(Table, { size: "small", rowKey: (_, i) => String(i), pagination: false, scroll: { x: 'max-content', y: 360 }, rowClassName: (row) => (rowNeedsReview(row, highlight) ? 'commweb-review-row' : ''), columns: table.columns.map((col) => ({
                title: col,
                dataIndex: col,
                key: col,
                ellipsis: true,
                render: (value) => (typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')),
            })), dataSource: table.rows }));
    }
    return (_jsx(Typography.Paragraph, { children: _jsx("pre", { style: { whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }, children: JSON.stringify(output, null, 2) }) }));
}
