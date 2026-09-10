import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { App as AntApp, Button, Descriptions, Drawer, Popconfirm, Space } from 'antd';
import { api } from '@/api/client';
import { EventStream } from '@/components/EventStream';
import { ResultRenderer } from '@/components/ResultRenderer';
import { StatusBadge } from '@/components/StatusBadge';
import { useActivePid } from '@/transfer/context';
/** 任务详情抽屉：状态徽章 + SSE 事件流 + 输出渲染 + 取消。 */
export function TaskDrawer({ handle, onClose }) {
    const pid = useActivePid();
    const { message } = AntApp.useApp();
    const { data: task, refetch } = useQuery({
        queryKey: ['provider', pid, 'task', handle],
        queryFn: () => api.getTask(handle),
        enabled: handle !== null,
        refetchInterval: (query) => query.state.data && ['queued', 'running'].includes(query.state.data.status) ? 1000 : false,
    });
    if (!task)
        return null;
    const cancellable = ['queued', 'running'].includes(task.status);
    return (_jsx(Drawer, { open: handle !== null, onClose: onClose, width: 720, title: `任务 ${task.handle.slice(0, 18)}…`, extra: cancellable && (_jsx(Popconfirm, { title: "\u786E\u8BA4\u53D6\u6D88\u8BE5\u4EFB\u52A1\uFF1F", onConfirm: async () => {
                try {
                    const result = await api.cancelTask(task.handle);
                    message.success(`已请求取消：${result.status}`);
                    refetch();
                }
                catch (error) {
                    message.error(`取消失败：${error.message}`);
                }
            }, children: _jsx(Button, { danger: true, size: "small", children: "\u53D6\u6D88\u4EFB\u52A1" }) })), children: _jsxs(Space, { direction: "vertical", size: 16, style: { width: '100%' }, children: [_jsxs(Descriptions, { size: "small", column: 2, bordered: true, children: [_jsx(Descriptions.Item, { label: "\u5DE5\u5177", children: task.tool_id }), _jsx(Descriptions.Item, { label: "\u72B6\u6001", children: _jsx(StatusBadge, { value: task.status }) }), _jsxs(Descriptions.Item, { label: "\u5C1D\u8BD5", children: [task.attempt, "/", task.max_attempts] }), _jsx(Descriptions.Item, { label: "\u521B\u5EFA", children: task.created_at?.slice(0, 19) })] }), _jsx(EventStream, { handle: task.handle, onDone: () => refetch() }), task.error && (_jsx(Descriptions, { size: "small", column: 1, bordered: true, title: "\u9519\u8BEF", children: _jsx(Descriptions.Item, { label: task.error.kind, children: task.error.message }) })), task.output != null && _jsx(ResultRenderer, { output: task.output })] }) }));
}
