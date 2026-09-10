/** 偏好双层（蓝图 03 §4.4）：用户视图偏好（localStorage per 会员）——会员声明为默认值，用户偏好为覆盖值。
 *  同时收编散落的布局偏好（defaultLayout），修复跨会员布局泄漏。 */
const EMPTY = { hidden: [], viewOrder: [], viewProps: {} };
function keyOf(pid) {
    return `commweb.prefs.${pid}`;
}
export function getViewPrefs(pid) {
    try {
        const raw = localStorage.getItem(keyOf(pid));
        if (!raw)
            return { ...EMPTY, viewProps: {} };
        const parsed = JSON.parse(raw);
        return {
            hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
            viewOrder: Array.isArray(parsed.viewOrder) ? parsed.viewOrder : [],
            viewProps: parsed.viewProps && typeof parsed.viewProps === 'object' ? parsed.viewProps : {},
        };
    }
    catch {
        return { ...EMPTY, viewProps: {} };
    }
}
export function setViewPrefs(pid, prefs) {
    localStorage.setItem(keyOf(pid), JSON.stringify(prefs));
}
export function updateViewPrefs(pid, patch) {
    const next = { ...getViewPrefs(pid), ...patch };
    setViewPrefs(pid, next);
    return next;
}
/** 视图级 props 覆盖（如 defaultLayout）。 */
export function setViewProp(pid, viewId, prop, value) {
    const prefs = getViewPrefs(pid);
    prefs.viewProps[viewId] = { ...(prefs.viewProps[viewId] ?? {}), [prop]: value };
    setViewPrefs(pid, prefs);
}
/** 删除会员时清理（蓝图 03 §4.4）。 */
export function clearViewPrefs(pid) {
    localStorage.removeItem(keyOf(pid));
}
