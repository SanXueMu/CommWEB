/** DownloadButton：产物下载（GET /api/files/download，受控限 DATA_DIR 内）。 */

import { DownloadOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { apiFor } from '@/api/client'
import { useActivePid } from '@/transfer/context'

export function DownloadButton({ path, label, providerId }: {
  path: string
  label?: string
  providerId?: string
}) {
  const pid = providerId ?? useActivePid()
  return (
    <Tooltip title={path}>
      <Button
        size="small"
        type="primary"
        ghost
        icon={<DownloadOutlined />}
        href={apiFor(pid).downloadUrl(path)}
        target="_blank"
      >
        {label ?? '下载'}
      </Button>
    </Tooltip>
  )
}
