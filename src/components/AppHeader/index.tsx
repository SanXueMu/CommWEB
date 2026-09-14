/** 页眉：无色背景 + 左侧 logo + 主导航（声明驱动：tab 直连 / menu 出下拉）
 *  + 右上角状态栏（设置下拉：管理视图 + 页眉声明的功能项；主题下拉；会员选择）。 */

import { AppstoreOutlined, CheckOutlined, DesktopOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, Checkbox, Divider, Dropdown, Popover, Space, Typography, theme as antdTheme } from 'antd'
import type { MenuProps } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ProviderMenu } from '@/components/ProviderMenu'
import { useDialog } from '@/components/DialogLayer'
import { useTheme } from '@/theme/store'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { useProviders } from '@/transfer/context'
import { updateViewPrefs } from '@/transfer/preferences'
import { resolveIcon } from '@/protocol/views'
import { NAV_VISIBLE_KINDS, navKindOf } from '@/transfer/siteManifest'
import type { ThemeName } from '@/theme/tokens'

const THEME_OPTIONS: { value: ThemeName; label: string; swatch: string; ink: string }[] = [
  { value: 'light', label: '亮色', swatch: '#ffffff', ink: 'rgba(0,0,0,.88)' },
  { value: 'dark', label: '暗色', swatch: '#1f1f1f', ink: 'rgba(255,255,255,.85)' },
  { value: 'brand', label: '品牌', swatch: '#3bb093', ink: '#ffffff' },
]

/** 声明图标名 → 图标节点（未知名回落通用图标）。 */
function IconOf({ name }: { name?: string }) {
  const Icon = resolveIcon(name)
  return <Icon />
}

/** 管理视图面板：勾选显隐 + 上下移排序（只列参与导航的声明：tab / menu / child）。 */
function ViewPrefsPanel({ onDone }: { onDone?: () => void }) {
  const { site, refreshPrefs } = useSiteCatalog()
  const { activeId } = useProviders()
  const pid = activeId ?? 'default'
  const navIds = site.navItems.flatMap((n) => [n.viewId, ...(n.children ?? []).map((c) => c.viewId)])
  const manageable = site.declared.filter((d) => NAV_VISIBLE_KINDS.includes(navKindOf(d)))

  const toggle = (viewId: string, visible: boolean) => {
    const hidden = site.declared.map((d) => d.id).filter((id) => !navIds.includes(id))
    updateViewPrefs(pid, { hidden: visible ? hidden.filter((id) => id !== viewId) : [...hidden, viewId] })
    refreshPrefs()
  }
  const move = (viewId: string, dir: -1 | 1) => {
    const order = [...site.navItems.map((n) => n.viewId)]
    const i = order.indexOf(viewId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    updateViewPrefs(pid, { viewOrder: order })
    refreshPrefs()
  }
  const reset = () => {
    updateViewPrefs(pid, { hidden: [], viewOrder: [] })
    refreshPrefs()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {manageable.map((decl) => {
        const visible = navIds.includes(decl.id)
        return (
          <div key={decl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
            <Checkbox checked={visible} onChange={(e) => toggle(decl.id, e.target.checked)}>
              <span style={{ fontSize: 13 }}>{decl.title}</span>
            </Checkbox>
            {visible && decl.id !== 'tools' && (
              <Space size={0}>
                <Button type="text" size="small" onClick={() => move(decl.id, -1)}>↑</Button>
                <Button type="text" size="small" onClick={() => move(decl.id, 1)}>↓</Button>
              </Space>
            )}
          </div>
        )
      })}
      <Divider style={{ margin: '8px 0 4px' }} />
      <Typography.Link style={{ fontSize: 12 }} onClick={() => { reset(); onDone?.() }}>恢复默认</Typography.Link>
    </div>
  )
}

export function AppHeader() {
  const { name, setTheme } = useTheme()
  const { token } = antdTheme.useToken()
  const location = useLocation()
  const navigate = useNavigate()
  const { site } = useSiteCatalog()
  const dialog = useDialog()

  const isActive = (path: string) => path !== '/' && location.pathname.startsWith(path)
  const linkStyle = (active: boolean) => ({
    color: active ? token.colorPrimary : token.colorTextSecondary,
    fontWeight: active ? 600 : 400,
    textDecoration: 'none',
    fontSize: 14,
  })

  /** 设置下拉：管理视图（面板弹窗）+ 页眉声明的功能项（如 APIKey管理，按声明调起视图弹窗）。 */
  const settingsItems: MenuProps['items'] = [
    { key: '__views', label: '管理视图', icon: <AppstoreOutlined /> },
    ...site.headerActions.map((a) => ({ key: a.viewId, label: a.title })),
  ]
  const onSettingsClick: MenuProps['onClick'] = ({ key }) => {
    if (key === '__views') {
      dialog.open({ title: '管理视图', size: 'sm', content: <ViewPrefsPanel onDone={() => dialog.close()} /> })
      return
    }
    const action = site.headerActions.find((a) => a.viewId === key)
    if (action) dialog.openView(action.viewId, { title: action.title, size: 'md' })
  }

  const themePanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 132 }}>
      {THEME_OPTIONS.map((option) => {
        const active = option.value === name
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', cursor: 'pointer',
              background: active ? token.controlItemBgHover : 'transparent',
              border: 'none', borderRadius: token.borderRadius, padding: '6px 8px',
              color: token.colorText, font: 'inherit', fontSize: 13, textAlign: 'left',
            }}
          >
            <span
              style={{
                width: 16, height: 16, borderRadius: 4, background: option.swatch,
                border: `1px solid ${token.colorBorder}`, flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{option.label}</span>
            {active && <CheckOutlined style={{ fontSize: 11, color: token.colorPrimary }} />}
          </button>
        )
      })}
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
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: 'transparent',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(6px)',
      }}
    >
      <Space size={8}>
        <AppstoreOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
        <Typography.Text strong style={{ fontSize: 16 }}>
          CommWEB
        </Typography.Text>
      </Space>
      <nav style={{ display: 'flex', gap: 20, flex: 1 }}>
        {site.navItems.map((item) => {
          const Icon = resolveIcon(item.icon)
          if (item.kind === 'menu') {
            const children = item.children ?? []
            const activeChild = children.some((c) => isActive(c.path))
            return (
              <Dropdown
                key={item.key}
                trigger={['click']}
                menu={{
                  items: children.map((c) => ({
                    key: c.key,
                    label: c.title,
                    icon: c.icon ? <IconOf name={c.icon} /> : undefined,
                  })),
                  onClick: ({ key }) => {
                    const child = children.find((c) => c.key === key)
                    if (child) navigate(child.path)
                  },
                }}
              >
                <span style={{ ...linkStyle(activeChild), cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ marginRight: 6 }}><Icon /></span>
                  {item.title}
                </span>
              </Dropdown>
            )
          }
          return (
            <Link key={item.key} to={item.path} style={linkStyle(isActive(item.path))}>
              <span style={{ marginRight: 6 }}><Icon /></span>
              {item.title}
            </Link>
          )
        })}
      </nav>
      <Dropdown menu={{ items: settingsItems, onClick: onSettingsClick }} trigger={['click']} placement="bottomRight">
        <Button type="text" size="small" icon={<SettingOutlined />} title="设置" />
      </Dropdown>
      <Popover trigger="hover" placement="bottomRight" content={themePanel}>
        <DesktopOutlined style={{ fontSize: 18, color: token.colorTextSecondary, cursor: 'pointer' }} />
      </Popover>
      <ProviderMenu />
    </header>
  )
}
