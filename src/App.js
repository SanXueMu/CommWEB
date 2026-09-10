import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { App as AntApp, ConfigProvider, Typography } from 'antd';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { PORTAL } from '@/config/portal';
import { useTheme } from '@/theme/store';
import { WorkspaceProvider } from '@/workspace/store';
import { TransferProvider, useProviders } from '@/transfer/context';
import { Home } from '@/pages/Home';
import { useSiteCatalog } from '@/config/useSiteCatalog';
import { ViewScope } from '@/protocol/ViewPropsContext';
import { viewComponent, viewDetailRoutes } from '@/protocol/views';
/** 会话壳：未激活守卫（蓝图05 §五.3）；被删会员回退提示（§七.2）。 */
function AppShell({ children }) {
    const { activeId } = useProviders();
    const location = useLocation();
    const { message } = AntApp.useApp();
    useEffect(() => {
        const onRemoved = (e) => {
            const id = e.detail?.id;
            message.warning(`所选会员已被移除${id ? `（${id}）` : ''}，请重新选择`);
        };
        window.addEventListener('commweb:member-removed', onRemoved);
        return () => window.removeEventListener('commweb:member-removed', onRemoved);
    }, [message]);
    if (!activeId && location.pathname !== '/home')
        return _jsx(Navigate, { to: "/home", replace: true });
    return _jsx(_Fragment, { children: children });
}
function App() {
    const { config } = useTheme();
    return (_jsx(ConfigProvider, { theme: config, children: _jsx(AntApp, { children: _jsx(TransferProvider, { children: _jsx(SiteFrame, {}) }) }) }));
}
/** 站点装配与路由壳：必须在 TransferProvider 内渲染（useSiteCatalog 依赖会员上下文）。 */
function SiteFrame() {
    const location = useLocation();
    const { site } = useSiteCatalog();
    const { activeId: activePid } = useProviders();
    const pidForViews = activePid ?? '';
    const detailPrefixes = site.navItems
        .flatMap((n) => viewDetailRoutes(site.routes.find((r) => r.viewId === n.viewId)?.type ?? ''))
        .map((r) => r.path.split('/:')[0]);
    const isDetail = detailPrefixes.some((prefix) => location.pathname.startsWith(prefix)) ||
        location.pathname.startsWith('/tools/') || location.pathname.startsWith('/flows/');
    return (_jsx(AppShell, { children: _jsx(WorkspaceProvider, { children: _jsxs("div", { style: { minHeight: '100vh', background: '#fff' }, children: [_jsx(AppHeader, {}), _jsxs("main", { style: {
                            padding: isDetail ? '24px' : '24px 24px 48px',
                            maxWidth: 1200,
                            margin: '0 auto',
                        }, children: [site.routes.length === 0 && _jsx(EmptySiteGuide, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/home", element: _jsx(Home, {}) }), site.landing !== '/' && _jsx(Route, { path: "/", element: _jsx(Navigate, { to: site.landing, replace: true }) }), site.routes.map((r) => {
                                        const DeclView = viewComponent(r.type);
                                        const decl = site.declared.find((d) => d.id === r.viewId);
                                        return (_jsx(Route, { path: r.path, element: decl ? _jsx(ViewScope, { decl: decl, pid: pidForViews, children: _jsx(DeclView, {}) }) : _jsx(DeclView, {}) }, r.path));
                                    }), site.navItems.flatMap((n) => {
                                        const type = site.routes.find((r) => r.viewId === n.viewId)?.type ?? '';
                                        return viewDetailRoutes(type).map((d) => (_jsx(Route, { path: d.path, element: d.element }, d.path)));
                                    }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: site.landing, replace: true }) })] }), !isDetail && (_jsx(Typography.Text, { type: "secondary", style: { fontSize: 12, display: 'block', marginTop: 32 }, children: PORTAL.footer }))] })] }) }) }));
}
export { App };
/** 空站点引导（纯壳准则）：会员未声明任何视图时的协议级提示，非业务页面。 */
function EmptySiteGuide() {
    return (_jsxs("div", { style: { textAlign: 'center', padding: '80px 0' }, children: [_jsx(Typography.Title, { level: 3, style: { marginBottom: 8 }, children: "\u8BE5\u4F1A\u5458\u5C1A\u672A\u58F0\u660E\u7AD9\u70B9\u89C6\u56FE" }), _jsxs(Typography.Text, { type: "secondary", children: ["CommWEB \u4E0D\u5185\u7F6E\u4EFB\u4F55\u4E1A\u52A1\u5185\u5BB9\u3002\u89C6\u56FE\u96C6\u7531\u4F1A\u5458\u7ECF ", _jsx(Typography.Text, { code: true, children: "/meta/site" }), " \u58F0\u660E \uFF08\u5B58\u4E8E\u4F1A\u5458\u7684\u6570\u636E\u5E93\uFF0C\u6CE8\u518C\u4E0E\u6BCF\u6B21\u70ED\u90E8\u7F72\u540E\u751F\u6548\uFF09\u3002"] })] }));
}
