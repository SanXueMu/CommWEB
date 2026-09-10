import { jsx as _jsx } from "react/jsx-runtime";
/** 文档面板：markdown 全文渲染（工具/流共用，内容一律来自数据接口）。 */
import { Card } from 'antd';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function DocPanel({ docMd, title = '文档' }) {
    if (!docMd)
        return null;
    return (_jsx(Card, { size: "small", title: title, style: { marginTop: 16 }, children: _jsx("div", { className: "commweb-doc", children: _jsx(Markdown, { remarkPlugins: [remarkGfm], children: docMd }) }) }));
}
