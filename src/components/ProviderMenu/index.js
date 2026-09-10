import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** 会话菜单（蓝图05 M1）：本页会话信息 + 回首页重选；管理抽屉含登记/编辑/删除/探测。 */
import { App as AntApp, Badge, Button, Drawer, Dropdown, Form, Input, Modal, Space, Typography } from 'antd';
import { ApiOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProviders } from '@/transfer/context';
import { DEFAULT_PROVIDER } from '@/transfer/protocol';
const STATUS_COLOR = {
    online: '#52c41a',
    offline: '#ff4d4f',
    degraded: '#faad14',
    unknown: '#d9d9d9',
};
/** 主形态：页眉会话按钮；asLink：首页底部的管理入口（无下拉）。 */
export function ProviderMenu({ asLink = false }) {
    const navigate = useNavigate();
    const { providers, activeId } = useProviders();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const active = providers.find((p) => p.id === activeId);
    if (asLink) {
        return (_jsxs(_Fragment, { children: [_jsx(Button, { type: "link", size: "small", icon: _jsx(SettingOutlined, {}), style: { padding: 0, height: 'auto' }, onClick: () => setDrawerOpen(true), children: "\u7BA1\u7406\u4F1A\u5458" }), _jsx(ProviderDrawer, { open: drawerOpen, onClose: () => setDrawerOpen(false) })] }));
    }
    return (_jsxs(Space, { size: 4, children: [_jsx(Dropdown, { menu: {
                    items: [
                        {
                            key: 'session',
                            label: (_jsxs(Space, { size: 6, children: [_jsx(Badge, { color: STATUS_COLOR[active?.status ?? 'unknown'] }), _jsx("span", { children: active?.name ?? '未选择' }), _jsx(Typography.Text, { type: "secondary", style: { fontSize: 11 }, children: active?.id ?? '—' })] })),
                            disabled: true,
                        },
                        { type: 'divider' },
                        { key: 'reselect', icon: _jsx(LogoutOutlined, {}), label: '重选系统（回首页）', onClick: () => navigate('/home') },
                        { key: 'manage', icon: _jsx(SettingOutlined, {}), label: '管理会员', onClick: () => setDrawerOpen(true) },
                    ],
                }, children: _jsx(Button, { size: "small", icon: _jsx(ApiOutlined, {}), children: active?.name ?? '选择系统' }) }), _jsx(ProviderDrawer, { open: drawerOpen, onClose: () => setDrawerOpen(false) })] }));
}
function ProviderDrawer({ open, onClose }) {
    const { providers, upsert, remove, probe, activeId, setActiveId } = useProviders();
    const { message } = AntApp.useApp();
    const [form] = Form.useForm();
    const [editing, setEditing] = useState(null);
    const close = () => {
        setEditing(null);
        form.resetFields();
        onClose();
    };
    const submit = async (values) => {
        const id = editing ? editing.id : values.id.trim();
        if (!editing && !id) {
            message.error('请填写短标识');
            return;
        }
        upsert({ id, name: values.name.trim(), baseUrl: values.baseUrl.trim() });
        const probed = await probe(id).catch(() => null);
        setEditing(null);
        form.resetFields();
        if (probed?.status === 'online') {
            message.success(`已保存并在线：${probed.name}`);
            if (!activeId)
                setActiveId(probed.id);
        }
        else {
            message.warning('已保存但探测未通过——请确认代理前缀已配置（dev 需重启 vite）');
        }
    };
    return (_jsxs(Drawer, { title: "\u4F1A\u5458\u7BA1\u7406\uFF08Transfer \u00B7 \u767B\u8BB0\u59D4\u6258\u5C55\u793A\u7684\u7CFB\u7EDF\uFF09", open: open, onClose: close, width: 480, children: [_jsx(Typography.Paragraph, { type: "secondary", style: { fontSize: 12 }, children: "baseUrl \u4E3A\u540C\u6E90\u4EE3\u7406\u524D\u7F00\uFF08\u5982 /p/cmd41/api\uFF09\uFF0C\u751F\u4EA7\u73AF\u5883\u9700\u5728 nginx \u4FA7\u589E\u52A0\u5BF9\u5E94\u8F6C\u53D1\u89C4\u5219\u3002" }), providers.map((p) => (_jsxs(Space, { style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0' }, children: [_jsxs(Space, { size: 8, children: [_jsx(Badge, { color: STATUS_COLOR[p.status] }), _jsx(Typography.Text, { strong: p.id === activeId, children: p.name }), _jsx(Typography.Text, { code: true, style: { fontSize: 11 }, children: p.id }), _jsx(Typography.Text, { type: "secondary", style: { fontSize: 11 }, children: p.baseUrl })] }), _jsxs(Space, { size: 4, children: [_jsx(Button, { size: "small", type: "text", onClick: () => {
                                    setEditing(p);
                                    form.setFieldsValue({ id: p.id, name: p.name, baseUrl: p.baseUrl });
                                }, children: "\u7F16\u8F91" }), p.id !== DEFAULT_PROVIDER.id && (_jsx(Button, { size: "small", danger: true, onClick: () => Modal.confirm({
                                    title: `删除会员 ${p.name}？`,
                                    content: '登记信息与本地偏好将被移除',
                                    okText: '删除',
                                    okButtonProps: { danger: true },
                                    onOk: () => remove(p.id),
                                }), children: "\u5220\u9664" }))] })] }, p.id))), _jsx(Typography.Title, { level: 5, style: { marginTop: 16 }, children: editing ? `编辑：${editing.id}` : '登记新会员' }), _jsxs(Form, { form: form, layout: "vertical", onFinish: submit, children: [_jsx(Form.Item, { name: "id", label: "\u77ED\u6807\u8BC6", rules: [{ required: !editing, message: '必填（字母数字）' }], children: _jsx(Input, { placeholder: "cmd41", disabled: Boolean(editing) }) }), _jsx(Form.Item, { name: "name", label: "\u540D\u79F0", rules: [{ required: true, message: '必填' }], children: _jsx(Input, { placeholder: "CommAND@41 \u751F\u4EA7" }) }), _jsx(Form.Item, { name: "baseUrl", label: "\u540C\u6E90\u4EE3\u7406\u524D\u7F00", rules: [{ required: true, message: '必填' }], extra: "dev \u4EE3\u7406\u5728 .env \u7684 VITE_DEV_PROVIDERS \u58F0\u660E\u540E\u91CD\u542F\uFF1B\u751F\u4EA7\u5728 nginx \u914D\u7F6E location", children: _jsx(Input, { placeholder: "/p/cmd41/api" }) }), _jsxs(Space, { children: [_jsx(Button, { type: "primary", htmlType: "submit", children: editing ? '保存并探测' : '登记并探测' }), editing && _jsx(Button, { onClick: () => { setEditing(null); form.resetFields(); }, children: "\u53D6\u6D88\u7F16\u8F91" })] })] })] }));
}
