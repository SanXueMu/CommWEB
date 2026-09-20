/** DownloadButton：产物下载（GET /api/files/download，受控限 DATA_DIR 内）。 */

import { DownloadOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'

export function DownloadButton({ path, label, providerId, disabled }: {
  path: string
  label?: string
  providerId?: string
  /** AF4：产物已被删除时禁用下载 */
  disabled?: boolean
}) {
  const pid = providerId ?? useActivePid()
  return (
    <Tooltip title={disabled ? '产物文件已删除' : path}>
      <Button
        size="small"
        type="primary"
        ghost
        icon={<DownloadOutlined />}
        href={disabled ? undefined : apiFor(pid).downloadUrl(path)}
        target="_blank"
        disabled={disabled}
      >
        {label ?? '下载'}
      </Button>
    </Tooltip>
  )
}
