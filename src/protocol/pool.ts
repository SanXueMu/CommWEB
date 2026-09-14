/**
 * 有界并发执行（纯逻辑，脱 UI 可测）。
 *
 * 批量入队/批量删除都要削峰：入队并发过高会撞翻译模型的 RPM 限速，
 * 删除并发过高会让后端的「中止在跑任务」互相挤压。worker 内部自行 catch，
 * 让 runPool 只负责「同时最多几路」。
 */
export async function runPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  if (!items.length) return results
  let cursor = 0
  const lanes = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length))
  const lane = async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: lanes }, () => lane()))
  return results
}
