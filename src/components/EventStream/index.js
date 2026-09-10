import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Card, Progress, Space, Tag, Typography } from 'antd';
import { streamTaskEvents } from '@/api/client';
/** SSE 事件流：终端日志 + 顶部进度条 + 产物卡片，三合一。 */
export function EventStream({ handle, onDone, }) {
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(null);
    const [artifacts, setArtifacts] = useState([]);
    const terminalRef = useRef(null);
    useEffect(() => {
        setLogs([]);
        setProgress(null);
        setArtifacts([]);
        return streamTaskEvents(handle, {
            onEvent: (event) => {
                if (event.type === 'log')
                    setLogs((prev) => [...prev, event]);
                if (event.type === 'progress') {
                    const data = event.data;
                    setProgress({ done: Number(data.done), total: Number(data.total) });
                }
                if (event.type === 'artifact')
                    setArtifacts((prev) => [...prev, event.data]);
            },
            onDone: (payload) => {
                setLogs((prev) => [
                    ...prev,
                    { id: -1, type: 'log', data: { message: `── 任务终态：${payload.status} ──` }, created_at: '' },
                ]);
                onDone?.(payload);
            },
        });
        // onDone 身份变化不需重订阅
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handle]);
    useEffect(() => {
        terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight });
    }, [logs]);
    return (_jsxs(Space, { direction: "vertical", size: 8, style: { width: '100%' }, children: [progress && (_jsx(Progress, { percent: Math.round((progress.done / Math.max(progress.total, 1)) * 100), size: "small", format: () => `${progress.done}/${progress.total}` })), artifacts.length > 0 && (_jsx(Space, { wrap: true, children: artifacts.map((a, i) => (_jsxs(Card, { size: "small", style: { background: 'rgba(59,176,147,0.08)' }, children: [_jsx(Typography.Text, { copyable: { text: a.path }, children: a.name ?? `产物 ${i + 1}` }), a.path && (_jsx(Typography.Paragraph, { type: "secondary", style: { marginBottom: 0, fontSize: 12 }, children: a.path }))] }, i))) })), _jsx("pre", { ref: terminalRef, style: {
                    background: 'rgba(0,0,0,0.85)',
                    color: '#d9d9d9',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 240,
                    overflow: 'auto',
                    fontSize: 12,
                    margin: 0,
                }, children: logs.length === 0 ? '（等待事件…）' : logs.map((l) => JSON.stringify(l.data)).join('\n') }), _jsxs(Space, { size: 4, children: [_jsxs(Tag, { children: ["handle: ", handle.slice(0, 14), "\u2026"] }), _jsx(Tag, { color: "blue", children: "SSE" })] })] }));
}
