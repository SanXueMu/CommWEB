import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/** 步骤轨道：每步最新任务状态 + 断点重跑（留档 input 为底的字段级覆盖）。 */
import { useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Modal, Steps, Typography, message } from 'antd';
import { useState } from 'react';
import { api } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { PORTAL } from '@/config/portal';
import { useActivePid } from '@/transfer/context';
function stepStatus(latest) {
    if (!latest)
        return 'wait';
    if (latest.status === 'succeeded')
        return 'finish';
    if (latest.status === 'queued' || latest.status === 'running' || latest.status === 'paused')
        return 'process';
    return 'error';
}
export function StepTrack({ runId, steps, runStatus }) {
    const [rerunStep, setRerunStep] = useState(null);
    const rerunnable = runStatus !== 'running';
    return (_jsxs("div", { children: [_jsx(Steps, { size: "small", items: steps.map((s) => ({
                    title: (_jsxs("span", { style: { fontSize: 13 }, children: [s.step_index, ". ", s.tool] })),
                    status: stepStatus(s.latest),
                    description: s.latest ? (_jsxs("span", { style: { fontSize: 12 }, children: [_jsx(StatusBadge, { value: s.latest.status }), " \u00B7 \u8BD5 ", s.latest.attempt] })) : (_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12 }, children: "\u672A\u5F00\u59CB" })),
                })) }), _jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }, children: steps.map((s) => (_jsxs(Button, { size: "small", disabled: !rerunnable || (s.latest?.status ?? '') === 'queued' || (s.latest?.status ?? '') === 'running', onClick: () => setRerunStep(s), children: [PORTAL.workspace.rerun, " ", s.step_index] }, s.step_index))) }), rerunStep && _jsx(RerunModal, { runId: runId, step: rerunStep, onClose: () => setRerunStep(null) })] }));
}
function RerunModal({ runId, step, onClose }) {
    const pid = useActivePid();
    const queryClient = useQueryClient();
    const [form] = Form.useForm();
    const submit = async (values) => {
        let override;
        if (values.override?.trim()) {
            try {
                override = JSON.parse(values.override);
            }
            catch {
                message.error('覆盖 JSON 解析失败');
                return;
            }
        }
        try {
            await api.rerunStep(runId, step.step_index, override);
            queryClient.invalidateQueries({ queryKey: ['provider', pid, 'provider', pid, 'runSnapshot', runId] });
            queryClient.invalidateQueries({ queryKey: ['provider', pid, 'provider', pid, 'runEvents', runId] });
            onClose();
        }
        catch (err) {
            message.error(String(err.message ?? err));
        }
    };
    return (_jsxs(Modal, { open: true, title: `${PORTAL.workspace.rerunTitle} · 第 ${step.step_index} 步`, onCancel: onClose, onOk: () => form.submit(), destroyOnClose: true, children: [_jsx(Typography.Paragraph, { type: "secondary", style: { fontSize: 12 }, children: "\u7559\u6863\u8F93\u5165\uFF08\u539F\u6837\u4E3A\u5E95\uFF09\uFF1A" }), _jsx("pre", { style: { background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, fontSize: 12, maxHeight: 180, overflow: 'auto' }, children: JSON.stringify(step.latest?.input ?? {}, null, 2) }), _jsx(Form, { form: form, layout: "vertical", onFinish: submit, children: _jsx(Form.Item, { name: "override", label: "\u5B57\u6BB5\u8986\u76D6", children: _jsx(Input.TextArea, { rows: 3, placeholder: PORTAL.workspace.overridePlaceholder, style: { fontFamily: 'ui-monospace, Menlo, monospace' } }) }) })] }));
}
