import { describe, expect, it, beforeEach } from 'vitest';
import { parseSite } from './siteManifest';
/** 测试本地声明（协议级四视图；纯壳准则下 SITE 为空站点，测试数据自理）。 */
const SITE = {
    name: 'CommWEB',
    views: [
        { id: 'tools', type: 'tools.grid', title: '工具库', icon: 'appstore-outlined', default: true },
        { id: 'flows', type: 'flows.list', title: '流', when: { capability: 'has_pipelines' } },
        { id: 'tasks', type: 'tasks.table', title: '任务中心' },
        { id: 'work', type: 'workspace.tabs', title: '工作区' },
    ],
};
import { getViewPrefs, setViewProp, updateViewPrefs } from './preferences';
/** node 环境 localStorage stub（preferences 依赖）。 */
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
    },
});
const CAPS = { has_pipelines: true, has_files: false, has_runs: true, has_statuses: true };
describe('site manifest 解析（协议 v2 逆向控制）', () => {
    beforeEach(() => store.clear());
    it('默认视图集：生成四 NAV + landing=/ + 详情路由语义保留', () => {
        const parsed = parseSite(SITE, CAPS, 'test');
        expect(parsed.navItems.map((n) => n.viewId)).toEqual(['tools', 'flows', 'tasks', 'work']);
        expect(parsed.landing).toBe('/');
        expect(parsed.routes[0].path).toBe('/');
    });
    it('when.capability 求值：无流能力的会员不显示流视图', () => {
        const parsed = parseSite(SITE, { ...CAPS, has_pipelines: false }, 'test');
        expect(parsed.navItems.map((n) => n.viewId)).not.toContain('flows');
    });
    it('会员声明驱动：改声明即改导航（逆向控制核心）', () => {
        const custom = { ...SITE, views: SITE.views.filter((v) => v.id !== 'tasks') };
        const parsed = parseSite(custom, CAPS, 'test2');
        expect(parsed.navItems.map((n) => n.viewId)).not.toContain('tasks');
    });
    it('偏好覆盖声明：隐藏 + 排序（按会员隔离）', () => {
        updateViewPrefs('p1', { hidden: ['tasks'], viewOrder: ['work', 'tools', 'flows'] });
        const parsed = parseSite(SITE, CAPS, 'p1');
        expect(parsed.navItems.map((n) => n.viewId)).toEqual(['work', 'tools', 'flows']);
        const other = parseSite(SITE, CAPS, 'p2');
        expect(other.navItems.map((n) => n.viewId)).toContain('tasks');
    });
    it('memory 留档：同声明二次解析命中缓存', () => {
        const a = parseSite(SITE, CAPS, 'p3');
        const b = parseSite(SITE, CAPS, 'p3');
        expect(a).toBe(b);
    });
    it('default 落地页：无 default 标记首项挂根路径', () => {
        const noDefault = { views: [{ id: 'x', type: 'tasks.table', title: 'X' }] };
        const parsed = parseSite(noDefault, CAPS, 'p4');
        expect(parsed.landing).toBe('/');
        expect(parsed.routes[0].path).toBe('/');
    });
});
describe('preferences（偏好双层）', () => {
    beforeEach(() => store.clear());
    it('viewProps 覆盖：声明默认 < 用户偏好', () => {
        expect(getViewPrefs('a').viewProps).toEqual({});
        setViewProp('a', 'tools', 'defaultLayout', 'list');
        expect(getViewPrefs('a').viewProps.tools).toEqual({ defaultLayout: 'list' });
        expect(getViewPrefs('b').viewProps).toEqual({});
    });
});
