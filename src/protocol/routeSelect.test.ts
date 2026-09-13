import { describe, expect, it } from 'vitest'
import { defaultParams, matchRoutes, visibleParams, type ParamField, type Route } from './routeSelect'

const routes: Route[] = [
  { ext: ['.pdf'], flow: 'flow.a', label: 'A' },
  { ext: ['.pdf'], flow: 'flow.b', label: 'B' },
  { ext: ['.txt', '.md'], flow: 'flow.c' },
]

describe('matchRoutes', () => {
  it('同后缀多条 → 全部候选', () => {
    expect(matchRoutes('X.PDF', routes).map((r) => r.flow)).toEqual(['flow.a', 'flow.b'])
  })
  it('未匹配 / 空文件 → 空', () => {
    expect(matchRoutes(undefined, routes)).toEqual([])
    expect(matchRoutes('report.docx', routes)).toEqual([])
  })
  it('大小写不敏感 + 多后缀 + 路径', () => {
    expect(matchRoutes('a/b/c.MD', routes).map((r) => r.flow)).toEqual(['flow.c'])
  })
})

const params: ParamField[] = [
  { name: 'mode', label: 'M', type: 'select', default: 'overlay', when_flow: ['flow.b'] },
  { name: 'note', label: 'N' },
]

describe('params', () => {
  it('when_flow 过滤', () => {
    expect(visibleParams(params, 'flow.b').map((p) => p.name)).toEqual(['mode', 'note'])
    expect(visibleParams(params, 'flow.a').map((p) => p.name)).toEqual(['note'])
    expect(visibleParams(params, undefined).map((p) => p.name)).toEqual(['note'])
  })
  it('默认值初始化', () => {
    expect(defaultParams(params, 'flow.b')).toEqual({ mode: 'overlay', note: '' })
    expect(defaultParams(params, 'flow.a')).toEqual({ note: '' })
  })
})
