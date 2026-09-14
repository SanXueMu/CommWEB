/**
 * 轮询节奏（纯常量，协议级）：任务列表/详情的刷新频率。
 *
 * 载荷瘦身后（列表不再下发整段 input/output），快轮询成本很低；
 * 「有任务在跑」才快轮询，全部终态就退到慢轮询，兼顾体验与服务端负载。
 */
export const POLL_FAST_MS = 1500
export const POLL_IDLE_MS = 5000

/** 终态：不再变化的状态（无需继续轮询）。 */
export const TERMINAL_STATUSES = new Set([
  'succeeded', 'failed', 'failed_review', 'cancelled', 'interrupted',
])

/** 运行中（含排队）：决定是否走快轮询。paused 等人工介入，不算运行中。 */
export const ACTIVE_STATUSES = new Set(['queued', 'running'])

/** 列表轮询策略：任一条目运行中 → 快；否则 → 慢（终态不再变化，慢轮询足够）。 */
export function pollIntervalFor(statuses: readonly string[]): number {
  return statuses.some((s) => ACTIVE_STATUSES.has(s)) ? POLL_FAST_MS : POLL_IDLE_MS
}
