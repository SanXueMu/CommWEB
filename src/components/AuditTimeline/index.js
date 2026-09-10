import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 审计时间线：run_events 全程留痕（工单的审批记录）。 */
import { useQuery } from '@tanstack/react-query';
import { Card, Spin, Timeline, Typography } from 'antd';
import { api } from '@/api/client';
import { RUN_EVENT_LABELS } from '@/config/portal';
import { useActivePid } from '@/transfer/context';
function detailSummary(detail) {
    const parts = [];
    for (const [key, value] of Object.entries(detail ?? {})) {
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        parts.push(`${key}=${text.length > 60 ? `${text.slice(0, 60)}…` : text}`);
    }
    return parts.join(' ');
}
export function AuditTimeline({ runId }) {
    const pid = useActivePid();
    const { data, isLoading } = useQuery({
        queryKey: ['provider', pid, 'runEvents', runId],
        queryFn: () => api.listRunEvents(runId, 100),
    });
    return (_jsx(Card, { size: "small", title: "\u5BA1\u8BA1\u8F68\u8FF9", style: { marginTop: 16 }, children: isLoading ? (_jsx(Spin, { size: "small" })) : (_jsx(Timeline, { items: (data?.events ?? [])
                .slice()
                .reverse()
                .map((e) => ({
                children: (_jsxs("div", { style: { fontSize: 12 }, children: [_jsx(Typography.Text, { strong: true, children: RUN_EVENT_LABELS[e.kind] ?? e.kind }), _jsxs(Typography.Text, { type: "secondary", children: [" \u00B7 ", e.actor, " \u00B7 ", e.created_at?.slice(11, 19)] }), e.task_handle && (_jsxs(Typography.Text, { code: true, style: { marginLeft: 8, fontSize: 11 }, children: [e.task_handle.slice(0, 12), "\u2026"] })), Object.keys(e.detail ?? {}).length > 0 && (_jsx("div", { children: _jsx(Typography.Text, { type: "secondary", style: { fontSize: 11 }, children: detailSummary(e.detail) }) }))] })),
            })) })) }));
}
