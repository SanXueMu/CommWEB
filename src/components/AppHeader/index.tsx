/** 页眉：声明驱动导航、主题切换、视图偏好和会员选择。 */
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ProviderMenu } from '@/components/ProviderMenu'
import { useDialog } from '@/components/DialogLayer'
import { useTheme } from '@/theme/store'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { useProviders } from '@/transfer/context'
import { updateViewPrefs } from '@/transfer/preferences'
import { resolveIcon } from '@/protocol/views'
import { NAV_VISIBLE_KINDS, navKindOf } from '@/transfer/siteManifest'
import type { ThemeName } from '@/theme/tokens'

const THEME_OPTIONS: { value: ThemeName; label: string; swatch: string }[] = [
  { value: 'light', label: '亮色', swatch: '#ffffff' },
  { value: 'dark', label: '暗色', swatch: '#1f1f1f' },
  { value: 'brand', label: '品牌', swatch: '#3bb093' },
]

function ViewPrefsPanel({ onDone }: { onDone?: () => void }) {
  const { site, refreshPrefs } = useSiteCatalog()
  const { activeId } = useProviders()
  const pid = activeId ?? 'default'
  const navIds = site.navItems.flatMap((n) => [n.viewId, ...(n.children ?? []).map((c) => c.viewId)])
  const manageable = site.declared.filter((d) => NAV_VISIBLE_KINDS.includes(navKindOf(d)))
  const toggle = (viewId: string, visible: boolean) => { const hidden = site.declared.map((d) => d.id).filter((id) => !navIds.includes(id)); updateViewPrefs(pid, { hidden: visible ? hidden.filter((id) => id !== viewId) : [...hidden, viewId] }); refreshPrefs() }
  const move = (viewId: string, dir: -1 | 1) => { const order = [...site.navItems.map((n) => n.viewId)]; const i = order.indexOf(viewId); const j = i + dir; if (i < 0 || j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; updateViewPrefs(pid, { viewOrder: order }); refreshPrefs() }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{manageable.map((decl) => { const visible = navIds.includes(decl.id); return <div key={decl.id} style={{ display: 'flex', justifyContent: 'space-between' }}><label><input type="checkbox" checked={visible} onChange={(e) => toggle(decl.id, e.target.checked)} /> {decl.title}</label>{visible && decl.id !== 'tools' && <span><button type="button" onClick={() => move(decl.id, -1)}>↑</button><button type="button" onClick={() => move(decl.id, 1)}>↓</button></span>}</div> })}<hr /><a onClick={() => { updateViewPrefs(pid, { hidden: [], viewOrder: [] }); refreshPrefs(); onDone?.() }}>恢复默认</a></div>
}

export function AppHeader() {
  const { name, setTheme } = useTheme()
  const location = useLocation(); const navigate = useNavigate(); const { site } = useSiteCatalog(); const dialog = useDialog()
  const [openPanel, setOpenPanel] = useState<'settings' | 'theme' | null>(null)
  const linkStyle = (active: boolean) => ({ color: active ? 'var(--cw-brand)' : 'var(--cw-text-secondary)', fontWeight: active ? 600 : 400, textDecoration: 'none', fontSize: 14 })
  const isActive = (path: string) => path !== '/' && location.pathname.startsWith(path)
  return <header style={{ height: 60, display: 'flex', alignItems: 'center', gap: 32, padding: '0 24px', borderBottom: '1px solid var(--cw-border)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(6px)' }}>
    <strong style={{ color: 'var(--cw-brand)', fontSize: 16 }}>▦ CommWEB</strong>
    <nav style={{ display: 'flex', gap: 20, flex: 1 }}>{site.navItems.map((item) => { const Icon = resolveIcon(item.icon); if (item.kind === 'menu') return <details key={item.key}><summary style={linkStyle(item.children?.some((c) => isActive(c.path)) ?? false)}><Icon /> {item.title}</summary><div style={{ position: 'absolute', background: 'var(--cw-surface)', border: '1px solid var(--cw-border)', padding: 8 }}>{(item.children ?? []).map((child) => <button key={child.key} type="button" onClick={() => navigate(child.path)} style={{ display: 'block', border: 0, background: 'transparent', padding: 6 }}>{child.title}</button>)}</div></details>; return <Link key={item.key} to={item.path} style={linkStyle(isActive(item.path))}><Icon /> {item.title}</Link> })}</nav>
    <div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenPanel(openPanel === 'settings' ? null : 'settings')}>⚙ 设置</button>{openPanel === 'settings' && <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 5, background: 'var(--cw-surface)', border: '1px solid var(--cw-border)', padding: 10, minWidth: 180 }}><button type="button" onClick={() => dialog.open({ title: '管理视图', size: 'sm', content: <ViewPrefsPanel onDone={() => dialog.close()} /> })}>管理视图</button>{site.headerActions.map((a) => <button key={a.viewId} type="button" onClick={() => dialog.openView(a.viewId, { title: a.title, size: 'md' })}>{a.title}</button>)}</div>}</div>
    <div style={{ position: 'relative' }}><button type="button" onClick={() => setOpenPanel(openPanel === 'theme' ? null : 'theme')}>◐</button>{openPanel === 'theme' && <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 5, background: 'var(--cw-surface)', border: '1px solid var(--cw-border)', padding: 8 }}>{THEME_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setTheme(option.value)} style={{ display: 'block', padding: 6, border: 0, background: option.value === name ? 'var(--cw-surface-raised)' : 'transparent' }}><i style={{ display: 'inline-block', width: 14, height: 14, background: option.swatch, border: '1px solid var(--cw-border)', marginRight: 6 }} />{option.label}{option.value === name ? ' ✓' : ''}</button>)}</div>}</div>
    <ProviderMenu />
  </header>
}
