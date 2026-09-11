/** 渲染器纯函数测试（协议层）：主表提取排除 splits / 拆分表 title 回落 / 形态判定。 */

import { describe, expect, it } from 'vitest'
import { detectRenderer, extractSplits, extractTable } from '@/protocol/renderers'

describe('extractTable', () => {
  it('rows 为空时不被 splits 顶替为主表（排除键生效）', () => {
    const out = { columns: [], rows: [], splits: [{ key: '甲', rows: [{ x: 1 }] }] }
    expect(extractTable(out, ['splits'])).toBeNull()
  })

  it('默认行为不变：不传排除键时仍取首个对象数组（向后兼容）', () => {
    expect(extractTable({ rows: [], splits: [{ key: '甲' }] })?.columns).toEqual(['key'])
  })

  it('顶层对象数组 / 对象内首个对象数组都能提取', () => {
    expect(extractTable([{ a: 1 }])?.rows).toEqual([{ a: 1 }])
    expect(extractTable({ meta: 'x', rows: [{ a: 1 }] })?.columns).toEqual(['a'])
  })
})

describe('extractSplits', () => {
  it('title 缺省时回落引擎的 key 分组名', () => {
    expect(extractSplits({ splits: [{ key: '合同A', rows: [{}] }] })[0].title).toBe('合同A')
  })

  it('非数组 / 无 rows 的项一律丢弃', () => {
    expect(extractSplits({ splits: 'x' })).toEqual([])
    expect(extractSplits({ splits: [{ key: 'a' }] })).toEqual([])
    expect(extractSplits({ rows: [{ a: 1 }] })).toEqual([])
  })

  it('保留 columns 与 rows', () => {
    const out = extractSplits({ splits: [{ key: '决算表', columns: ['甲'], rows: [{ 甲: 1 }] }] })
    expect(out).toHaveLength(1)
    expect(out[0].columns).toEqual(['甲'])
    expect(out[0].rows).toEqual([{ 甲: 1 }])
  })
})

describe('detectRenderer', () => {
  it('主表为空但 splits 非空时仍判 table（否则会退化成一坨 JSON）', () => {
    expect(detectRenderer({ rows: [], splits: [{ key: '甲', rows: [{ x: 1 }] }] })).toBe('table')
  })
})
