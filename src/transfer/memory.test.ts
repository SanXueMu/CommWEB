import { describe, expect, it } from 'vitest'
import { TranslationMemory, contentHash } from './memory'

describe('transfer memory（记忆偏好）', () => {
  it('contentHash 键序无关：同内容（键序不同）同键，异内容异键', () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })

  it('remember 命中不重算，变更精准失效', () => {
    const mem = new TranslationMemory<number>('t')
    let computed = 0
    const compute = () => { computed += 1; return computed }
    expect(mem.remember('k', compute)).toBe(1)
    expect(mem.remember('k', compute)).toBe(1)
    expect(computed).toBe(1)
    expect(mem.remember('k2', compute)).toBe(2)
    expect(computed).toBe(2)
  })

  it('LRU 驱逐：超容量淘汰最旧', () => {
    const mem = new TranslationMemory<number>('lru', 2)
    mem.set('a', 1)
    mem.set('b', 2)
    mem.set('c', 3)
    expect(mem.get('a')).toBeUndefined()
    expect(mem.get('c')).toBe(3)
    expect(mem.stats().size).toBe(2)
  })
})
