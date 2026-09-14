import { describe, expect, it } from 'vitest'
import { runPool } from './pool'

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('runPool', () => {
  it('结果按入参顺序对齐（并发不改变结果位置）', async () => {
    const out = await runPool([3, 1, 2], async (n) => {
      await tick()
      return n * 10
    }, 2)
    expect(out).toEqual([30, 10, 20])
  })

  it('同时在跑的 worker 不超过并发上限', async () => {
    let active = 0
    let peak = 0
    await runPool(Array.from({ length: 9 }, (_, i) => i), async () => {
      active += 1
      peak = Math.max(peak, active)
      await tick()
      active -= 1
    }, 3)
    expect(peak).toBe(3)
  })

  it('并发数超过条数 / 非法值时退化安全', async () => {
    expect(await runPool([1], async (n) => n, 8)).toEqual([1])
    expect(await runPool([1, 2], async (n) => n, 0)).toEqual([1, 2])
    expect(await runPool([], async (n) => n, 2)).toEqual([])
  })

  it('worker 抛错时整体拒绝（调用方需自行 catch）', async () => {
    await expect(runPool([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('boom')
      return n
    }, 2)).rejects.toThrow('boom')
  })
})
