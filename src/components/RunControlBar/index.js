import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** 运行控制条：暂停/恢复/中止，按钮显隐由 run.status 驱动（目录驱动渲染）。 */
import { useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Button, Popconfirm, Space } from 'antd';
import { api } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { PORTAL } from '@/config/portal';
import { useActivePid } from '@/transfer/context';
export function RunControlBar({ runId, status, onNewRound }) {
    const pid = useActivePid();
    const { message } = AntApp.useApp();
    const queryClient = useQueryClient();
    const act = async (fn) => {
        try {
            await fn();
            queryClient.invalidateQueries({ queryKey: ['provider', pid, 'provider', pid, 'runSnapshot', runId] });
            queryClient.invalidateQueries({ queryKey: ['provider', pid, 'provider', pid, 'runEvents', runId] });
        }
        catch (err) {
            message.error(String(err.message ?? err));
        }
    };
    const terminal = ['succeeded', 'failed', 'failed_review', 'cancelled', 'interrupted'];
    const buttons = status === 'running' ? (_jsxs(_Fragment, { children: [_jsx(Button, { size: "small", onClick: () => act(() => api.pauseRun(runId)), children: PORTAL.workspace.pause }), _jsx(Popconfirm, { title: "\u4E2D\u6B62\u540E\u6210\u679C\u4FDD\u7559\u53EF\u67E5\uFF0C\u786E\u5B9A\uFF1F", onConfirm: () => act(() => api.abortRun(runId)), children: _jsx(Button, { size: "small", danger: true, children: PORTAL.workspace.abort }) })] })) : status === 'paused' ? (_jsxs(_Fragment, { children: [_jsx(Button, { size: "small", type: "primary", onClick: () => act(() => api.resumeRun(runId)), children: PORTAL.workspace.resume }), _jsx(Popconfirm, { title: "\u4E2D\u6B62\u540E\u6210\u679C\u4FDD\u7559\u53EF\u67E5\uFF0C\u786E\u5B9A\uFF1F", onConfirm: () => act(() => api.abortRun(runId)), children: _jsx(Button, { size: "small", danger: true, children: PORTAL.workspace.abort }) })] })) : terminal.includes(status) && onNewRound ? (_jsx(Button, { size: "small", onClick: onNewRound, children: PORTAL.workspace.newRound })) : null;
    return (_jsxs(Space, { size: 12, children: [_jsx(StatusBadge, { value: status }), buttons] }));
}
