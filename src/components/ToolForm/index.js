import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { App as AntApp, Button, DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd';
import { api } from '@/api/client';
import { cachedResolveForm } from '@/protocol/resolver';
import { PORTAL } from '@/config/portal';
/** 自动表单：resolver 产物 → AntD 控件。工具零前端代码即得可用表单。 */
export function ToolForm({ tool, onSubmitted }) {
    const [form] = Form.useForm();
    const { message } = AntApp.useApp();
    const [submitting, setSubmitting] = useState(false);
    const fields = useMemo(() => cachedResolveForm(tool.manifest.io.input_schema, tool.manifest.ui, tool.manifest.io.input_types), [tool]);
    const renderControl = (widget, field) => {
        switch (widget) {
            case 'textarea':
                return _jsx(Input.TextArea, { rows: 4, placeholder: field.placeholder });
            case 'select':
                return _jsx(Select, { options: field.options, placeholder: field.placeholder });
            case 'multiSelect':
                return _jsx(Select, { mode: "multiple", options: field.options });
            case 'tags':
                return _jsx(Select, { mode: "tags", placeholder: field.placeholder ?? PORTAL.form.tagsPlaceholder, open: false });
            case 'number':
                return _jsx(InputNumber, { style: { width: '100%' } });
            case 'switch':
                return _jsx(Switch, {});
            case 'date':
                return _jsx(DatePicker, { style: { width: '100%' } });
            default:
                return _jsx(Input, { placeholder: field.placeholder });
        }
    };
    const valuePropName = (widget) => (widget === 'switch' ? 'checked' : 'value');
    return (_jsxs(Form, { form: form, layout: "vertical", onFinish: async (values) => {
            const input = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined && v !== ''));
            setSubmitting(true);
            try {
                const created = await api.createTask(tool.id, input);
                message.success(`已入队：${created.handle}`);
                onSubmitted(created.handle);
                form.resetFields();
            }
            catch (error) {
                message.error(`提交失败：${error.message}`);
            }
            finally {
                setSubmitting(false);
            }
        }, children: [fields.map((field) => (_jsx(Form.Item, { name: field.name.split('.'), label: field.label, help: field.help, rules: field.required ? [{ required: true, message: `${field.label} 必填` }] : undefined, valuePropName: valuePropName(field.widget), children: renderControl(field.widget, field) }, field.name))), _jsx(Button, { type: "primary", htmlType: "submit", loading: submitting, children: tool.manifest.ui?.submit_label ?? PORTAL.run.submit })] }));
}
