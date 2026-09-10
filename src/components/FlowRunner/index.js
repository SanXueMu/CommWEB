import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 流运行会话（唯一实现）：输入表单 → run 提交 → 控制条 + 步骤轨道 + 审计轨迹。
 *  页面（FlowDetail）与工作区（FlowSession）共用，禁止再自绘流运行 UI。 */
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { App as AntApp, Alert, Button, Card, Form, Input, Select, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { apiFor } from '@/api/client';
import { AuditTimeline } from '@/components/AuditTimeline';
import { FileUpload } from '@/components/FileUpload';
import { ResultRenderer } from '@/components/ResultRenderer';
import { RunControlBar } from '@/components/RunControlBar';
import { StepTrack } from '@/components/StepTrack';
import { PORTAL } from '@/config/portal';
import { extractFlowFields } from '@/protocol/flow';
import { useActivePid } from '@/transfer/context';
export function FlowRunner({ flow, runId, onRunIdChange, providerId }) {
    const pid = providerId ?? useActivePid();
    const toolIds = useMemo(() => [...new Set(flow.steps.map((s) => s.tool))], [flow.steps]);
    const toolQueries = useQueries({
        queries: toolIds.map((id) => ({ queryKey: ['provider', pid, 'tool', id], queryFn: () => apiFor(pid).getTool(id), staleTime: 60_000 })),
    });
    const schemaMap = useMemo(() => {
        const map = {};
        toolQueries.forEach((q) => {
            if (q.data)
                map[q.data.id] = q.data.manifest.io.input_schema;
        });
        return map;
    }, [toolQueries]);
    const fields = useMemo(() => extractFlowFields(flow.steps, schemaMap), [flow.steps, schemaMap]);
    const { data: snap } = useQuery({
        queryKey: ['provider', pid, 'runSnapshot', runId],
        queryFn: () => apiFor(pid).getRunSnapshot(runId),
        enabled: Boolean(runId),
        refetchInterval: (query) => {
            const status = query.state.data?.run.status;
            return status && ['running', 'paused'].includes(status) ? 2000 : false;
        },
    });
    if (!runId) {
        return _jsx(FlowRunForm, { flow: flow, fields: fields, providerId: pid, onRun: (id) => onRunIdChange(id) });
    }
    const status = snap?.run.status ?? 'running';
    return (_jsxs(Space, { direction: "vertical", size: 12, style: { width: '100%' }, children: [_jsx(RunControlBar, { runId: runId, status: status, onNewRound: () => onRunIdChange(null) }), status === 'paused' && (_jsx(Typography.Text, { type: "warning", style: { fontSize: 12 }, children: PORTAL.workspace.pausedHint })), snap?.run.status === 'failed' && snap.run.error != null ? (_jsx(Alert, { type: "error", showIcon: true, message: `${PORTAL.flowFailedPrefix}${String(snap.run.error?.message ?? '')}` })) : null, snap && _jsx(StepTrack, { runId: runId, steps: snap.steps, runStatus: status }), snap?.run.status === 'succeeded' && snap.steps.at(-1)?.latest?.output != null && (_jsx(Card, { size: "small", title: "\u6700\u7EC8\u8F93\u51FA", children: _jsx(ResultRenderer, { output: snap.steps.at(-1).latest.output }) })), _jsx(AuditTimeline, { runId: runId })] }));
}
function FlowRunForm({ flow, fields, providerId, onRun }) {
    const pid = providerId;
    const [form] = Form.useForm();
    const { message } = AntApp.useApp();
    const [runSubmitting, setRunSubmitting] = useState(false);
    const queryClient = useQueryClient();
    const submit = async (values) => {
        setRunSubmitting(true);
        try {
            const created = await apiFor(pid).runPipeline(flow.id, values);
            queryClient.invalidateQueries({ queryKey: ['provider', pid, 'provider', pid, 'runSnapshot', created.run_id] });
            onRun(created.run_id);
        }
        catch (err) {
            message.error(`提交失败：${err.message ?? err}`);
        }
        finally {
            setRunSubmitting(false);
        }
    };
    return (_jsx(Card, { size: "small", title: `运行 ${flow.name}（${flow.steps.length} 步）`, children: _jsxs(Form, { form: form, layout: "vertical", onFinish: submit, style: { maxWidth: 560 }, children: [fields.map((field) => (_jsx(Form.Item, { name: field.key, label: field.key, rules: field.widget === 'file' ? [] : [{ required: true, message: `请填写 ${field.key}` }], children: field.widget === 'file' ? (_jsx(FileUpload, {})) : field.widget === 'tags' ? (_jsx(Select, { mode: "tags", open: false, placeholder: PORTAL.form.tagsPlaceholder, style: { width: '100%' } })) : (_jsx(Input.TextArea, { rows: 2, placeholder: `{{ input.${field.key} }}` })) }, field.key))), fields.length === 0 && (_jsx(Typography.Text, { type: "secondary", children: "\u8BE5\u7BA1\u7EBF\u4E0D\u5F15\u7528\u4EFB\u4F55 input \u53C2\u6570\u3002" })), _jsx(Button, { type: "primary", htmlType: "submit", loading: runSubmitting, children: PORTAL.run.submit })] }) }));
}
