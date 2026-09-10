import React, { useEffect } from 'react'
import { App as AntApp, ConfigProvider, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { PORTAL } from '@/config/portal'
import { useTheme } from '@/theme/store'
import { WorkspaceProvider } from '@/workspace/store'
import { TransferProvider, useProviders } from '@/transfer/context'
import { Home } from '@/pages/Home'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { viewComponent, viewDetailRoutes } from '@/protocol/views'

/** 会话壳：未激活守卫（蓝图05 §五.3）；被删会员回退提示（§七.2）。 */
function AppShell({ children }: { children: React.ReactNode }) {
  const { activeId } = useProviders()
  const location = useLocation()
  const { message } = AntApp.useApp()

  useEffect(() => {
    const onRemoved = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      message.warning(`所选会员已被移除${id ? `（${id}）` : ''}，请重新选择`)
    }
    window.addEventListener('commweb:member-removed', onRemoved)
    return () => window.removeEventListener('commweb:member-removed', onRemoved)
  }, [message])

  if (!activeId && location.pathname !== '/home') return <Navigate to="/home" replace />
  return <>{children}</>
}

function App() {
  const { config } = useTheme()
  return (
    <ConfigProvider theme={config}>
      <AntApp>
        <TransferProvider>
          <SiteFrame />
        </TransferProvider>
      </AntApp>
    </ConfigProvider>
  )
}

/** 站点装配与路由壳：必须在 TransferProvider 内渲染（useSiteCatalog 依赖会员上下文）。 */
function SiteFrame() {
  const location = useLocation()
  const { site } = useSiteCatalog()
  const detailPrefixes = site.navItems
    .flatMap((n) => viewDetailRoutes(site.routes.find((r) => r.viewId === n.viewId)?.type ?? ''))
    .map((r) => r.path.split('/:')[0])
  const isDetail = detailPrefixes.some((prefix) => location.pathname.startsWith(prefix)) ||
    location.pathname.startsWith('/tools/') || location.pathname.startsWith('/flows/')

  return (
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
          {site.landing !== '/' && <Route path="/" element={<Navigate to={site.landing} replace />} />}
          {site.routes.map((r) => (
            <Route key={r.path} path={r.path} element={React.createElement(viewComponent(r.type))} />
          ))}
          {site.navItems.flatMap((n) => {
            const type = site.routes.find((r) => r.viewId === n.viewId)?.type ?? ''
            return viewDetailRoutes(type).map((d) => (
              <Route key={d.path} path={d.path} element={d.element} />
            ))
          })}
          <Route path="*" element={<Navigate to={site.landing} replace />} />
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
  )
}
export { App }
