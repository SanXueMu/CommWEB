/** 主题偏好持久化（localStorage）——本项目唯一的 UI 态 store。 */

import { useCallback, useState } from 'react'
import { THEMES, type ThemeName } from './tokens'

const KEY = 'commweb.theme'

function load(): ThemeName {
  const saved = localStorage.getItem(KEY)
  return saved && saved in THEMES ? (saved as ThemeName) : 'light'
}

export function useTheme() {
  const [name, setName] = useState<ThemeName>(load)
  const setTheme = useCallback((next: ThemeName) => {
    localStorage.setItem(KEY, next)
    setName(next)
  }, [])
  return { name, setTheme, config: THEMES[name] }
}
