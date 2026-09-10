/** Transfer 协议契约：会员登记信息 + 标准模型溯源。 */

export interface ProviderCapabilities {
  has_pipelines: boolean
  has_files: boolean
  has_runs: boolean
  has_sse: boolean
  has_statuses: boolean
}

export interface ProviderDescriptor {
  id: string
  name: string
  /** API 根（同源前缀，规避 CORS）。内置默认会员为 '/api'（零配置兼容现状）。 */
  baseUrl: string
  protocolVersion: string
  capabilities: ProviderCapabilities
  createdAt: string
  status: 'online' | 'offline' | 'degraded' | 'unknown'
}

/** 内置默认会员：指向现有 CommAND 代理，永远存在、不可删除。 */
export const DEFAULT_PROVIDER: ProviderDescriptor = {
  id: 'default',
  name: 'CommAND',
  baseUrl: '/api',
  protocolVersion: '1',
  capabilities: { has_pipelines: true, has_files: true, has_runs: true, has_sse: true, has_statuses: true },
  createdAt: '',
  status: 'unknown',
}

export const FULL_CAPABILITIES: ProviderCapabilities = {
  has_pipelines: true,
  has_files: true,
  has_runs: true,
  has_sse: true,
  has_statuses: true,
}
