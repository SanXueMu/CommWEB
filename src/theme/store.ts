/** 主题偏好持久化（localStorage）——本项目唯一的 UI 态 store。
 *
 *  模块级单例 + useSyncExternalStore：App（ConfigProvider.theme）与 AppHeader（切换入口）
 *  共享同一份状态。此前各组件各自 useState，点主题只改了切换器那份 → 视觉无反应。
 *  同时把主题名写到 <html data-theme>，供 index.css 中的暗色规则与原生控件取用。
 */

import { useCallback, useSyncExternalStore } from 'react'
import { THEMES, type ThemeName } from './tokens'

const KEY = 'commweb.theme'

function load(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY)
    return saved && saved in THEMES ? (saved as ThemeName) : 'light'
  } catch {
    return 'light'
  }
}

let current: ThemeName = load()
const listeners = new Set<() => void>()

function apply(name: ThemeName, persist = true) {
  current = name
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = name
  if (persist) {
    try {
      localStorage.setItem(KEY, name)
    } catch {
      /* 隐私模式/配额满：仅本次会话生效 */
    }
  }
  listeners.forEach((listener) => listener())
}

// 模块加载即落地一次：首帧渲染前 <html data-theme> 就是对的，避免暗色闪白
apply(current, false)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (typeof window !== 'undefined') {
  // 多标签页同步：另一个标签改了主题，本标签跟随
  window.addEventListener('storage', (event) => {
    if (event.key === KEY && event.newValue && event.newValue in THEMES && event.newValue !== current) {
      apply(event.newValue as ThemeName, false)
    }
  })
}

export function useTheme() {
  const name = useSyncExternalStore(subscribe, () => current, () => current)
  const setTheme = useCallback((next: ThemeName) => apply(next), [])
  return { name, setTheme, config: THEMES[name] }
}
