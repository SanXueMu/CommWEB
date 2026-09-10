import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 流详情页：头部元信息 + 文档 + 运行会话（FlowRunner 唯一实现，本页只做装配）。 */
import { useQuery } from '@tanstack/react-query';
import { Card, Space, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFor } from '@/api/client';
import { DocPanel } from '@/components/DocPanel';
import { FlowRunner } from '@/components/FlowRunner';
import { OpenInWorkspace } from '@/components/OpenInWorkspace';
export function FlowDetail() {
    const { id = '' } = useParams();
    const [searchParams] = useSearchParams();
    const pid = searchParams.get('provider') ?? 'default';
    const [runId, setRunId] = useState(null);
    const { data: flow, isLoading, error } = useQuery({
        queryKey: ['provider', pid, 'pipeline', id],
        queryFn: () => apiFor(pid).getPipeline(id),
    });
    if (isLoading)
        return _jsx(Spin, { style: { display: 'block', margin: '80px auto' } });
    if (error || !flow)
        return _jsxs(Typography.Text, { type: "danger", children: ["\u6D41\u52A0\u8F7D\u5931\u8D25\uFF1A", error?.message ?? id] });
    return (_jsxs(Space, { direction: "vertical", size: 16, style: { width: '100%' }, children: [_jsxs(Card, { size: "small", children: [_jsxs(Space, { size: 8, children: [_jsx(OpenInWorkspace, { kind: "flow", refId: flow.id, title: flow.name, providerId: pid }), _jsx(Typography.Title, { level: 4, style: { margin: 0 }, children: flow.name }), _jsx(Tag, { color: "purple", children: flow.id }), _jsxs(Tag, { children: [flow.steps.length, " \u6B65"] })] }), _jsx("div", { style: { marginTop: 8 }, children: _jsx(Typography.Text, { code: true, type: "secondary", style: { fontSize: 12 }, children: flow.steps.map((s) => s.tool).join(' → ') }) })] }), _jsx(DocPanel, { docMd: flow.doc_md }), _jsx(FlowRunner, { flow: flow, runId: runId, onRunIdChange: setRunId, providerId: pid })] }));
}
