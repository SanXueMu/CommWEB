import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */
import { Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProviderBadge } from '@/components/ProviderBadge';
import { DataListPanel } from '@/components/DataListPanel';
import { OpenInWorkspace } from '@/components/OpenInWorkspace';
import { PanelCard } from '@/components/ui/PanelCard';
import { PORTAL } from '@/config/portal';
import { useActivePid } from '@/transfer/context';
import { apiFor } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
export function Flows() {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState('');
    const pid = useActivePid();
    const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() });
    const pipelines = data?.pipelines ?? [];
    const providerName = {};
    const flows = useMemo(() => {
        if (!keyword)
            return pipelines;
        return pipelines.filter((f) => f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => s.tool.includes(keyword)));
    }, [pipelines, keyword]);
    return (_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx(DataListPanel, { panelKey: "flows", items: flows, loading: isLoading, rowKey: (f) => `${f.providerId ?? 'default'}:${f.id}`, onSearch: setKeyword, searchPlaceholder: PORTAL.search.flows, onItemClick: (f) => navigate(`/flows/${encodeURIComponent(f.id)}?provider=${f.providerId ?? 'default'}`), emptyText: PORTAL.empty.flows, renderCard: (flow) => _jsx(FlowCard, { flow: flow, providerName: providerName }), renderRow: (flow) => _jsx(FlowRow, { flow: flow, providerName: providerName }) }), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: ["\u5171 ", flows.length, " \u6761\u6D41 \u00B7 ", PORTAL.footNote.flows] })] }));
}
function StepChain({ flow }) {
    return (_jsx(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: flow.steps.map((s) => s.tool).join(' → ') }));
}
function FlowCard({ flow, providerName }) {
    return (_jsx(Link, { to: `/flows/${flow.id}`, children: _jsxs(PanelCard, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx(Typography.Text, { strong: true, children: flow.name }), _jsx(ProviderBadge, { pid: flow.providerId ?? 'default', name: providerName[flow.providerId ?? 'default'] }), _jsxs(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: [flow.steps.length, " \u6B65"] })] }), _jsx("div", { style: { margin: '10px 0 6px' }, children: _jsx(StepChain, { flow: flow }) })] }) }));
}
function FlowRow({ flow, providerName }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px' }, children: [_jsxs("div", { style: { width: 260, flexShrink: 0 }, children: [_jsxs(Space, { size: 6, children: [_jsx(Typography.Text, { strong: true, children: flow.name }), _jsx(ProviderBadge, { pid: flow.providerId ?? 'default', name: providerName[flow.providerId ?? 'default'] })] }), _jsx("div", { children: _jsx(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: flow.id }) })] }), _jsx("div", { style: { flex: 1, minWidth: 0 }, children: _jsx(StepChain, { flow: flow }) }), _jsx(OpenInWorkspace, { kind: "flow", refId: flow.id, title: flow.name })] }));
}
