import { jsx as _jsx } from "react/jsx-runtime";
/** 会员上下文：当前活跃会员（T1 切换制）+ 登记管理 + 探测状态。 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { REGISTRY_STORAGE_KEY, registry } from './registry';
import { DEFAULT_PROVIDER } from './protocol';
const ProviderContext = createContext(null);
export function TransferProvider({ children }) {
    const [providers, setProviders] = useState(() => registry.list());
    const [activeId, setActive] = useState(() => registry.activeId());
    useEffect(() => {
        registry.setActiveId(activeId);
    }, [activeId]);
    const lastProbeRef = useRef(0);
    const probeAll = useCallback(() => {
        const now = Date.now();
        if (now - lastProbeRef.current < 10_000)
            return; // 探测节流（蓝图05 §七.3）
        lastProbeRef.current = now;
        providers.forEach(async (p) => {
            try {
                await registry.probe(p.id);
            }
            catch {
                /* probe 内部已处理 */
            }
            setProviders(registry.list());
        });
    }, [providers]);
    // 挂载后静默探测一轮（不阻塞首帧）
    useEffect(() => {
        const timer = setTimeout(probeAll, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // 跨页同步（蓝图05 §七.1）：storage 事件仅他页触发——A 登记/删除，B 即时刷新；
    // 被删会员恰为本页激活 → 清激活守卫自动回首页 + 提示。
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key !== REGISTRY_STORAGE_KEY)
                return;
            const next = registry.list();
            setProviders(next);
            const current = registry.activeId();
            if (current && !next.some((p) => p.id === current)) {
                setActive(null);
                window.dispatchEvent(new CustomEvent('commweb:member-removed', { detail: { id: current } }));
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const api = useMemo(() => ({
        providers,
        activeId,
        active: activeId ? providers.find((p) => p.id === activeId) ?? null : null,
        setActiveId: setActive,
        upsert: (provider) => {
            registry.upsert({ ...provider, protocolVersion: '1' });
            setProviders(registry.list());
        },
        remove: (id) => {
            registry.remove(id);
            setProviders(registry.list());
            if (activeId === id) {
                setActive(null);
                window.dispatchEvent(new CustomEvent('commweb:member-removed', { detail: { id } }));
            }
        },
        probe: async (id) => {
            const next = await registry.probe(id);
            setProviders(registry.list());
            return next;
        },
        probeAll,
    }), [providers, activeId, probeAll]);
    return _jsx(ProviderContext.Provider, { value: api, children: children });
}
export function useProviders() {
    const ctx = useContext(ProviderContext);
    if (!ctx)
        throw new Error('useProviders 必须在 TransferProvider 内使用');
    return ctx;
}
/** 当前激活会员 id（未激活为 null；调用方需处理空值或确保在守卫内）。 */
export function useActivePid() {
    const pid = useProviders().activeId;
    return pid ?? DEFAULT_PROVIDER.id;
}
