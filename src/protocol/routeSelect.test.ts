import { describe, expect, it } from 'vitest'
import {
  defaultParams, flowForFile, imagePageLimit, matchRoutes, matchUnsupported, paramDefault, routeForProbe,
  supportedExtensions, visibleParams,
  type ParamField, type Route, type UnsupportedRule,
} from './routeSelect'

const mixedRoutes: Route[] = [
  { ext: ['.pdf'], flow: 'flow.translate.pdf.layout', label: '版式翻译' },
  { ext: ['.pdf'], flow: 'flow.translate.pdf', label: '文档翻译' },
  { ext: ['.docx'], flow: 'flow.translate.docx', label: 'Word 翻译' },
]

describe('flowForFile：单文件与批量共用的分流', () => {
  it('用户显式选的流仍匹配该文件时优先', () => {
    expect(flowForFile('合同.pdf', mixedRoutes, 'flow.translate.pdf')).toBe('flow.translate.pdf')
    expect(flowForFile('说明.docx', mixedRoutes, 'flow.translate.docx')).toBe('flow.translate.docx')
  })

  it('显式选的流不匹配（如批量里换成了另一种文件）则回落第一条匹配', () => {
    expect(flowForFile('说明.docx', mixedRoutes, 'flow.translate.pdf.layout')).toBe('flow.translate.docx')
  })

  it('批量清单混合类型各自分流；无匹配返回 undefined', () => {
    expect(['合同.pdf', '说明.docx', '扫描件.pdf'].map((n) => flowForFile(n, mixedRoutes, 'flow.translate.pdf.layout')))
      .toEqual(['flow.translate.pdf.layout', 'flow.translate.docx', 'flow.translate.pdf.layout'])
    expect(flowForFile('照片.png', mixedRoutes)).toBeUndefined()
    expect(flowForFile(undefined, mixedRoutes)).toBeUndefined()
  })
})

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

describe('paramDefault / default_by_flow', () => {
  const mode: ParamField = {
    name: 'mode', label: 'M', type: 'select', default: 'overlay',
    default_by_flow: { 'flow.docx': 'bilingual' },
    when_flow: ['flow.pdf', 'flow.docx'],
  }
  it('按流覆盖优先于 default', () => {
    expect(paramDefault(mode, 'flow.docx')).toBe('bilingual')
    expect(paramDefault(mode, 'flow.pdf')).toBe('overlay')
  })
  it('未覆盖 / 无流 → 回落声明 default', () => {
    expect(paramDefault(mode, 'flow.other')).toBe('overlay')
    expect(paramDefault(mode, undefined)).toBe('overlay')
    expect(paramDefault({ name: 'x', label: 'X' }, 'flow.docx')).toBe('')
  })
  it('defaultParams 逐流取默认', () => {
    expect(defaultParams([mode], 'flow.docx')).toEqual({ mode: 'bilingual' })
    expect(defaultParams([mode], 'flow.pdf')).toEqual({ mode: 'overlay' })
  })
})

describe('routeForProbe / imagePageLimit（系统探测选流）', () => {
  const pdfRoutes: Route[] = [
    { ext: ['.pdf'], flow: 'flow.translate.pdf.layout', label: '文字版（版式翻译）', for: 'text' },
    { ext: ['.pdf'], flow: 'flow.translate.pdf.image', label: '扫描件（图片翻译）', for: 'scanned' },
    { ext: ['.docx'], flow: 'flow.translate.docx', label: 'Word' },
  ]
  it('扫描件 → 图片翻译流', () => {
    expect(routeForProbe('a.pdf', pdfRoutes, { kind: 'pdf', has_text_layer: false, pages: 3 }))
      .toBe('flow.translate.pdf.image')
  })
  it('有文字层 → 文字版流', () => {
    expect(routeForProbe('a.pdf', pdfRoutes, { kind: 'pdf', has_text_layer: true, pages: 3 }))
      .toBe('flow.translate.pdf.layout')
  })
  it('显式选定（preferred）优先于探测', () => {
    expect(routeForProbe('a.pdf', pdfRoutes, { kind: 'pdf', has_text_layer: false }, 'flow.translate.pdf.layout'))
      .toBe('flow.translate.pdf.layout')
  })
  it('非 PDF / 探测为空 / 无 for 标记 一律回落按扩展名分流', () => {
    expect(routeForProbe('a.docx', pdfRoutes, { kind: 'docx' })).toBe('flow.translate.docx')
    expect(routeForProbe('a.pdf', pdfRoutes, undefined)).toBe('flow.translate.pdf.layout')
    expect(routeForProbe('a.pdf', [{ ext: ['.pdf'], flow: 'only' }], { kind: 'pdf', has_text_layer: false }))
      .toBe('only')
  })
  it('imagePageLimit 取探测端点回传的页数上限', () => {
    expect(imagePageLimit({ kind: 'pdf', image_max_pages: 500 })).toBe(500)
    expect(imagePageLimit({ kind: 'pdf', image_max_pages: null })).toBeUndefined()
    expect(imagePageLimit(undefined)).toBeUndefined()
  })
})


describe('matchUnsupported / supportedExtensions', () => {
  const rules: UnsupportedRule[] = [{ ext: ['.doc'], message: '请另存为 .docx' }]
  it('命中后缀返回提示（大小写/路径不敏感）', () => {
    expect(matchUnsupported('a/b/合同.DOC', rules)).toBe('请另存为 .docx')
    expect(matchUnsupported('a.docx', rules)).toBeUndefined()
    expect(matchUnsupported(undefined, rules)).toBeUndefined()
  })
  it('受支持后缀去重且保序', () => {
    expect(supportedExtensions(routes)).toEqual(['.pdf', '.txt', '.md'])
    expect(supportedExtensions([])).toEqual([])
  })
})
