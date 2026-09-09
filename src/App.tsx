import { ConfigProvider, Typography } from 'antd'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { Tasks } from '@/pages/Tasks'
import { ToolDetail } from '@/pages/ToolDetail'
import { ToolsHub } from '@/pages/ToolsHub'
import { useTheme } from '@/theme/store'

export function App() {
  const { config } = useTheme()
  const location = useLocation()
  const isDetail = location.pathname.startsWith('/tools/')

  return (
    <ConfigProvider theme={config}>
      <div style={{ minHeight: '100vh', background: '#fff' }}>
        <AppHeader />
        <main
          style={{
            padding: isDetail ? '24px' : '24px 24px 48px',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <Routes>
            <Route path="/" element={<ToolsHub />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tools/:id" element={<ToolDetail />} />
          </Routes>
          {!isDetail && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 32 }}>
              CommWEB · CommAND 之上的筋络 · 工具零前端代码自动上架
            </Typography.Text>
          )}
        </main>
      </div>
    </ConfigProvider>
  )
}
