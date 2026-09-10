/** design tokens：亮 / 暗 / 品牌三预设。品牌 = 公司深蓝 #202753 + 青绿 #3bb093。 */

import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export type ThemeName = 'light' | 'dark' | 'brand'

/** 状态色板——组级基色（组语义由 CommAND /api/meta/statuses 下发）+ 值级覆盖（审美留前端）。 */
export const STATUS_GROUP_COLORS: Record<string, string> = {
  active: '#5B8DEF',
  succeeded: '#0F6E56',
  failed: '#D85A30',
  cancelled: '#8c8c8c',
}

/** 值级覆盖：同组内需特别区分的状态（如 failed_review 待复核紫）。 */
export const STATUS_COLOR_OVERRIDES: Record<string, string> = {
  failed_review: '#AFA9EC',
  running: '#D85A30',
  queued: '#5B8DEF',
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
