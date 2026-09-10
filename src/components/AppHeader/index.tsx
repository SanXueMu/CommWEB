/** 页眉：无色背景 + 左侧 logo（预留 CommAND 首页链接）+ 右上角状态栏（显示器图标 hover 出主题下拉）。 */

import { AppstoreOutlined, DesktopOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, Checkbox, Divider, Popover, Space, Typography } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import { ProviderMenu } from '@/components/ProviderMenu'
import { useTheme } from '@/theme/store'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { useProviders } from '@/transfer/context'
import { updateViewPrefs } from '@/transfer/preferences'
import { resolveIcon } from '@/protocol/views'
import type { ThemeName } from '@/theme/tokens'

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
  { value: 'brand', label: '品牌' },
]

export function AppHeader() {
  const { name, setTheme } = useTheme()
  const location = useLocation()
  const { site, refreshPrefs } = useSiteCatalog()
  const { activeId } = useProviders()
  const pid = activeId ?? 'default'
  const NAV = site.navItems.map((n) => ({ path: n.path, label: n.title, icon: n.icon, viewId: n.viewId }))

  const toggleHidden = (viewId: string, visible: boolean) => {
    const declaredIds = site.declared.map((d) => d.id)
    const existing = declaredIds.filter((id) => !NAV.some((n) => n.viewId === id))
    updateViewPrefs(pid, { hidden: visible ? existing.filter((id) => id !== viewId) : [...existing, viewId] })
    refreshPrefs()
  }

  const moveView = (viewId: string, dir: -1 | 1) => {
    const order = [...site.navItems.map((n) => n.viewId)]
    const i = order.indexOf(viewId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    updateViewPrefs(pid, { viewOrder: order })
    refreshPrefs()
  }

  const resetPrefs = () => {
    updateViewPrefs(pid, { hidden: [], viewOrder: [] })
    refreshPrefs()
  }

  const manageMenu = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4, minWidth: 200 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, padding: '2px 8px' }}>管理视图</Typography.Text>
      {site.declared.map((decl) => {
        const visible = NAV.some((n) => n.viewId === decl.id)
        return (
          <div key={decl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px' }}>
            <Checkbox checked={visible} onChange={(e) => toggleHidden(decl.id, e.target.checked)}>
              <span style={{ fontSize: 13 }}>{decl.title}</span>
            </Checkbox>
            {visible && (
              <Space size={0}>
                <Button type="text" size="small" onClick={() => moveView(decl.id, -1)}>↑</Button>
                <Button type="text" size="small" onClick={() => moveView(decl.id, 1)}>↓</Button>
              </Space>
            )}
          </div>
        )
      })}
      <Divider style={{ margin: '4px 0' }} />
      <Typography.Link style={{ fontSize: 12, padding: '2px 8px' }} onClick={resetPrefs}>恢复默认</Typography.Link>
    </div>
  )

  const themePanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, padding: '2px 8px' }}>
        主题
      </Typography.Text>
      {THEME_OPTIONS.map((option) => (
        <Typography.Link
          key={option.value}
          strong={option.value === name}
          style={{ padding: '4px 8px', borderRadius: 4, color: option.value === name ? '#202753' : undefined }}
          onClick={() => setTheme(option.value)}
        >
          {option.label}
        </Typography.Link>
      ))}
    </div>
  )

  return (
    <header
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        background: 'transparent',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(6px)',
      }}
    >
      <Space size={8}>
        <AppstoreOutlined style={{ fontSize: 20, color: '#202753' }} />
        <Typography.Text strong style={{ fontSize: 16 }}>
          CommWEB
        </Typography.Text>
      </Space>
      <nav style={{ display: 'flex', gap: 20, flex: 1 }}>
        {NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              color: location.pathname === item.path ? '#202753' : '#8c8c8c',
              fontWeight: location.pathname === item.path ? 600 : 400,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            <span style={{ marginRight: 6 }}>{(() => { const Icon = resolveIcon(item.icon); return <Icon /> })()}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <Popover content={manageMenu} trigger="click" placement="bottomRight">
        <Button type="text" size="small" icon={<SettingOutlined />} title="管理视图" />
      </Popover>
      <Popover trigger="hover" placement="bottomRight" content={themePanel}>
        <DesktopOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
      </Popover>
      <ProviderMenu />
    </header>
  )
}
