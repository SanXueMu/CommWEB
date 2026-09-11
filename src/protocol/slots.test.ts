import { describe, expect, it } from 'vitest'
import { siblingRenderers } from '@/protocol/slots'

describe('siblingRenderers（列表形态成对推导）', () => {
  it('card 名推导出 row 兄弟', () => {
    expect(siblingRenderers('tool-card')).toEqual({ card: 'tool-card', row: 'tool-row' })
  })

  it('row 名推导出 card 兄弟', () => {
    expect(siblingRenderers('task-row')).toEqual({ card: 'task-card', row: 'task-row' })
  })

  it('无后缀名两形态同名（兼容自由命名）', () => {
    expect(siblingRenderers('mixed')).toEqual({ card: 'mixed', row: 'mixed' })
  })

  it('空名返回空表', () => {
    expect(siblingRenderers(undefined)).toEqual({})
  })
})
