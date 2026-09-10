import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 起始首页（蓝图04）：零状态界面——未激活时的唯一界面；点卡即激活。 */
import { Alert, App as AntApp, Modal, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ProviderMenu } from '@/components/ProviderMenu';
import { PORTAL } from '@/config/portal';
import { useProviders } from '@/transfer/context';
import { providerColor } from '@/components/ProviderBadge';
const STATUS_COLOR = {
    online: '#52c41a',
    offline: '#ff4d4f',
    degraded: '#faad14',
    unknown: '#d9d9d9',
};
function capabilitySummary(p) {
    if (p.status === 'unknown')
        return '探测中…';
    if (p.status === 'offline')
        return '不可达';
    const caps = p.capabilities;
    const parts = [];
    if (caps.has_pipelines)
        parts.push('工具·流');
    else
        parts.push('工具');
    if (caps.has_statuses)
        parts.push('任务');
    return parts.join(' · ');
}
export function Home() {
    const { providers, activeId, setActiveId, probeAll } = useProviders();
    const { message } = AntApp.useApp();
    const navigate = useNavigate();
    const onlineFirst = [...providers].sort((a, b) => {
        const rank = (p) => (p.status === 'online' ? 0 : p.status === 'unknown' ? 1 : 2);
        return rank(a) - rank(b);
    });
    const allOffline = providers.length > 0 && providers.every((p) => p.status === 'offline');
    const activate = async (p) => {
        if (p.status === 'offline') {
            const confirmed = await new Promise((resolve) => {
                Modal.confirm({
                    title: '该系统当前不可达',
                    content: `${p.name}（${p.baseUrl}）探测失败，仍要进入？`,
                    okText: '仍要进入',
                    cancelText: '取消',
                    onOk: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!confirmed)
                return;
        }
        setActiveId(p.id);
        message.success(`已选择 ${p.name}`);
        navigate('/');
    };
    return (_jsx("div", { className: "home-shell", children: _jsxs("div", { className: "home-column", children: [_jsx(Typography.Title, { level: 3, style: { marginBottom: 4 }, children: PORTAL.home.title }), _jsx(Typography.Text, { type: "secondary", style: { fontSize: 13, display: 'block', marginBottom: 20 }, children: PORTAL.home.subtitle(providers.length) }), allOffline && (_jsx(Alert, { type: "warning", showIcon: true, message: PORTAL.home.allOffline, action: _jsx("a", { onClick: probeAll, children: PORTAL.home.retry }), style: { marginBottom: 16 } })), _jsx("div", { className: providers.length > 6 ? 'home-grid home-grid-2' : 'home-grid', children: onlineFirst.map((p) => {
                        const using = p.id === activeId;
                        return (_jsxs("button", { className: `home-card${using ? ' home-card-using' : ''}`, onClick: () => activate(p), title: `会员：${p.name}（${p.id}）`, children: [_jsx("span", { className: "home-dot", style: { background: STATUS_COLOR[p.status] } }), _jsx("span", { className: "home-avatar", style: { background: providerColor(p.id) }, children: p.name.slice(0, 1).toUpperCase() }), _jsxs("span", { className: "home-meta", children: [_jsxs("span", { className: "home-name", children: [p.name, using && _jsx("span", { className: "home-using-tag", children: PORTAL.home.using })] }), _jsxs("span", { className: "home-id", children: [p.id, " \u00B7 ", p.baseUrl] })] }), _jsx("span", { className: "home-caps", children: capabilitySummary(p) })] }, p.id));
                    }) }), _jsx(Space, { style: { marginTop: 24 }, children: _jsx(Typography.Text, { type: "secondary", style: { fontSize: 13 }, children: _jsx(ProviderMenu, { asLink: true }) }) }), providers.length === 1 && (_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12, marginTop: 8, display: 'block' }, children: PORTAL.home.singleHint }))] }) }));
}
