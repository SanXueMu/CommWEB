/** 状态徽章：value → label + color，目录驱动（CommAND /api/meta/statuses）→ CatalogBadge 底座。 */

import type { CSSProperties } from 'react'
import { CatalogBadge } from '@/components/CatalogBadge'
import { useStatusCatalog } from '@/config/useStatusCatalog'
import { STATUS_GROUP_COLORS, STATUS_COLOR_OVERRIDES } from '@/theme/tokens'

export function StatusBadge({ value, style }: { value: string; style?: CSSProperties }) {
  const { byValue } = useStatusCatalog()
  return (
    <CatalogBadge
      value={value}
      catalog={byValue}
      resolveColor={(v, entry) =>
        STATUS_COLOR_OVERRIDES[v] ?? STATUS_GROUP_COLORS[entry?.group ?? ''] ?? '#8c8c8c'
      }
      style={style}
    />
  )
}
