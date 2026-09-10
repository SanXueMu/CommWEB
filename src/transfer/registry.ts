/** 会员注册表：登记/查询/删除 + 出站基址解析 + 探测。localStorage 持久化。 */

import { DEFAULT_PROVIDER, FULL_CAPABILITIES } from './protocol'
import type { ProviderCapabilities, ProviderDescriptor } from './protocol'

/** registry 全局共享（localStorage）；激活会话标签页隔离（sessionStorage，蓝图05 §二）。 */
export const REGISTRY_STORAGE_KEY = 'commweb.providers.v1'
const STORAGE_KEY = REGISTRY_STORAGE_KEY
const SESSION_KEY = 'commweb.session.active'

/** sessionStorage 不可用时的内存降级（隐私模式，R1）。 */
const memoryActive: { value: string | null } = { value: null }
function sessionGet(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return memoryActive.value
  }
}
function sessionSet(value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(SESSION_KEY)
    else sessionStorage.setItem(SESSION_KEY, value)
  } catch {
    memoryActive.value = value
  }
}

function load(): ProviderDescriptor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const list = JSON.parse(raw) as ProviderDescriptor[]
      if (Array.isArray(list)) return [DEFAULT_PROVIDER, ...list.filter((p) => p.id !== DEFAULT_PROVIDER.id)]
    }
  } catch {
    /* 损坏则回退 */
  }
  return [DEFAULT_PROVIDER]
}

function save(providers: ProviderDescriptor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers.filter((p) => p.id !== DEFAULT_PROVIDER.id)))
}

export const registry = {
  list: load,

  get(id: string): ProviderDescriptor | undefined {
    return load().find((p) => p.id === id)
  },

  /** 出站基址解析：找不到回落默认会员（现状路径）。 */
  baseUrlOf(id: string): string {
    return registry.get(id)?.baseUrl ?? DEFAULT_PROVIDER.baseUrl
  },

  upsert(provider: Omit<ProviderDescriptor, 'createdAt' | 'status' | 'capabilities'> & { capabilities?: ProviderCapabilities }) {
    const providers = load().filter((p) => p.id !== provider.id)
    providers.push({
      ...provider,
      capabilities: provider.capabilities ?? FULL_CAPABILITIES,
      createdAt: new Date().toISOString(),
      status: 'unknown',
    })
    save(providers)
  },

  remove(id: string) {
    if (id === DEFAULT_PROVIDER.id) return
    save(load().filter((p) => p.id !== id))
    if (sessionGet() === id) sessionSet(null)
  },

  /** 激活会员（本标签页）；未选择 = 未激活 = null（无默认兜底，蓝图05）。 */
  activeId(): string | null {
    return sessionGet()
  },

  setActiveId(id: string | null) {
    sessionSet(id)
  },

  /** 握手探测：health → statuses → 能力矩阵。 */
  async probe(id: string): Promise<ProviderDescriptor> {
    const provider = registry.get(id)
    if (!provider) throw new Error(`会员不存在: ${id}`)
    const caps: ProviderCapabilities = { has_pipelines: false, has_files: false, has_runs: false, has_sse: true, has_statuses: false }
    let status: ProviderDescriptor['status'] = 'online'
    try {
      const health = await fetch(`${provider.baseUrl}/health`)
      if (!health.ok) throw new Error(`health ${health.status}`)
      for (const [path, key] of [
        ['/meta/statuses', 'has_statuses'],
        ['/pipelines', 'has_pipelines'],
      ] as const) {
        const res = await fetch(`${provider.baseUrl}${path}`).catch(() => null)
        if (res && res.ok) caps[key] = true
      }
      const files = await fetch(`${provider.baseUrl}/files`, { method: 'OPTIONS' }).catch(() => null)
      caps.has_files = Boolean(files && files.ok)
    } catch {
      status = 'offline'
    }
    const next = { ...provider, capabilities: caps, status }
    const providers = load().map((p) => (p.id === id ? next : p))
    save(providers)
    return next
  },
}
