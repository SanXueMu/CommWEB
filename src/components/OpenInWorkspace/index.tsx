/** 「在工作区打开」入口按钮：打开（或追加）一个工作区标签页。 */

import { FolderOpenOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceSelector } from '@/workspace/store'
import { useActivePid } from '@/transfer/context'
import { viewPathByType } from '@/transfer/siteManifest'
import { useSiteCatalog } from '@/config/useSiteCatalog'

export function OpenInWorkspace({ kind, refId, title, providerId, size = 'small' }: {
  kind: 'tool' | 'flow'
  refId: string
  title: string
  providerId?: string
  size?: 'small' | 'middle'
}) {
  const openTab = useWorkspaceSelector((s) => s.openTab)
  const activePid = useActivePid()
  const pid = providerId ?? activePid
  const navigate = useNavigate()
  const { site } = useSiteCatalog()
  return (
    <Tooltip title="在工作区打开（可多开互不干扰）">
      <Button
        size={size}
        icon={<FolderOpenOutlined />}
        onClick={(e) => {
          e.stopPropagation()
          openTab({ kind, refId, title, providerId: pid })
          // 工作区路由由会员 site 声明动态生成，按类型解析实际路径；
          // 未声明 workspace 视图时回 landing（tab 已开，导航不落 wildcard）
          navigate(viewPathByType(site, 'workspace.tabs') ?? site.landing)
        }}
      />
    </Tooltip>
  )
}
