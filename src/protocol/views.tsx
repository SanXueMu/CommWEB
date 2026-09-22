/** 视图类型注册表（蓝图 03 §4.2）：type → 渲染能力映射，CommWEB 核心资产。
 *  未知 type 降级占位；icon 白名单防注入；详情路由为类型内部实现（协议保留字 tools/flows）。 */

import type { ComponentType } from 'react'
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
import { OcrStudio } from '@/pages/OcrStudio'
import { TranslateStudio } from '@/pages/TranslateStudio'

/** 内联 SVG 图标工厂：stroke 跟随 currentColor，免去图标库依赖。 */
function makeIcon(d: string): ComponentType {
  return function Icon() {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ verticalAlign: '-2px', flexShrink: 0 }}>
        <path d={d} />
      </svg>
    )
  }
}

/** icon 白名单：声明用 kebab-case，未知名回落默认（防任意组件注入）。 */
const ICONS: Record<string, ComponentType> = {
  'appstore-outlined': makeIcon('M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z'),
  'unordered-list-outlined': makeIcon('M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01'),
  'desktop-outlined': makeIcon('M2.5 3.5h11v7h-11zM6 13.5h4M8 10.5v3'),
  'node-index-outlined': makeIcon('M2.5 2.5h4v4h-4zM9.5 9.5h4v4h-4zM6.5 4.5h5v5'),
  'table-outlined': makeIcon('M2.5 3.5h11v9h-11zM2.5 7h11M2.5 10.5h11M6.5 3.5v9'),
  'profile-outlined': makeIcon('M4 2.5h8v11H4zM6 5.5h4M6 8h4M6 10.5h2.5'),
  'partition-outlined': makeIcon('M2.5 3.5h11v9h-11zM8 3.5v9'),
  'cluster-outlined': makeIcon('M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M11 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0'),
  'database-outlined': makeIcon('M3 4c0-1 2.2-1.8 5-1.8S13 3 13 4v8c0 1-2.2 1.8-5 1.8S3 13 3 12zM3 8c0 1 2.2 1.8 5 1.8S13 9 13 8'),
  'file-text-outlined': makeIcon('M4 2.5h5.5L12.5 5v8.5H4zM9.5 2.5V5h3M6 8h4M6 10.5h4'),
  'api-outlined': makeIcon('M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM5.5 5.5l5 5M10.5 5.5l-5 5'),
  'translation-outlined': makeIcon('M2.5 3.5h6M5.5 2.5v1M7 3.5c-.5 2.5-2.5 5-4.5 6M4 6c1 2 3 3.5 5 4M8.5 13.5l3-7 3 7M9.7 11.5h3.6'),
}

export function resolveIcon(name?: string): ComponentType {
  return (name && ICONS[name]) || ICONS['appstore-outlined']
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
  'ocr.studio': { component: OcrStudio },
  'translate.studio': { component: TranslateStudio },
}

/** 未知类型降级：不炸、不瞒（蓝图 03 治理规则）。 */
export function UnknownView({ type }: { type: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--cw-text-muted)' }}>
      该系统使用了 CommWEB 尚不支持的视图类型：<code>{type}</code>
    </div>
  )
}

export function viewComponent(type: string): ComponentType {
  return VIEW_TYPES[type]?.component ?? (() => <UnknownView type={type} />)
}

export function viewDetailRoutes(type: string): { path: string; element: ReactNode }[] {
  return VIEW_TYPES[type]?.detailRoutes ?? []
}
