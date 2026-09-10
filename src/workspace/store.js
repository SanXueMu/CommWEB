import { jsx as _jsx } from "react/jsx-runtime";
/** 工作区会话状态：浏览器式多标签（同一工具/流可多开，run/handle 各自独立）。
 *  localStorage 持久化——刷新/重开浏览器找回现场。 */
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
const STORAGE_KEY = 'commweb.workspace.v1';
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.tabs))
                return parsed;
        }
    }
    catch {
        /* 损坏则回退空态 */
    }
    return { tabs: [], activeKey: '' };
}
function reducer(state, action) {
    switch (action.type) {
        case 'open':
            return { tabs: [...state.tabs, action.tab], activeKey: action.tab.key };
        case 'close': {
            const tabs = state.tabs.filter((t) => t.key !== action.key);
            const activeKey = state.activeKey === action.key ? (tabs.at(-1)?.key ?? '') : state.activeKey;
            return { tabs, activeKey };
        }
        case 'update':
            return {
                ...state,
                tabs: state.tabs.map((t) => (t.key === action.key ? { ...t, ...action.patch } : t)),
            };
        case 'activate':
            return { ...state, activeKey: action.key };
    }
}
const WorkspaceContext = createContext(null);
export function WorkspaceProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, undefined, load);
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, [state]);
    const api = useMemo(() => ({
        ...state,
        openTab: (tab) => {
            const key = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
            dispatch({ type: 'open', tab: { ...tab, key } });
            return key;
        },
        closeTab: (key) => dispatch({ type: 'close', key }),
        updateTab: (key, patch) => dispatch({ type: 'update', key, patch }),
        setActive: (key) => dispatch({ type: 'activate', key }),
    }), [state]);
    return _jsx(WorkspaceContext.Provider, { value: api, children: children });
}
export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx)
        throw new Error('useWorkspace 必须在 WorkspaceProvider 内使用');
    return ctx;
}
/** 浅取单值的便捷 hook（避免无关渲染）。 */
export function useWorkspaceSelector(selector) {
    const ctx = useContext(WorkspaceContext);
    if (!ctx)
        throw new Error('useWorkspace 必须在 WorkspaceProvider 内使用');
    return selector(ctx);
}
