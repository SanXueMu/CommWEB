/** 站点目录 hook（蓝图 03 §4.3）：会员声明 + 能力 + 偏好 → 装配模型。
 *  声明拉取失败回落内置默认视图集（v1 兼容）；偏好变更经 version 信号重算。 */
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_SITE, fetchSiteManifest, parseSite } from '@/transfer/siteManifest';
import { useProviders } from '@/transfer/context';
export function useSiteCatalog() {
    const { active, activeId } = useProviders();
    const [prefsVersion, setPrefsVersion] = useState(0);
    const pid = activeId ?? 'default';
    const { data: manifest, isLoading } = useQuery({
        queryKey: ['provider', pid, 'site'],
        queryFn: () => fetchSiteManifest(pid),
        staleTime: 60_000,
        retry: false,
        enabled: Boolean(activeId),
    });
    const caps = active?.capabilities ?? { has_pipelines: true, has_files: false, has_runs: true, has_statuses: true };
    const site = useMemo(() => parseSite(manifest ?? DEFAULT_SITE, caps, pid), 
    // prefsVersion 变化强制重解析（parseSite 内读 localStorage 偏好）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest, pid, prefsVersion, caps]);
    const refreshPrefs = useCallback(() => setPrefsVersion((v) => v + 1), []);
    return { site, isSiteLoading: isLoading, refreshPrefs };
}
