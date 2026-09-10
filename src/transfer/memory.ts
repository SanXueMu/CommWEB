/** 记忆（翻译产物缓存）：schema-hash → resolver 表单模型。
 *  hash 不变 → 命中（0ms 推导）；hash 变 → 精准失效重推导（热部署）。
 *  与 react-query 分层：react-query 管「数据」，memory 管「派生物」。 */

interface MemoryEntry<V> {
  value: V
  createdAt: number
  hits: number
}

const MAX_ENTRIES = 100

/** 键序无关序列化：对象键递归排序，内容等价则文本等价。 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
}

/** 内容哈希（djb2 变体）：键序无关、稳定、同步。 */
export function contentHash(input: unknown): string {
  const text = stableStringify(input)
  let h = 5381
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

export class TranslationMemory<V> {
  private store = new Map<string, MemoryEntry<V>>()

  constructor(private readonly label: string, private readonly max = MAX_ENTRIES) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key)
    if (entry) {
      entry.hits += 1
      if (import.meta.env.DEV) {
        console.debug(`[transfer.memory] 命中 ${this.label}（第 ${entry.hits} 次）`)
      }
      return entry.value
    }
    return undefined
  }

  set(key: string, value: V): V {
    if (this.store.size >= this.max && !this.store.has(key)) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, { value, createdAt: Date.now(), hits: 0 })
    return value
  }

  /** 取或算：缓存的正门。 */
  remember(key: string, compute: () => V): V {
    return this.get(key) ?? this.set(key, compute())
  }

  stats(): { size: number; keys: string[] } {
    return { size: this.store.size, keys: [...this.store.keys()] }
  }
}
