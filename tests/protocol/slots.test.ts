/** v3 槽位层纯函数测试：props 白名单 / data 白名单 / 模板解析降级 / slots 提取。 */
import { describe, expect, it } from 'vitest'
import { resolveSlot, slotsOf, validateDataDecl, validateSlotProps, type SlotDecl } from '@/protocol/slots'

describe('validateSlotProps 深度白名单', () => {
  it('纯数据放行（含嵌套对象与数组）', () => {
    expect(validateSlotProps({ a: 1, b: 'x', c: [true, null, { d: [{ e: '深' }] }] })).toBeNull()
  })
  it('函数引用拒绝', () => {
    expect(validateSlotProps({ onClick: () => {} })).toMatch(/函数/)
  })
  it('类实例/组件引用（非平面对象）拒绝', () => {
    expect(validateSlotProps({ node: new Date() })).toMatch(/非平面对象/)
  })
  it('嵌套过深拒绝', () => {
    let deep: unknown = 'x'
    for (let i = 0; i < 8; i++) deep = { w: deep }
    expect(validateSlotProps(deep)).toMatch(/嵌套过深/)
  })
})

describe('validateDataDecl 声明式取数白名单', () => {
  it('内部路径 GET 放行', () => {
    expect(validateDataDecl({ path: '/ocr/templates', params: { enabled: true, limit: 20 } })).toBeNull()
  })
  it('外部 URL / 协议头拒绝', () => {
    expect(validateDataDecl({ path: 'https://evil.example/x' })).toMatch(/开头|协议头/)
  })
  it('非 GET 拒绝（写路径不开放声明式）', () => {
    expect(validateDataDecl({ path: '/x', method: 'POST' as never })).toMatch(/GET/)
  })
  it('路径穿越拒绝', () => {
    expect(validateDataDecl({ path: '/a/../b' })).toMatch(/穿越/)
    expect(validateDataDecl({ path: '//evil' })).toMatch(/穿越/)
  })
  it('params 非基本类型拒绝', () => {
    expect(validateDataDecl({ path: '/x', params: { q: {} as never } })).toMatch(/基本类型/)
  })
})

describe('resolveSlot 模板解析', () => {
  it('已知模板 + 合法声明 = ok', () => {
    const decl: SlotDecl = { template: 'list.panel', props: { layout: 'card', renderer: 'x' } }
    expect(resolveSlot(decl)).toEqual({ status: 'ok', decl })
  })
  it('未知模板降级', () => {
    expect(resolveSlot({ template: 'evil.custom' })).toEqual({ status: 'unknown', reason: '未知模板 evil.custom' })
  })
  it('props 违规 = invalid', () => {
    expect(resolveSlot({ template: 'list.panel', props: { fn: () => {} } }).status).toBe('invalid')
  })
  it('data 违规 = invalid', () => {
    expect(resolveSlot({ template: 'list.panel', data: { path: 'http://x' } }).status).toBe('invalid')
  })
})

describe('slotsOf 视图 props 提取', () => {
  it('v2 视图无 slots 返回空表（兼容）', () => {
    expect(slotsOf({ defaultLayout: 'card' })).toEqual({})
    expect(slotsOf(null)).toEqual({})
  })
  it('提取合法槽位、忽略残缺项', () => {
    const slots = slotsOf({
      slots: {
        list: { template: 'list.panel' },
        broken: { noTemplate: true },
        junk: 'string',
      },
    })
    expect(Object.keys(slots)).toEqual(['list'])
  })
})
