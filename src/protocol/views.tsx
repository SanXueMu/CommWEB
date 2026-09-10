/** 视图类型注册表（蓝图 03 §4.2）：type → 渲染能力映射，CommWEB 核心资产。
 *  未知 type 降级占位；icon 白名单防注入；详情路由为类型内部实现（协议保留字 tools/flows）。 */

import type { ComponentType } from 'react'
import {
  ApiOutlined,
  AppstoreOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ProfileOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Empty, Typography } from 'antd'
import type { ReactNode } from 'react'
import { ToolsHub } from '@/pages/ToolsHub'
import { Tasks } from '@/pages/Tasks'
import { Flows } from '@/pages/Flows'
import { Workspace } from '@/pages/Workspace'
import { ToolDetail } from '@/pages/ToolDetail'
import { FlowDetail } from '@/pages/FlowDetail'
import { DataBrowser } from '@/components/DataBrowser'
import { PipelineStudio } from '@/components/PipelineStudio'
import { SettingsKeys } from '@/components/SettingsKeys'
import { TemplateManager } from '@/components/TemplateManager'

/** icon 白名单：声明用 kebab-case，未知名回落默认（防任意组件注入）。 */
const ICONS: Record<string, ComponentType> = {
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
}

export function resolveIcon(name?: string): ComponentType {
  return (name && ICONS[name]) || AppstoreOutlined
}

/** 类型注册表：主视图组件 + 该类型附带的内部详情路由（path 为协议保留字，与视图 id 解耦）。 */
interface ViewTypeEntry {
  component: ComponentType
  detailRoutes?: { path: string; element: ReactNode }[]
}

export const VIEW_TYPES: Record<string, ViewTypeEntry> = {
  'tools.grid': {
    component: ToolsHub,
    detailRoutes: [{ path: '/tools/:id', element: <ToolDetail /> }],
  },
  'flows.list': {
    component: Flows,
    detailRoutes: [{ path: '/flows/:id', element: <FlowDetail /> }],
  },
  'tasks.table': { component: Tasks },
  'workspace.tabs': { component: Workspace },
  'data.browser': { component: DataBrowser },
  'pipeline.studio': { component: PipelineStudio },
  'settings.keys': { component: SettingsKeys },
  'templates.manager': { component: TemplateManager },
}

/** 未知类型降级：不炸、不瞒（蓝图 03 治理规则）。 */
export function UnknownView({ type }: { type: string }) {
  return (
    <Empty
      description={
        <Typography.Text type="secondary">
          该系统使用了 CommWEB 尚不支持的视图类型：<code>{type}</code>
        </Typography.Text>
      }
    />
  )
}

export function viewComponent(type: string): ComponentType {
  return VIEW_TYPES[type]?.component ?? (() => <UnknownView type={type} />)
}

export function viewDetailRoutes(type: string): { path: string; element: ReactNode }[] {
  return VIEW_TYPES[type]?.detailRoutes ?? []
}
