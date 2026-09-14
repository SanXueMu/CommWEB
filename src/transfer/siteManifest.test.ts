import { describe, expect, it, beforeEach } from 'vitest'
import { navKindOf, parseSite, viewPathByType, type SiteManifest } from './siteManifest'

/** 测试本地声明（协议级四视图；纯壳准则下 SITE 为空站点，测试数据自理）。 */
const SITE: SiteManifest = {
  name: 'CommWEB',
  views: [
    { id: 'tools', type: 'tools.grid', title: '工具库', icon: 'appstore-outlined', default: true },
    { id: 'flows', type: 'flows.list', title: '流', when: { capability: 'has_pipelines' } },
    { id: 'tasks', type: 'tasks.table', title: '任务中心' },
    { id: 'work', type: 'workspace.tabs', title: '工作区' },
  ],
}
import { getViewPrefs, setViewProp, updateViewPrefs } from './preferences'

/** node 环境 localStorage stub（preferences 依赖）。 */
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  },
})

const CAPS = { has_pipelines: true, has_files: false, has_runs: true, has_statuses: true }

describe('site manifest 解析（协议 v2 逆向控制）', () => {
  beforeEach(() => store.clear())

  it('默认视图集：生成四 NAV + landing=/ + 详情路由语义保留', () => {
    const parsed = parseSite(SITE, CAPS, 'test')
    expect(parsed.navItems.map((n) => n.viewId)).toEqual(['tools', 'flows', 'tasks', 'work'])
    expect(parsed.landing).toBe('/')
    expect(parsed.routes[0].path).toBe('/')
  })

  it('when.capability 求值：无流能力的会员不显示流视图', () => {
    const parsed = parseSite(SITE, { ...CAPS, has_pipelines: false }, 'test')
    expect(parsed.navItems.map((n) => n.viewId)).not.toContain('flows')
  })

  it('会员声明驱动：改声明即改导航（逆向控制核心）', () => {
    const custom = { ...SITE, views: SITE.views.filter((v) => v.id !== 'tasks') }
    const parsed = parseSite(custom, CAPS, 'test2')
    expect(parsed.navItems.map((n) => n.viewId)).not.toContain('tasks')
  })

  it('偏好覆盖声明：隐藏 + 排序（按会员隔离）', () => {
    updateViewPrefs('p1', { hidden: ['tasks'], viewOrder: ['work', 'tools', 'flows'] })
    const parsed = parseSite(SITE, CAPS, 'p1')
    expect(parsed.navItems.map((n) => n.viewId)).toEqual(['work', 'tools', 'flows'])
    const other = parseSite(SITE, CAPS, 'p2')
    expect(other.navItems.map((n) => n.viewId)).toContain('tasks')
  })

  it('memory 留档：同声明二次解析命中缓存', () => {
    const a = parseSite(SITE, CAPS, 'p3')
    const b = parseSite(SITE, CAPS, 'p3')
    expect(a).toBe(b)
  })

  it('default 落地页：无 default 标记首项挂根路径', () => {
    const noDefault = { views: [{ id: 'x', type: 'tasks.table', title: 'X' }] }
    const parsed = parseSite(noDefault as never, CAPS, 'p4')
    expect(parsed.landing).toBe('/')
    expect(parsed.routes[0].path).toBe('/')
  })

  it('viewPathByType：按类型解析视图路由路径（声明 id 非硬编码）', () => {
    const parsed = parseSite(SITE, CAPS, 'test')
    expect(viewPathByType(parsed, 'workspace.tabs')).toBe('/work')
    expect(viewPathByType(parsed, 'flows.list')).toBe('/flows')
    expect(viewPathByType(parsed, 'no.such.type')).toBeUndefined()
  })
})

describe('导航渲染模型（props.nav：tab / menu / child / header / hidden）', () => {
  const NAV_SITE: SiteManifest = {
    name: 'CommWEB',
    views: [
      { id: 'tools', type: 'tools.grid', title: '工具库', default: true },
      { id: 'flows', type: 'flows.list', title: '工作流' },
      { id: 'tasks', type: 'tasks.table', title: '任务中心' },
      { id: 'work', type: 'workspace.tabs', title: '工作区', props: { nav: { kind: 'menu' }, defaultLabel: '默认' } },
      { id: 'ocr', type: 'ocr.studio', title: 'OCR 工作台', props: { nav: { kind: 'child', group: 'work', label: 'OCR 工作台' } } },
      { id: 'translate', type: 'translate.studio', title: '翻译工作台', props: { nav: { kind: 'child', group: 'work', label: '翻译工作台' } } },
      { id: 'templates', type: 'templates.manager', title: '模版管理', props: { nav: { kind: 'hidden' } } },
      { id: 'settings', type: 'settings.keys', title: '设置', props: { nav: { kind: 'header', label: 'APIKey管理', order: 20 } } },
    ],
  }

  beforeEach(() => store.clear())

  it('顶层 NAV 只含 tab 与 menu：child / header / hidden 不上顶层', () => {
    const parsed = parseSite(NAV_SITE, CAPS, 'nav1')
    expect(parsed.navItems.map((n) => n.viewId)).toEqual(['tools', 'flows', 'tasks', 'work'])
    expect(parsed.navItems.map((n) => n.kind)).toEqual(['tab', 'tab', 'tab', 'menu'])
  })

  it('menu 出下拉：首项为菜单自身「默认」，其后为 group 子项（声明顺序）', () => {
    const work = parseSite(NAV_SITE, CAPS, 'nav2').navItems.find((n) => n.viewId === 'work')
    expect(work?.children?.map((c) => c.title)).toEqual(['默认', 'OCR 工作台', '翻译工作台'])
    expect(work?.children?.[0].isSelf).toBe(true)
    expect(work?.children?.[0].path).toBe('/work')
    expect(work?.children?.slice(1).map((c) => c.path)).toEqual(['/ocr', '/translate'])
  })

  it('hidden 不进导航但仍注册路由（按声明 id 弹窗/直达可用）', () => {
    const parsed = parseSite(NAV_SITE, CAPS, 'nav3')
    expect(parsed.routes.map((r) => r.viewId)).toContain('templates')
    expect(parsed.navItems.flatMap((n) => [n.viewId, ...(n.children ?? []).map((c) => c.viewId)]))
      .not.toContain('templates')
  })

  it('header 项出页眉下拉（label 覆盖 title、按 order 升序）', () => {
    const parsed = parseSite(NAV_SITE, CAPS, 'nav4')
    expect(parsed.headerActions).toEqual([
      { key: 'settings', viewId: 'settings', path: '/settings', title: 'APIKey管理', order: 20 },
    ])
  })

  it('navKindOf：缺省 tab、非法值回落 tab', () => {
    expect(navKindOf({ id: 'a', type: 't', title: 'A' })).toBe('tab')
    expect(navKindOf({ id: 'a', type: 't', title: 'A', props: { nav: { kind: 'nope' } } })).toBe('tab')
    expect(navKindOf({ id: 'a', type: 't', title: 'A', props: { nav: { kind: 'hidden' } } })).toBe('hidden')
    expect(navKindOf(undefined)).toBe('tab')
  })

  it('子项 can 被偏好隐藏：hidden 命中即整项退出下拉', () => {
    updateViewPrefs('nav5', { hidden: ['ocr'] })
    const work = parseSite(NAV_SITE, CAPS, 'nav5').navItems.find((n) => n.viewId === 'work')
    expect(work?.children?.map((c) => c.viewId)).toEqual(['work', 'translate'])
  })
})

describe('preferences（偏好双层）', () => {
  beforeEach(() => store.clear())

  it('viewProps 覆盖：声明默认 < 用户偏好', () => {
    expect(getViewPrefs('a').viewProps).toEqual({})
    setViewProp('a', 'tools', 'defaultLayout', 'list')
    expect(getViewPrefs('a').viewProps.tools).toEqual({ defaultLayout: 'list' })
    expect(getViewPrefs('b').viewProps).toEqual({})
  })
})
