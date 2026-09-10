import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { Card, Descriptions, Space, Spin, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFor } from '@/api/client';
import { TaskDrawer } from '@/components/TaskDrawer';
import { ToolForm } from '@/components/ToolForm';
import { DocPanel } from '@/components/DocPanel';
import { OpenInWorkspace } from '@/components/OpenInWorkspace';
import { StatusBadge } from '@/components/StatusBadge';
import { PORTAL } from '@/config/portal';
/** 工作台：manifest 信息 + 自动表单 + 该工具近期任务。 */
export function ToolDetail() {
    const { id = '' } = useParams();
    const [searchParams] = useSearchParams();
    const pid = searchParams.get('provider') ?? 'default';
    const api = apiFor(pid);
    const [drawerHandle, setDrawerHandle] = useState(null);
    const { data: tool, isLoading, error } = useQuery({
        queryKey: ['provider', pid, 'tool', id],
        queryFn: () => api.getTool(id),
    });
    const { data: recent } = useQuery({
        queryKey: ['provider', pid, 'tasks', ''],
        queryFn: () => api.listTasks(),
        refetchInterval: 5000,
    });
    if (isLoading)
        return _jsx(Spin, { style: { display: 'block', margin: '80px auto' } });
    if (error || !tool)
        return _jsxs(Typography.Text, { type: "danger", children: ["\u5DE5\u5177\u52A0\u8F7D\u5931\u8D25\uFF1A", error?.message ?? id] });
    const tasks = (recent?.tasks ?? []).filter((t) => t.tool_id === tool.id).slice(0, 5);
    return (_jsxs(Space, { direction: "vertical", size: 16, style: { width: '100%' }, children: [_jsx(Card, { size: "small", children: _jsxs(Space, { direction: "vertical", size: 4, children: [_jsxs(Space, { size: 8, children: [_jsx(Typography.Title, { level: 4, style: { margin: 0 }, children: tool.name }), _jsx(OpenInWorkspace, { kind: "tool", refId: tool.id, title: tool.name, providerId: pid }), _jsx(Tag, { color: "blue", children: tool.id }), _jsxs(Tag, { children: ["v", tool.version] }), _jsx(Tag, { children: tool.runtime_kind })] }), _jsx(Typography.Text, { type: "secondary", children: tool.description }), _jsxs(Descriptions, { size: "small", column: 3, children: [_jsxs(Descriptions.Item, { label: "\u8D85\u65F6", children: [tool.manifest.resources.timeout_s, "s"] }), _jsx(Descriptions.Item, { label: "\u5E76\u53D1", children: tool.manifest.resources.concurrency }), _jsx(Descriptions.Item, { label: "\u91CD\u8BD5\u4E0A\u9650", children: tool.manifest.resources.max_attempts })] })] }) }), _jsx(Card, { size: "small", title: PORTAL.run.formTitle, children: _jsx(ToolForm, { tool: tool, onSubmitted: setDrawerHandle }) }), _jsx(Card, { size: "small", title: "\u8FD1\u671F\u4EFB\u52A1", children: _jsx(Table, { size: "small", rowKey: "handle", pagination: false, onRow: (record) => ({ onClick: () => setDrawerHandle(record.handle), style: { cursor: 'pointer' } }), columns: [
                        { title: 'handle', dataIndex: 'handle', render: (v) => _jsxs("code", { children: [v.slice(0, 14), "\u2026"] }) },
                        { title: '状态', dataIndex: 'status', render: (v) => _jsx(StatusBadge, { value: v }) },
                        { title: '创建', dataIndex: 'created_at', render: (v) => v?.slice(0, 19) },
                    ], dataSource: tasks }) }), _jsx(DocPanel, { docMd: tool.manifest.doc_md }), _jsx(TaskDrawer, { handle: drawerHandle, onClose: () => setDrawerHandle(null) })] }));
}
