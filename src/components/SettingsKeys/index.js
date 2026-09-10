import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** SettingsKeys：'settings.keys' 协议级视图——CommAND keys 协议端点管理界面。
 *  纯壳准则：无业务默认值（provider/模型等由使用者自填）；显隐由站点声明驱动。 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import { apiFor } from '@/api/client';
import { useActivePid } from '@/transfer/context';
export function SettingsKeys({ props }) {
    const pid = useActivePid();
    const api = apiFor(pid);
    const [keys, setKeys] = useState([]);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const reload = useCallback(() => {
        api.listKeys().then((d) => setKeys(d.keys)).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []);
    useEffect(() => { reload(); }, [reload]);
    async function handleDelete(name) {
        try {
            await api.deleteKey(name);
            reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    async function handleSave() {
        const values = await form.validateFields();
        try {
            await api.putKey({
                name: values.name,
                provider: values.provider,
                base_url: values.base_url,
                api_key: values.api_key || undefined,
                is_default: !!values.is_default,
            });
            setEditing(null);
            reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }
    const columns = [
        { title: '名称', dataIndex: 'name' },
        { title: 'Provider', dataIndex: 'provider' },
        { title: 'Base URL', dataIndex: 'base_url', ellipsis: true },
        {
            title: '密钥', dataIndex: 'api_key',
            render: (v) => _jsx(Typography.Text, { code: true, children: v }),
        },
        {
            title: '默认', dataIndex: 'is_default',
            render: (v) => (v ? _jsx(Tag, { color: "green", children: "\u9ED8\u8BA4" }) : null),
        },
        {
            title: '操作',
            render: (_, record) => (_jsxs(Space, { size: 8, children: [_jsx(Button, { size: "small", onClick: () => { setEditing(record); form.setFieldsValue({ ...record, api_key: '' }); }, children: "\u7F16\u8F91" }), _jsx(Popconfirm, { title: `删除密钥 ${record.name}？`, onConfirm: () => handleDelete(record.name), children: _jsx(Button, { size: "small", danger: true, children: "\u5220\u9664" }) })] })),
        },
    ];
    return (_jsxs(Card, { size: "small", title: props?.title ?? '密钥管理', extra: _jsx(Button, { type: "primary", size: "small", onClick: () => { setEditing({}); form.resetFields(); }, children: "\u65B0\u589E\u5BC6\u94A5" }), children: [error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 12 } }), _jsx(Table, { rowKey: "name", size: "small", columns: columns, dataSource: keys, pagination: false }), _jsx(Modal, { open: editing !== null, title: editing?.name ? `编辑密钥：${editing.name}` : '新增密钥', onCancel: () => setEditing(null), onOk: handleSave, okText: "\u4FDD\u5B58", cancelText: "\u53D6\u6D88", children: _jsxs(Form, { form: form, layout: "vertical", children: [_jsx(Form.Item, { name: "name", label: "\u540D\u79F0", rules: [{ required: true, message: '必填' }], children: _jsx(Input, { disabled: !!editing?.name, placeholder: "\u552F\u4E00\u540D\u79F0\uFF0C\u5982 my-provider" }) }), _jsx(Form.Item, { name: "provider", label: "Provider", rules: [{ required: true, message: '必填' }], children: _jsx(Input, { placeholder: "\u4F9B\u5E94\u5546\u6807\u8BC6" }) }), _jsx(Form.Item, { name: "base_url", label: "Base URL", rules: [{ required: true, message: '必填' }], children: _jsx(Input, { placeholder: "https://.../v1" }) }), _jsx(Form.Item, { name: "api_key", label: "API Key", extra: editing?.name ? '留空表示不修改' : undefined, children: _jsx(Input.Password, { placeholder: editing?.name ? '留空不改' : '密钥' }) }), _jsx(Form.Item, { name: "is_default", label: "\u8BBE\u4E3A\u9ED8\u8BA4", valuePropName: "checked", children: _jsx(Switch, {}) })] }) })] }));
}
