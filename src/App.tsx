import { ConfigProvider, Typography } from 'antd'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { FlowDetail } from '@/pages/FlowDetail'
import { Flows } from '@/pages/Flows'
import { Tasks } from '@/pages/Tasks'
import { ToolDetail } from '@/pages/ToolDetail'
import { ToolsHub } from '@/pages/ToolsHub'
import { Workspace } from '@/pages/Workspace'
import { PORTAL } from '@/config/portal'
import { useTheme } from '@/theme/store'
import { WorkspaceProvider } from '@/workspace/store'

export function App() {
  const { config } = useTheme()
  const location = useLocation()
  const isDetail =
    location.pathname.startsWith('/tools/') || location.pathname.startsWith('/flows/')

  return (
    <ConfigProvider theme={config}>
      <WorkspaceProvider>
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
            <Route path="/flows" element={<Flows />} />
            <Route path="/flows/:id" element={<FlowDetail />} />
            <Route path="/workspace" element={<Workspace />} />
          </Routes>
          {!isDetail && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 32 }}>
              {PORTAL.footer}
            </Typography.Text>
          )}
        </main>
      </div>
      </WorkspaceProvider>
    </ConfigProvider>
  )
}
