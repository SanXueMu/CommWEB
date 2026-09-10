import { describe, expect, it } from 'vitest'
import { extractFlowFields, extractInputKeys } from './flow'

const steps = [
  { tool: 't1', input: { a: '{{input.x}}', b: '{{ input.y }} {{input.x}}' } },
  { tool: 't2', input: { c: '{{input.z}}' } },
]

describe('extractInputKeys', () => {
  it('按出现顺序去重提取', () => {
    expect(extractInputKeys(steps)).toEqual(['x', 'y', 'z'])
  })
})

describe('extractFlowFields', () => {
  const schemas = {
    t1: { properties: { x: { type: 'array', title: '清单' }, y: { type: 'string' } } },
    t2: { properties: { z: { type: 'string', format: 'file', title: '文档路径' } } },
  }

  it('array→tags / file特征→file / 其余→text，title 透传', () => {
    const fields = extractFlowFields(steps, schemas)
    expect(fields.find((f) => f.key === 'x')).toMatchObject({ widget: 'tags', title: '清单' })
    expect(fields.find((f) => f.key === 'z')).toMatchObject({ widget: 'file', title: '文档路径' })
    expect(fields.find((f) => f.key === 'y')?.widget).toBe('text')
    expect(fields.find((f) => f.key === 'y')?.title).toBeUndefined()
  })
})
