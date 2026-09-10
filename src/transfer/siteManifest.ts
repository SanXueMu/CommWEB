/** Site Manifest 解析（蓝图 03 §4.1/4.3）：会员声明 → 装配模型。
 *  v1 兼容：404/缺端点 → 内置默认视图集；解析产物入 memory（hash 失效 = 热部署）。 */

import { apiFor } from '@/api/client'
import { TranslationMemory, contentHash } from '@/transfer/memory'
import { getViewPrefs } from '@/transfer/preferences'
import type { ViewPrefs } from '@/transfer/preferences'

export interface SiteViewDecl {
  id: string
  type: string
  title: string
  icon?: string
  default?: boolean
  when?: { capability: string }
  props?: Record<string, unknown>
}

export interface SiteManifest {
  name: string
  protocolVersion?: string
  views: SiteViewDecl[]
}

/** 装配模型：NAV 项 + 路由 + 落地页。 */
export interface ParsedSite {
  navItems: { key: string; path: string; title: string; icon: string | undefined; viewId: string }[]
  routes: { path: string; viewId: string; type: string }[]
  landing: string
  declared: SiteViewDecl[]
}

/** 空站点（纯壳准则，2026-09-10 申明）：CommWEB 代码不存任何业务内容，
 *  业务视图一律来自会员声明（CommAND /meta/site，PG site_views 表）。
 *  无声明/拉取失败时回落空站点，由调用方渲染引导页。 */
export const DEFAULT_SITE: SiteManifest = {
  name: 'CommWEB',
  views: [],
}

interface Capabilities {
  has_pipelines: boolean
  has_files: boolean
  has_runs: boolean
  has_statuses: boolean
}

function evaluateWhen(decl: SiteViewDecl, caps: Capabilities): boolean {
  if (!decl.when) return true
  if ('capability' in decl.when) return Boolean((caps as unknown as Record<string, unknown>)[decl.when.capability])
  return true
}

function pathOf(decl: SiteViewDecl, isDefault: boolean): string {
  return isDefault ? '/' : `/${decl.id}`
}

/** 按视图类型解析路由路径（如 workspace.tabs → /work）；该类型未声明时返回 undefined。
 *  视图路由由会员 site 声明动态生成（id 未必等于类型名），任何跳转不得硬编码路径。 */
export function viewPathByType(site: ParsedSite, type: string): string | undefined {
  return site.routes.find((r) => r.type === type)?.path
}

/** 解析纯函数（声明+能力+偏好 → 装配模型）；解析产物留档 memory。 */
const siteMemory = new TranslationMemory<ParsedSite>('siteManifest')

export function parseSite(
  manifest: SiteManifest,
  caps: Capabilities,
  pid: string,
): ParsedSite {
  return siteMemory.remember(contentHash([manifest.views, manifest.name, pid, caps]), () => {
    const prefs = getViewPrefs(pid)
    const visible = manifest.views
      .filter((v) => evaluateWhen(v, caps))
      .filter((v) => !prefs.hidden.includes(v.id))
    const ordered = orderViews(visible, prefs)
    const defaultDecl = manifest.views.find((v) => v.default) ?? manifest.views[0]
    const navItems = ordered.map((v) => ({
      key: v.id,
      viewId: v.id,
      path: pathOf(v, v.id === defaultDecl?.id),
      title: v.title,
      icon: v.icon,
    }))
    const routes = ordered.map((v) => ({
      path: pathOf(v, v.id === defaultDecl?.id),
      viewId: v.id,
      type: v.type,
    }))
    const landing = navItems.find((n) => n.path === '/')?.path ?? navItems[0]?.path ?? '/'
    return { navItems, routes, landing, declared: manifest.views }
  })
}

function orderViews(views: SiteViewDecl[], prefs: ViewPrefs): SiteViewDecl[] {
  if (prefs.viewOrder.length === 0) return views
  const rank = new Map(prefs.viewOrder.map((id, i) => [id, i]))
  return [...views].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
}

/** 拉取会员声明；404/异常 → null（v1 兼容，调用方回落 DEFAULT_SITE）。 */
export async function fetchSiteManifest(pid: string): Promise<SiteManifest | null> {
  try {
    const data = (await apiFor(pid).get<{ site?: SiteManifest }>('/meta/site'))
    if (!data?.site || !Array.isArray(data.site.views) || data.site.views.length === 0) return null
    return data.site
  } catch {
    return null
  }
}

/** 视图 props 三层合并：类型默认 < 声明 props < 用户偏好 viewProps（蓝图 03 §4.4）。 */
export function mergedViewProps(decl: SiteViewDecl | undefined, pid: string): Record<string, unknown> {
  const prefs = getViewPrefs(pid)
  return { ...(decl?.props ?? {}), ...(prefs.viewProps[decl?.id ?? ''] ?? {}) }
}
