import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ApiOutlined, AppstoreOutlined, ClusterOutlined, DatabaseOutlined, DesktopOutlined, FileTextOutlined, NodeIndexOutlined, PartitionOutlined, ProfileOutlined, TableOutlined, UnorderedListOutlined, } from '@ant-design/icons';
import { Empty, Typography } from 'antd';
import { ToolsHub } from '@/pages/ToolsHub';
import { Tasks } from '@/pages/Tasks';
import { Flows } from '@/pages/Flows';
import { Workspace } from '@/pages/Workspace';
import { ToolDetail } from '@/pages/ToolDetail';
import { FlowDetail } from '@/pages/FlowDetail';
import { DataBrowser } from '@/components/DataBrowser';
import { PipelineStudio } from '@/components/PipelineStudio';
import { SettingsKeys } from '@/components/SettingsKeys';
/** icon 白名单：声明用 kebab-case，未知名回落默认（防任意组件注入）。 */
const ICONS = {
    'appstore-outlined': AppstoreOutlined,
    'unordered-list-outlined': UnorderedListOutlined,
    'desktop-outlined': DesktopOutlined,
    'node-index-outlined': NodeIndexOutlined,
    'table-outlined': TableOutlined,
    'profile-outlined': ProfileOutlined,
    'partition-outlined': PartitionOutlined,
    'cluster-outlined': ClusterOutlined,
    'database-outlined': DatabaseOutlined,
    'file-text-outlined': FileTextOutlined,
    'api-outlined': ApiOutlined,
};
export function resolveIcon(name) {
    return (name && ICONS[name]) || AppstoreOutlined;
}
export const VIEW_TYPES = {
    'tools.grid': {
        component: ToolsHub,
        detailRoutes: [{ path: '/tools/:id', element: _jsx(ToolDetail, {}) }],
    },
    'flows.list': {
        component: Flows,
        detailRoutes: [{ path: '/flows/:id', element: _jsx(FlowDetail, {}) }],
    },
    'tasks.table': { component: Tasks },
    'workspace.tabs': { component: Workspace },
    'data.browser': { component: DataBrowser },
    'pipeline.studio': { component: PipelineStudio },
    'settings.keys': { component: SettingsKeys },
};
/** 未知类型降级：不炸、不瞒（蓝图 03 治理规则）。 */
export function UnknownView({ type }) {
    return (_jsx(Empty, { description: _jsxs(Typography.Text, { type: "secondary", children: ["\u8BE5\u7CFB\u7EDF\u4F7F\u7528\u4E86 CommWEB \u5C1A\u4E0D\u652F\u6301\u7684\u89C6\u56FE\u7C7B\u578B\uFF1A", _jsx("code", { children: type })] }) }));
}
export function viewComponent(type) {
    return VIEW_TYPES[type]?.component ?? (() => _jsx(UnknownView, { type: type }));
}
export function viewDetailRoutes(type) {
    return VIEW_TYPES[type]?.detailRoutes ?? [];
}
