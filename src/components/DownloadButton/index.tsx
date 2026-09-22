/** DownloadButton：产物下载（GET /api/files/download，受控限 DATA_DIR 内）。 */

import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'
import { Button, Tooltip } from '@/ui'

export function DownloadButton({ path, label, providerId, disabled }: {
  path: string
  label?: string
  providerId?: string
  /** AF4：产物已被删除时禁用下载 */
  disabled?: boolean
}) {
  const pid = providerId ?? useActivePid()
  const downloadUrl = apiFor(pid).downloadUrl(path)
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button
          size="sm"
          variant="outline"
          isDisabled={disabled}
          onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
        >
          {label ?? '下载'}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{disabled ? '产物文件已删除' : path}</Tooltip.Content>
    </Tooltip>
  )
}
