import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** PipelineStudio：'pipeline.studio' 通用视图——声明驱动的工作流集合页。
 *  纯壳准则：流 ID / save_as 组装规则全部来自声明 props；本组件零业务知识。
 *
 *  声明 props：
 *  {
 *    flow_ids?: string[]         // 显式清单，或
 *    flow_prefix?: string        // 按前缀拉取
 *    save_as?: SaveAsDecl        // 产物→管线 组装声明（lib/saveAsPipeline）
 *  }
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Modal, Space, Tag, Typography } from 'antd';
import { apiFor } from '@/api/client';
import { useViewProps } from '@/protocol/ViewPropsContext';
import { useActivePid } from '@/transfer/context';
import { FlowRunner } from '@/components/FlowRunner';
import { ResultRenderer } from '@/components/ResultRenderer';
import { buildPipelineFromSaveAs } from '@/lib/saveAsPipeline';
const TERMINAL = ['succeeded', 'failed', 'cancelled'];
export function PipelineStudio() {
    const viewProps = useViewProps();
    const props = viewProps;
    const pid = useActivePid();
    const api = apiFor(pid);
    const [selected, setSelected] = useState(null);
    const [runId, setRunId] = useState(null);
    const [saveAs, setSaveAs] = useState(null);
    const { data: flows = [] } = useQuery({
        queryKey: ['provider', pid, 'pipelines'],
        queryFn: () => api.listPipelines(),
        select: (d) => d.pipelines.filter((p) => (props.flow_ids ? props.flow_ids.includes(p.id) : props.flow_prefix ? p.id.startsWith(props.flow_prefix) : false)),
    });
    const { data: flow } = useQuery({
        queryKey: ['provider', pid, 'pipeline', selected],
        queryFn: () => api.getPipeline(selected),
        enabled: !!selected,
    });
    const { data: runDetail } = useQuery({
        queryKey: ['provider', pid, 'pipeline-run', runId],
        queryFn: () => api.getPipelineRun(runId),
        enabled: !!runId,
        refetchInterval: (q) => (TERMINAL.includes(q.state.data?.run.status ?? '') ? false : 2000),
    });
    useEffect(() => { setRunId(null); }, [selected]);
    const finishedRun = useMemo(() => (runDetail && TERMINAL.includes(runDetail.run.status) ? runDetail : null), [runDetail]);
    async function handleSaveAs() {
        if (!props.save_as || !finishedRun)
            return;
        const built = buildPipelineFromSaveAs(props.save_as, finishedRun.run.input ?? {}, lastOutput(finishedRun));
        if (!built) {
            setSaveAs({ error: '产物缺少必填内容或运行输入未填，无法组装管线' });
            return;
        }
        try {
            await api.createPipeline(built);
            setSaveAs({ done: built.id });
        }
        catch (e) {
            setSaveAs({ error: e instanceof Error ? e.message : String(e) });
        }
    }
    const output = finishedRun ? lastOutput(finishedRun) : null;
    return (_jsxs(Space, { direction: "vertical", size: 12, style: { width: '100%' }, children: [_jsx(Space, { size: 8, wrap: true, children: flows.map((f) => (_jsx(Tag.CheckableTag, { checked: f.id === selected, onChange: () => setSelected(f.id), children: f.name || f.id }, f.id))) }), flow ? (_jsx(Card, { size: "small", title: flow.name || flow.id, children: _jsx(FlowRunner, { flow: flow, runId: runId, onRunIdChange: setRunId, providerId: pid }) })) : (_jsx(Empty, { description: "\u58F0\u660E\u672A\u5339\u914D\u5230\u4EFB\u4F55\u6D41" })), finishedRun && finishedRun.run.status === 'succeeded' && output && (_jsxs(Card, { size: "small", title: "\u8FD0\u884C\u4EA7\u7269", children: [_jsx(ResultRenderer, { output: output }), props.save_as && (_jsx(Button, { style: { marginTop: 12 }, onClick: handleSaveAs, children: props.save_as.button_label ?? '另存为管线' }))] })), finishedRun && finishedRun.run.status === 'failed' && (_jsx(Alert, { type: "error", showIcon: true, message: finishedRun.run.error?.message ?? '运行失败' })), _jsx(Modal, { open: !!saveAs?.error, onCancel: () => setSaveAs(null), footer: null, title: "\u53E6\u5B58\u5931\u8D25", children: _jsx(Alert, { type: "error", showIcon: true, message: saveAs?.error }) }), _jsx(Modal, { open: !!saveAs?.done, onCancel: () => setSaveAs(null), footer: _jsx(Button, { type: "primary", onClick: () => setSaveAs(null), children: "\u597D\u7684" }), title: "\u5DF2\u4FDD\u5B58", children: _jsxs(Typography.Text, { children: ["\u7BA1\u7EBF\u5DF2\u6CE8\u518C\uFF1A", saveAs?.done] }) })] }));
}
function lastOutput(run) {
    const done = run.tasks.filter((t) => t.status === 'succeeded');
    return (done[done.length - 1]?.output ?? {});
}
