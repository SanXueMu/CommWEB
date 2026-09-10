/** Site Manifest 解析（蓝图 03 §4.1/4.3）：会员声明 → 装配模型。
 *  v1 兼容：404/缺端点 → 内置默认视图集；解析产物入 memory（hash 失效 = 热部署）。 */
import { apiFor } from '@/api/client';
import { TranslationMemory, contentHash } from '@/transfer/memory';
import { getViewPrefs } from '@/transfer/preferences';
/** 空站点（纯壳准则，2026-09-10 申明）：CommWEB 代码不存任何业务内容，
 *  业务视图一律来自会员声明（CommAND /meta/site，PG site_views 表）。
 *  无声明/拉取失败时回落空站点，由调用方渲染引导页。 */
export const DEFAULT_SITE = {
    name: 'CommWEB',
    views: [],
};
function evaluateWhen(decl, caps) {
    if (!decl.when)
        return true;
    if ('capability' in decl.when)
        return Boolean(caps[decl.when.capability]);
    return true;
}
function pathOf(decl, isDefault) {
    return isDefault ? '/' : `/${decl.id}`;
}
/** 解析纯函数（声明+能力+偏好 → 装配模型）；解析产物留档 memory。 */
const siteMemory = new TranslationMemory('siteManifest');
export function parseSite(manifest, caps, pid) {
    return siteMemory.remember(contentHash([manifest.views, manifest.name, pid, caps]), () => {
        const prefs = getViewPrefs(pid);
        const visible = manifest.views
            .filter((v) => evaluateWhen(v, caps))
            .filter((v) => !prefs.hidden.includes(v.id));
        const ordered = orderViews(visible, prefs);
        const defaultDecl = manifest.views.find((v) => v.default) ?? manifest.views[0];
        const navItems = ordered.map((v) => ({
            key: v.id,
            viewId: v.id,
            path: pathOf(v, v.id === defaultDecl?.id),
            title: v.title,
            icon: v.icon,
        }));
        const routes = ordered.map((v) => ({
            path: pathOf(v, v.id === defaultDecl?.id),
            viewId: v.id,
            type: v.type,
        }));
        const landing = navItems.find((n) => n.path === '/')?.path ?? navItems[0]?.path ?? '/';
        return { navItems, routes, landing, declared: manifest.views };
    });
}
function orderViews(views, prefs) {
    if (prefs.viewOrder.length === 0)
        return views;
    const rank = new Map(prefs.viewOrder.map((id, i) => [id, i]));
    return [...views].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}
/** 拉取会员声明；404/异常 → null（v1 兼容，调用方回落 DEFAULT_SITE）。 */
export async function fetchSiteManifest(pid) {
    try {
        const data = (await apiFor(pid).get('/meta/site'));
        if (!data?.site || !Array.isArray(data.site.views) || data.site.views.length === 0)
            return null;
        return data.site;
    }
    catch {
        return null;
    }
}
/** 视图 props 三层合并：类型默认 < 声明 props < 用户偏好 viewProps（蓝图 03 §4.4）。 */
export function mergedViewProps(decl, pid) {
    const prefs = getViewPrefs(pid);
    return { ...(decl?.props ?? {}), ...(prefs.viewProps[decl?.id ?? ''] ?? {}) };
}
