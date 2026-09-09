import { ConfigProvider, Layout, Menu, Select, Typography } from 'antd'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Plaza } from '@/pages/Plaza'
import { Tasks } from '@/pages/Tasks'
import { ToolDetail } from '@/pages/ToolDetail'
import { useTheme } from '@/theme/store'
import type { ThemeName } from '@/theme/tokens'

const NAV = [
  { key: '/', label: <Link to="/">工具广场</Link> },
  { key: '/tasks', label: <Link to="/tasks">任务中心</Link> },
]

export function App() {
  const { name, setTheme, config } = useTheme()
  const location = useLocation()
  const selected = location.pathname === '/tasks' ? '/tasks' : '/'

  return (
    <ConfigProvider theme={config}>
      <Layout style={{ minHeight: '100%' }}>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
            CommWEB
          </Typography.Title>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[selected]}
            items={NAV}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Select<ThemeName>
            size="small"
            value={name}
            onChange={setTheme}
            style={{ width: 96 }}
            options={[
              { value: 'light', label: '亮色' },
              { value: 'dark', label: '暗色' },
              { value: 'brand', label: '品牌' },
            ]}
          />
        </Layout.Header>
        <Layout.Content style={{ padding: 24, maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Plaza />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tools/:id" element={<ToolDetail />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  )
}
