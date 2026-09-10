import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** 页眉：无色背景 + 左侧 logo（预留 CommAND 首页链接）+ 右上角状态栏（显示器图标 hover 出主题下拉）。 */
import { AppstoreOutlined, DesktopOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Checkbox, Divider, Popover, Space, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { ProviderMenu } from '@/components/ProviderMenu';
import { useTheme } from '@/theme/store';
import { useSiteCatalog } from '@/config/useSiteCatalog';
import { useProviders } from '@/transfer/context';
import { updateViewPrefs } from '@/transfer/preferences';
import { resolveIcon } from '@/protocol/views';
const THEME_OPTIONS = [
    { value: 'light', label: '亮色' },
    { value: 'dark', label: '暗色' },
    { value: 'brand', label: '品牌' },
];
export function AppHeader() {
    const { name, setTheme } = useTheme();
    const location = useLocation();
    const { site, refreshPrefs } = useSiteCatalog();
    const { activeId } = useProviders();
    const pid = activeId ?? 'default';
    const NAV = site.navItems.map((n) => ({ path: n.path, label: n.title, icon: n.icon, viewId: n.viewId }));
    const toggleHidden = (viewId, visible) => {
        const declaredIds = site.declared.map((d) => d.id);
        const existing = declaredIds.filter((id) => !NAV.some((n) => n.viewId === id));
        updateViewPrefs(pid, { hidden: visible ? existing.filter((id) => id !== viewId) : [...existing, viewId] });
        refreshPrefs();
    };
    const moveView = (viewId, dir) => {
        const order = [...site.navItems.map((n) => n.viewId)];
        const i = order.indexOf(viewId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= order.length)
            return;
        [order[i], order[j]] = [order[j], order[i]];
        updateViewPrefs(pid, { viewOrder: order });
        refreshPrefs();
    };
    const resetPrefs = () => {
        updateViewPrefs(pid, { hidden: [], viewOrder: [] });
        refreshPrefs();
    };
    const manageMenu = (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: 4, minWidth: 200 }, children: [_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12, padding: '2px 8px' }, children: "\u7BA1\u7406\u89C6\u56FE" }), site.declared.map((decl) => {
                const visible = NAV.some((n) => n.viewId === decl.id);
                return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px' }, children: [_jsx(Checkbox, { checked: visible, onChange: (e) => toggleHidden(decl.id, e.target.checked), children: _jsx("span", { style: { fontSize: 13 }, children: decl.title }) }), visible && (_jsxs(Space, { size: 0, children: [_jsx(Button, { type: "text", size: "small", onClick: () => moveView(decl.id, -1), children: "\u2191" }), _jsx(Button, { type: "text", size: "small", onClick: () => moveView(decl.id, 1), children: "\u2193" })] }))] }, decl.id));
            }), _jsx(Divider, { style: { margin: '4px 0' } }), _jsx(Typography.Link, { style: { fontSize: 12, padding: '2px 8px' }, onClick: resetPrefs, children: "\u6062\u590D\u9ED8\u8BA4" })] }));
    const themePanel = (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }, children: [_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12, padding: '2px 8px' }, children: "\u4E3B\u9898" }), THEME_OPTIONS.map((option) => (_jsx(Typography.Link, { strong: option.value === name, style: { padding: '4px 8px', borderRadius: 4, color: option.value === name ? '#202753' : undefined }, onClick: () => setTheme(option.value), children: option.label }, option.value)))] }));
    return (_jsxs("header", { style: {
            height: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            background: 'transparent',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backdropFilter: 'blur(6px)',
        }, children: [_jsxs(Space, { size: 8, children: [_jsx(AppstoreOutlined, { style: { fontSize: 20, color: '#202753' } }), _jsx(Typography.Text, { strong: true, style: { fontSize: 16 }, children: "CommWEB" })] }), _jsx("nav", { style: { display: 'flex', gap: 20, flex: 1 }, children: NAV.map((item) => (_jsxs(Link, { to: item.path, style: {
                        color: location.pathname === item.path ? '#202753' : '#8c8c8c',
                        fontWeight: location.pathname === item.path ? 600 : 400,
                        textDecoration: 'none',
                        fontSize: 14,
                    }, children: [_jsx("span", { style: { marginRight: 6 }, children: (() => { const Icon = resolveIcon(item.icon); return _jsx(Icon, {}); })() }), item.label] }, item.path))) }), _jsx(Popover, { content: manageMenu, trigger: "click", placement: "bottomRight", children: _jsx(Button, { type: "text", size: "small", icon: _jsx(SettingOutlined, {}), title: "\u7BA1\u7406\u89C6\u56FE" }) }), _jsx(Popover, { trigger: "hover", placement: "bottomRight", content: themePanel, children: _jsx(DesktopOutlined, { style: { fontSize: 18, color: '#595959', cursor: 'pointer' } }) }), _jsx(ProviderMenu, {})] }));
}
