/** design tokens：亮 / 暗 / 品牌三预设。品牌 = 公司深蓝 #202753 + 青绿 #3bb093。 */

import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export type ThemeName = 'light' | 'dark' | 'brand'

/** 任务状态色板——与生命周期图严格一致：queued 蓝 / running 橙 / succeeded 青绿 / 待复核紫 / 其余终态灰。 */
export const STATUS_COLORS: Record<string, string> = {
  queued: '#5B8DEF',
  running: '#D85A30',
  succeeded: '#0F6E56',
  failed_review: '#AFA9EC',
  failed: '#8c8c8c',
  cancelled: '#8c8c8c',
  interrupted: '#8c8c8c',
}

const base: ThemeConfig = {
  token: { borderRadius: 6, fontSize: 14 },
}

export const THEMES: Record<ThemeName, ThemeConfig> = {
  light: { ...base, algorithm: theme.defaultAlgorithm },
  dark: { ...base, algorithm: theme.darkAlgorithm },
  brand: {
    ...base,
    algorithm: theme.defaultAlgorithm,
    token: { ...base.token, colorPrimary: '#3bb093', colorInfo: '#202753' },
  },
}
