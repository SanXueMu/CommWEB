/** 起始首页（蓝图04）：零状态界面——未激活时的唯一界面；点卡即激活。 */

import { useConfirm } from '@/components/ConfirmDialog'
import { useNavigate } from 'react-router-dom'
import { ProviderMenu } from '@/components/ProviderMenu'
import { PORTAL } from '@/config/portal'
import { useProviders } from '@/transfer/context'
import { providerColor } from '@/components/ProviderBadge'
import type { ProviderDescriptor } from '@/transfer/protocol'

const STATUS_COLOR: Record<ProviderDescriptor['status'], string> = {
  online: '#52c41a',
  offline: '#ff4d4f',
  degraded: '#faad14',
  unknown: 'var(--cw-border-strong)',
}

function capabilitySummary(p: ProviderDescriptor): string {
  if (p.status === 'unknown') return '探测中…'
  if (p.status === 'offline') return '不可达'
  const caps = p.capabilities
  const parts: string[] = []
  if (caps.has_pipelines) parts.push('工具·流')
  else parts.push('工具')
  if (caps.has_statuses) parts.push('任务')
  return parts.join(' · ')
}

export function Home() {
  const { providers, activeId, setActiveId, probeAll } = useProviders()
  const { confirm } = useConfirm()
  const navigate = useNavigate()

  const onlineFirst = [...providers].sort((a, b) => {
    const rank = (p: ProviderDescriptor) => (p.status === 'online' ? 0 : p.status === 'unknown' ? 1 : 2)
    return rank(a) - rank(b)
  })
  const allOffline = providers.length > 0 && providers.every((p) => p.status === 'offline')

  const activate = async (p: ProviderDescriptor) => {
    if (p.status === 'offline') {
      const confirmed = await confirm({ title: '该系统当前不可达', content: `${p.name}（${p.baseUrl}）探测失败，仍要进入？`, options: [{ value: true, label: '仍要进入', danger: true }] })
      if (!confirmed) return
    }
    setActiveId(p.id)
    console.info(`已选择 ${p.name}`)
    navigate('/')
  }

  return (
    <div className="home-shell">
      <div className="home-column">
        <h3 style={{ marginBottom: 4 }}>{PORTAL.home.title}</h3>
        <span style={{ color: 'var(--cw-text-secondary)', fontSize: 13, display: 'block', marginBottom: 20 }}>
          {PORTAL.home.subtitle(providers.length)}
        </span>

        {allOffline && (
          <div role="alert" style={{ color: 'var(--cw-warning)', marginBottom: 16 }}>{PORTAL.home.allOffline} <a onClick={probeAll}>{PORTAL.home.retry}</a></div>
        )}

        <div className={providers.length > 6 ? 'home-grid home-grid-2' : 'home-grid'}>
          {onlineFirst.map((p) => {
            const using = p.id === activeId
            return (
              <button
                key={p.id}
                className={`home-card${using ? ' home-card-using' : ''}`}
                onClick={() => activate(p)}
                title={`会员：${p.name}（${p.id}）`}
              >
                <span className="home-dot" style={{ background: STATUS_COLOR[p.status] }} />
                <span className="home-avatar" style={{ background: providerColor(p.id) }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="home-meta">
                  <span className="home-name">
                    {p.name}
                    {using && <span className="home-using-tag">{PORTAL.home.using}</span>}
                  </span>
                  <span className="home-id">{p.id} · {p.baseUrl}</span>
                </span>
                <span className="home-caps">{capabilitySummary(p)}</span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 24, color: 'var(--cw-text-secondary)', fontSize: 13 }}>
            <ProviderMenu asLink />
        </div>
        {providers.length === 1 && (
          <span style={{ color: 'var(--cw-text-secondary)', fontSize: 12, marginTop: 8, display: 'block' }}>
            {PORTAL.home.singleHint}
          </span>
        )}
      </div>
    </div>
  )
}
