import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 工作区：浏览器式多标签工作台——工具/流会话多开互不干扰，流的全控制操作面板。 */
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Dropdown, Empty, Space, Spin, Tabs, Typography } from 'antd';
import { useMemo } from 'react';
import { apiFor } from '@/api/client';
import { EventStream } from '@/components/EventStream';
import { ResultRenderer } from '@/components/ResultRenderer';
import { StatusBadge } from '@/components/StatusBadge';
import { FlowRunner } from '@/components/FlowRunner';
import { ToolForm } from '@/components/ToolForm';
import { PORTAL } from '@/config/portal';
import { useWorkspace } from '@/workspace/store';
import { useActivePid } from '@/transfer/context';
export function Workspace() {
    const { tabs, activeKey, closeTab, updateTab, openTab, setActive } = useWorkspace();
    const items = useMemo(() => tabs.map((tab) => ({
        key: tab.key,
        label: (_jsxs("span", { children: [tab.kind === 'flow' ? '⛓ ' : '🔧 ', tab.title, tab.providerId && tab.providerId !== 'default' && (_jsx(Typography.Text, { code: true, style: { fontSize: 10, marginLeft: 6 }, children: tab.providerId }))] })),
        closable: true,
        children: tab.kind === 'tool' ? (_jsx(ToolSession, { tab: tab, update: (patch) => updateTab(tab.key, patch) })) : (_jsx(FlowSession, { tab: tab, update: (patch) => updateTab(tab.key, patch) })),
    })), [tabs, updateTab]);
    return (_jsxs(Card, { size: "small", children: [_jsx(Tabs, { type: "card", activeKey: activeKey, items: items.length ? items : undefined, onChange: setActive, onEdit: (key, action) => {
                    if (action === 'remove' && typeof key === 'string')
                        closeTab(key);
                }, tabBarExtraContent: _jsx(OpenButton, { onOpen: openTab }), destroyOnHidden: true }), items.length === 0 && (_jsx(Empty, { description: PORTAL.empty.workspace, style: { padding: '48px 0' } }))] }));
}
function OpenButton({ onOpen }) {
    const pid = useActivePid();
    const { data: toolsData } = useQuery({ queryKey: ['provider', pid, 'tools'], queryFn: () => apiFor(pid).listTools() });
    const { data: flowsData } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() });
    const tools = toolsData?.tools ?? [];
    const flows = flowsData?.pipelines ?? [];
    return (_jsx(Dropdown, { menu: {
            items: [
                {
                    key: 'tools',
                    label: '打开工具',
                    children: tools.map((t) => ({
                        key: t.id,
                        label: `${t.name}（${t.id}）`,
                        onClick: () => onOpen({ kind: 'tool', refId: t.id, title: t.name, providerId: pid }),
                    })),
                },
                {
                    key: 'flows',
                    label: '打开流',
                    children: flows.map((p) => ({
                        key: p.id,
                        label: `${p.name}（${p.id}）`,
                        onClick: () => onOpen({ kind: 'flow', refId: p.id, title: p.name, providerId: pid }),
                    })),
                },
            ],
        }, children: _jsx(Button, { size: "small", children: "\uFF0B \u6253\u5F00" }) }));
}
/** 工具会话：表单提交 → tab 内联事件流 + 结果渲染。 */
function ToolSession({ tab, update }) {
    const pid = tab.providerId ?? useActivePid();
    const api = apiFor(pid);
    const { data: tool, isLoading } = useQuery({
        queryKey: ['provider', pid, 'tool', tab.refId],
        queryFn: () => api.getTool(tab.refId),
    });
    const { data: task } = useQuery({
        queryKey: ['provider', pid, 'task', tab.handle],
        queryFn: () => api.getTask(tab.handle),
        enabled: Boolean(tab.handle),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status && ['queued', 'running'].includes(status) ? 1500 : false;
        },
    });
    if (isLoading)
        return _jsx(Spin, {});
    if (!tool)
        return _jsx(Typography.Text, { type: "secondary", children: "\u5DE5\u5177\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0B\u67B6" });
    return (_jsx("div", { style: { maxWidth: 860 }, children: tab.handle ? (_jsxs(Space, { direction: "vertical", size: 12, style: { width: '100%' }, children: [_jsxs(Space, { children: [_jsx(StatusBadge, { value: task?.status ?? 'queued' }), _jsx(Typography.Text, { code: true, style: { fontSize: 12 }, children: tab.handle }), _jsx(Button, { size: "small", onClick: () => update({ handle: undefined }), children: "\u518D\u6B21\u63D0\u4EA4" }), task && ['queued', 'running'].includes(task.status) && (_jsx(Button, { size: "small", danger: true, onClick: async () => {
                                try {
                                    await api.cancelTask(tab.handle);
                                }
                                catch (err) {
                                    console.error('取消失败', err);
                                }
                            }, children: PORTAL.workspace.abort }))] }), task && _jsx(EventStream, { handle: tab.handle }), task?.status === 'succeeded' && task.output != null && (_jsx(Card, { size: "small", title: "\u7ED3\u679C", children: _jsx(ResultRenderer, { output: task.output, highlight: tool.manifest.ui?.render?.highlight }) }))] })) : (_jsx(ToolForm, { tool: tool, onSubmitted: (handle) => update({ handle }) })) }));
}
/** 流会话：FlowRunner 唯一实现，本组件只绑定工作区标签页状态。 */
function FlowSession({ tab, update }) {
    const pid = tab.providerId ?? useActivePid();
    const { data: flow, isLoading } = useQuery({
        queryKey: ['provider', pid, 'pipeline', tab.refId],
        queryFn: () => apiFor(pid).getPipeline(tab.refId),
    });
    if (isLoading)
        return _jsx(Spin, {});
    if (!flow)
        return _jsx(Typography.Text, { type: "secondary", children: "\u6D41\u4E0D\u5B58\u5728\u6216\u5DF2\u4E0B\u67B6" });
    return _jsx(FlowRunner, { flow: flow, runId: tab.runId ?? null, onRunIdChange: (id) => update({ runId: id ?? undefined }) });
}
