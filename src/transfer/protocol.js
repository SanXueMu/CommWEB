/** Transfer 协议契约：会员登记信息 + 标准模型溯源。 */
/** 内置默认会员：指向现有 CommAND 代理，永远存在、不可删除。 */
export const DEFAULT_PROVIDER = {
    id: 'default',
    name: 'CommAND',
    baseUrl: '/api',
    protocolVersion: '1',
    capabilities: { has_pipelines: true, has_files: true, has_runs: true, has_sse: true, has_statuses: true },
    createdAt: '',
    status: 'unknown',
};
export const FULL_CAPABILITIES = {
    has_pipelines: true,
    has_files: true,
    has_runs: true,
    has_sse: true,
    has_statuses: true,
};
