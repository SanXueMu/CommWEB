import { describe, expect, it } from 'vitest'
import { POLL_FAST_MS, POLL_IDLE_MS, pollIntervalFor } from './polling'

describe('pollIntervalFor', () => {
  it('有运行中/排队 → 快轮询', () => {
    expect(pollIntervalFor(['succeeded', 'running'])).toBe(POLL_FAST_MS)
    expect(pollIntervalFor(['queued'])).toBe(POLL_FAST_MS)
  })

  it('全部终态（含 paused）→ 慢轮询', () => {
    expect(pollIntervalFor(['succeeded', 'failed'])).toBe(POLL_IDLE_MS)
    expect(pollIntervalFor(['paused', 'cancelled', 'interrupted'])).toBe(POLL_IDLE_MS)
  })

  it('空列表 → 慢轮询（没有任务就没必要快刷）', () => {
    expect(pollIntervalFor([])).toBe(POLL_IDLE_MS)
  })
})
