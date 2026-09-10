import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { Typography } from 'antd';
import { useState } from 'react';
import { api } from '@/api/client';
import { DataListPanel } from '@/components/DataListPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { TaskDrawer } from '@/components/TaskDrawer';
import { PanelCard } from '@/components/ui/PanelCard';
import { PORTAL, STATUS_GROUP_LABELS } from '@/config/portal';
import { useStatusCatalog } from '@/config/useStatusCatalog';
import { useActivePid } from '@/transfer/context';
/** 柜台（与工具库同构）：左侧状态分组筛选（目录驱动）+ 右侧通用列表面板。 */
export function Tasks() {
    const pid = useActivePid();
    const [group, setGroup] = useState('');
    const [selected, setSelected] = useState(null);
    const [keyword, setKeyword] = useState('');
    const { byGroup } = useStatusCatalog();
    const { data, isLoading } = useQuery({
        queryKey: ['provider', pid, 'tasks'],
        queryFn: () => api.listTasks(),
        refetchInterval: 3000,
    });
    const tasks = (data?.tasks ?? []).filter((t) => {
        const hitStatus = !group || (byGroup[group] ?? []).some((s) => s.value === t.status);
        const hitKeyword = !keyword ||
            t.tool_id.includes(keyword) ||
            t.handle.includes(keyword) ||
            t.status.includes(keyword);
        return hitStatus && hitKeyword;
    });
    const count = (key) => (data?.tasks ?? []).filter((t) => (byGroup[key] ?? []).some((s) => s.value === t.status)).length;
    return (_jsxs("div", { style: { display: 'flex', gap: 24, alignItems: 'flex-start' }, children: [_jsxs("aside", { style: {
                    width: 128,
                    flexShrink: 0,
                    position: 'sticky',
                    top: 76,
                    borderRight: '1px solid #f0f0f0',
                    paddingRight: 16,
                }, children: [_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: PORTAL.sidebar.status }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }, children: [_jsxs(Typography.Link, { strong: group === '', onClick: () => setGroup(''), style: { color: group === '' ? '#202753' : '#8c8c8c' }, children: ["\u5168\u90E8\uFF08", (data?.tasks ?? []).length, "\uFF09"] }), Object.entries(byGroup).map(([key]) => (_jsxs(Typography.Link, { strong: group === key, onClick: () => setGroup(key), style: { color: group === key ? '#202753' : '#8c8c8c' }, children: [STATUS_GROUP_LABELS[key] ?? key, "\uFF08", count(key), "\uFF09"] }, key)))] })] }), _jsx("main", { style: { flex: 1, minWidth: 0 }, children: _jsx(DataListPanel, { providerId: pid, panelKey: "tasks", items: tasks, loading: isLoading, rowKey: (t) => t.handle, onSearch: setKeyword, searchPlaceholder: PORTAL.search.tasks, defaultView: "list", onItemClick: (t) => setSelected(t.handle), emptyText: PORTAL.empty.tasks, renderCard: (t) => _jsx(TaskCard, { task: t }), renderRow: (t) => _jsx(TaskRow, { task: t }) }) }), _jsx(TaskDrawer, { handle: selected, onClose: () => setSelected(null) })] }));
}
function TaskCard({ task: t }) {
    return (_jsxs(PanelCard, { children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx(Typography.Text, { strong: true, children: t.tool_id }), _jsx(StatusBadge, { value: t.status })] }), _jsxs(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: [t.handle.slice(0, 18), "\u2026"] }), _jsx("div", { style: { marginTop: 8 }, children: _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: [t.created_at?.slice(0, 19), " \u00B7 \u5C1D\u8BD5 ", t.attempt, "/", t.max_attempts] }) })] }));
}
function TaskRow({ task: t }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px' }, children: [_jsxs("div", { style: { width: 220, flexShrink: 0 }, children: [_jsx(Typography.Text, { strong: true, children: t.tool_id }), _jsx("div", { children: _jsxs(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: [t.handle.slice(0, 14), "\u2026"] }) })] }), _jsx(Typography.Text, { type: "secondary", style: { flex: 1, fontSize: 12 }, children: t.created_at?.slice(0, 19) }), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12, flexShrink: 0 }, children: [t.attempt, "/", t.max_attempts] }), _jsx(StatusBadge, { value: t.status })] }));
}
