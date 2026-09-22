/** design tokens：亮 / 暗 / 品牌三预设。品牌 = 公司深蓝 #202753 + 青绿 #3bb093。 */

export type ThemeName = 'light' | 'dark' | 'brand'

/** 合法主题名（主题偏好持久化校验用）。 */
export const THEME_NAMES: ThemeName[] = ['light', 'dark', 'brand']

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

/** 品牌墨色（logo / 激活态 / 强调描边）：暗色下换亮化蓝，保证深底可读。 */
export const BRAND_INK: Record<ThemeName, string> = {
  light: '#202753',
  dark: '#9db2e8',
  brand: '#202753',
}

/** 品牌青绿（徽标/流程类型）：三主题通用，深底浅底均可读。 */
export const BRAND_TEAL = '#3bb093'
