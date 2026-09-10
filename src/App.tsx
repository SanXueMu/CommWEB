import { App as AntApp, ConfigProvider, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { TransferProvider, useProviders } from '@/transfer/context'
import { Home } from '@/pages/Home'

/** 会话壳：未激活守卫（蓝图05 §五.3）——业务路由全部包在 RequireActive 内。 */
function AppShell({ children }: { children: React.ReactNode }) {
  const { activeId } = useProviders()
  const location = useLocation()
  if (!activeId && location.pathname !== '/home') return <Navigate to="/home" replace />
  return <>{children}</>
}

function App() {
  const { config } = useTheme()
  const location = useLocation()
  const isDetail =
    location.pathname.startsWith('/tools/') || location.pathname.startsWith('/flows/')

  return (
    <ConfigProvider theme={config}>
      <AntApp>
      <TransferProvider>
      <AppShell>
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
            <Route path="/home" element={<Home />} />
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
      </AppShell>
      </TransferProvider>
      </AntApp>
    </ConfigProvider>
  )
}
export { App }
