/** 会员注册表：登记/查询/删除 + 出站基址解析 + 探测。localStorage 持久化。 */

import { DEFAULT_PROVIDER, FULL_CAPABILITIES } from './protocol'
import type { ProviderCapabilities, ProviderDescriptor } from './protocol'

const STORAGE_KEY = 'commweb.providers.v1'
const ACTIVE_KEY = 'commweb.providers.active'

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
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY)
  },

  activeId(): string {
    return localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_PROVIDER.id
  },

  setActiveId(id: string) {
    localStorage.setItem(ACTIVE_KEY, id)
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
