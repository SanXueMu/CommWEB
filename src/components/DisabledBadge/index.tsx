import { PORTAL } from '@/config/portal'

/** 停用徽章（D1 工具置灰配套）：统一渲染「已停用」。 */
export function DisabledBadge() {
  return (
    <span style={{ background: '#fff1f0', color: '#cf1322', borderRadius: 4, padding: '0 6px', fontSize: 11, lineHeight: '18px', flexShrink: 0 }}>
      {PORTAL.toolDisabled}
    </span>
  )
}
