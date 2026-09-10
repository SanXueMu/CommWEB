/** 聚合查询：全部在线会员的实体合并（T3 聚合模式）。
 *  单会员失败不炸页——离线会员标 degraded 占位（方案 §九 降级策略）。 */
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiFor } from '@/api/client';
import { useProviders } from '@/transfer/context';
export function useAggregatedTools() {
    const { providers } = useProviders();
    const queries = useQueries({
        queries: providers.map((p) => ({
            queryKey: ['provider', p.id, 'tools'],
            queryFn: () => apiFor(p.id).listTools(),
            retry: false,
        })),
    });
    return useMemo(() => {
        const tools = queries.flatMap((q) => q.data?.tools ?? []);
        const failedPids = providers.filter((_, i) => queries[i].isError).map((p) => p.id);
        return { tools, loading: queries.some((q) => q.isLoading), failedPids };
    }, [queries, providers]);
}
export function useAggregatedPipelines() {
    const { providers } = useProviders();
    const queries = useQueries({
        queries: providers.map((p) => ({
            queryKey: ['provider', p.id, 'pipelines'],
            queryFn: () => apiFor(p.id).listPipelines(),
            retry: false,
        })),
    });
    return useMemo(() => {
        const pipelines = queries.flatMap((q) => q.data?.pipelines ?? []);
        const failedPids = providers.filter((_, i) => queries[i].isError).map((p) => p.id);
        return { pipelines, loading: queries.some((q) => q.isLoading), failedPids };
    }, [queries, providers]);
}
