/** 主题偏好持久化（localStorage）——本项目唯一的 UI 态 store。 */
import { useCallback, useState } from 'react';
import { THEMES } from './tokens';
const KEY = 'commweb.theme';
function load() {
    const saved = localStorage.getItem(KEY);
    return saved && saved in THEMES ? saved : 'light';
}
export function useTheme() {
    const [name, setName] = useState(load);
    const setTheme = useCallback((next) => {
        localStorage.setItem(KEY, next);
        setName(next);
    }, []);
    return { name, setTheme, config: THEMES[name] };
}
