import { describe, expect, it } from 'vitest'
import { normalizeTags } from './index'

describe('normalizeTags', () => {
  it('trim 去空 + 大小写变体聚合保首个 + 拼音排序', () => {
    const result = normalizeTags([' 合同 ', 'OCR', 'ocr', '', '发票', '审计'])
    expect(result).toHaveLength(4)
    expect(result).toContain('OCR')
    expect(result.indexOf('发票')).toBeLessThan(result.indexOf('合同'))
    expect(result.indexOf('合同')).toBeLessThan(result.indexOf('审计'))
  })

  it('空入参 → 空数组', () => {
    expect(normalizeTags([])).toEqual([])
  })
})
