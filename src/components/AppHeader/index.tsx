/** 页眉：无色背景 + 左侧 logo（预留 CommAND 首页链接）+ 右上角状态栏（显示器图标 hover 出主题下拉）。 */

import { AppstoreOutlined, DesktopOutlined } from '@ant-design/icons'
import { Popover, Space, Typography } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '@/theme/store'
import type { ThemeName } from '@/theme/tokens'

const NAV = [
  { path: '/', label: '工具库' },
  { path: '/tasks', label: '任务中心' },
]

const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
  { value: 'brand', label: '品牌' },
]

export function AppHeader() {
  const { name, setTheme } = useTheme()
  const location = useLocation()

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
            {item.label}
          </Link>
        ))}
      </nav>
      <Popover trigger="hover" placement="bottomRight" content={themePanel}>
        <DesktopOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
      </Popover>
    </header>
  )
}
