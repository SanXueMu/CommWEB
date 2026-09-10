import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProviderBadge } from '@/components/ProviderBadge';
import { DataListPanel } from '@/components/DataListPanel';
import { HelpCardModal } from '@/components/HelpCardModal';
import { PanelCard } from '@/components/ui/PanelCard';
import { PORTAL } from '@/config/portal';
import { HELP_CARDS } from '@/config/helpCards';
import { useActivePid } from '@/transfer/context';
import { apiFor } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
/** 货架（packy 风格，T3 聚合模式）：多会员工具混排 + 左侧标签/会员双筛选。 */
export function ToolsHub() {
    const navigate = useNavigate();
    const pid = useActivePid();
    const [keyword, setKeyword] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() });
    const tools = data?.tools ?? [];
    const allTags = useMemo(() => [...new Set(tools.flatMap((t) => t.tags ?? []))], [tools]);
    const filtered = tools.filter((tool) => {
        const hitKeyword = !keyword ||
            tool.id.includes(keyword) ||
            tool.name.includes(keyword) ||
            (tool.description ?? '').includes(keyword) ||
            (tool.tags ?? []).some((t) => t.includes(keyword));
        const hitTags = selectedTags.length === 0 ||
            selectedTags.every((tag) => (tool.tags ?? []).includes(tag));
        return hitKeyword && hitTags;
    });
    const toggleTag = (tag) => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    return (_jsxs("div", { style: { display: 'flex', gap: 24, alignItems: 'flex-start' }, children: [_jsxs("aside", { style: {
                    width: 168,
                    flexShrink: 0,
                    position: 'sticky',
                    top: 76,
                    borderRight: '1px solid #f0f0f0',
                    paddingRight: 16,
                }, children: [_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: "\u6807\u7B7E" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: [allTags.map((tag) => (_jsx(Tag.CheckableTag, { checked: selectedTags.includes(tag), onChange: () => toggleTag(tag), children: tag }, tag))), allTags.length === 0 && (_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: PORTAL.empty.noTags }))] }), selectedTags.length > 0 && (_jsx(Typography.Link, { style: { fontSize: 12, marginTop: 8, display: 'inline-block' }, onClick: () => setSelectedTags([]), children: "\u6E05\u7A7A\u7B5B\u9009" }))] }), _jsxs("main", { style: { flex: 1, minWidth: 0 }, children: [_jsx(DataListPanel, { providerId: pid, panelKey: "tools", items: filtered, loading: isLoading, rowKey: (t) => `${t.providerId ?? 'default'}:${t.id}`, onSearch: setKeyword, searchPlaceholder: PORTAL.search.tools, extraActions: _jsx(HelpCardModal, { cards: HELP_CARDS }), onItemClick: (t) => navigate(`/tools/${encodeURIComponent(t.id)}?provider=${t.providerId ?? 'default'}`), emptyText: PORTAL.empty.tools, renderCard: (tool) => _jsx(ToolCard, { tool: tool }), renderRow: (tool) => _jsx(ToolRow, { tool: tool }) }), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: ["\u5171 ", filtered.length, " \u4E2A\u5DE5\u5177 \u00B7 ", PORTAL.footNote.tools] })] })] }));
}
function ToolCard({ tool }) {
    return (_jsx(Link, { to: `/tools/${tool.id}`, children: _jsxs(PanelCard, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx(Typography.Text, { strong: true, children: tool.name }), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: ["v", tool.version] }), _jsx(ProviderBadge, { pid: tool.providerId ?? 'default' })] }), _jsx(Typography.Paragraph, { type: "secondary", ellipsis: { rows: 2 }, style: { margin: '6px 0 10px', minHeight: 44, fontSize: 13 }, children: tool.description || '（无描述）' }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4 }, children: [(tool.tags ?? []).map((t) => (_jsx(Tag, { style: { marginRight: 0 }, children: t }, t))), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12, marginLeft: 'auto' }, children: [tool.input_types.join(', '), " \u2192 ", tool.output_types.join(', ')] })] })] }) }));
}
function ToolRow({ tool }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }, children: [_jsxs("div", { style: { width: 200, flexShrink: 0 }, children: [_jsx(Typography.Text, { strong: true, children: tool.name }), _jsx(ProviderBadge, { pid: tool.providerId ?? 'default' }), _jsx("div", { children: _jsx(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: tool.id }) })] }), _jsx(Typography.Text, { type: "secondary", ellipsis: true, style: { flex: 1, fontSize: 13 }, children: tool.description || '（无描述）' }), _jsx("div", { style: { display: 'flex', gap: 4, flexShrink: 0 }, children: (tool.tags ?? []).map((t) => (_jsx(Tag, { style: { marginRight: 0 }, children: t }, t))) })] }));
}
