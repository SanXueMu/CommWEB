/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。 */

import { Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { CatalogBadge } from '@/components/CatalogBadge'
import { ProviderBadge } from '@/components/ProviderBadge'
import { FlowTypeBadge } from '@/components/ui/FlowTypeBadge'
import type { PipelineSummary } from '@/api/types'
import { DataListPanel } from '@/components/DataListPanel'
import { LifeFlow } from '@/components/LifeFlow'
import { OpenInWorkspace } from '@/components/OpenInWorkspace'
import { PanelCard } from '@/components/ui/PanelCard'
import { PORTAL } from '@/config/portal'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { FlowDetailModal } from '@/pages/Flows/FlowDetailModal'

const TYPE_LABELS = { flow: '普通流', workflow: '工作流' } as const

export function Flows() {
  const [keyword, setKeyword] = useState('')
  const [flowType, setFlowType] = useState<'' | keyof typeof TYPE_LABELS>('')
  const [detailFlow, setDetailFlow] = useState<PipelineSummary | null>(null)
  const pid = useActivePid()
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const pipelines = data?.pipelines ?? []
  const providerName: Record<string, string> = {}

  const flows = useMemo(() => {
    return pipelines.filter(
      (f) =>
        (!flowType || f.type === flowType) &&
        (!keyword || f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => (s.tool || s.pipeline || '').includes(keyword))),
    )
  }, [pipelines, keyword, flowType])

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
      <aside
        style={{
          width: 128,
          flexShrink: 0,
          position: 'sticky',
          top: 76,
          borderRight: '1px solid #f0f0f0',
          paddingRight: 16,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          类型
        </Typography.Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, alignItems: 'flex-start' }}>
          {(['', 'flow', 'workflow'] as const).map((k) => (
            <span
              key={k || 'all'}
              onClick={() => setFlowType(k)}
              style={{ cursor: 'pointer', display: 'inline-flex' }}
            >
              {k ? (
                <FlowTypeBadge flow={{ type: k }} plain={flowType !== k} strong={flowType === k} />
              ) : (
                <CatalogBadge
                  value={PORTAL.sidebar.all}
                  catalog={new Map()}
                  fallback={flowType === '' ? '#202753' : 'auto'}
                  size="sm"
                  radius="round"
                  plain={flowType !== ''}
                />
              )}
            </span>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
      <DataListPanel
        panelKey="flows"
        items={flows}
        loading={isLoading}
        rowKey={(f) => `${f.providerId ?? 'default'}:${f.id}`}
        onSearch={setKeyword}
        searchPlaceholder={PORTAL.search.flows}
        emptyText={PORTAL.empty.flows}
        renderCard={(flow) => <FlowCard flow={flow} providerName={providerName} onOpen={() => setDetailFlow(flow)} />}
        renderRow={(flow) => <FlowRow flow={flow} providerName={providerName} onOpen={() => setDetailFlow(flow)} />}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        共 {flows.length} 条流 · {PORTAL.footNote.flows}
      </Typography.Text>
      </div>
      {detailFlow && (
        <FlowDetailModal flow={detailFlow} open onClose={() => setDetailFlow(null)} />
      )}
    </div>
  )
}

/** 卡片式：不渲染生命周期（D2.2），标题短名 + 类型标签。 */
function FlowCard({ flow, providerName, onOpen }: { flow: PipelineSummary; providerName: Record<string, string>; onOpen: () => void }) {
  return (
    <PanelCard radius="round" onClick={onOpen} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <Typography.Text strong>{flow.name}</Typography.Text>
        <FlowTypeBadge flow={flow} />
        <ProviderBadge pid={flow.providerId ?? 'default'} name={providerName[flow.providerId ?? 'default']} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {flow.steps.length} 步
        </Typography.Text>
      </div>
    </PanelCard>
  )
}

/** 列表式：渲染横向生命周期（D2.2），不渲染英文名 id。 */
function FlowRow({ flow, providerName, onOpen }: { flow: PipelineSummary; providerName: Record<string, string>; onOpen: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <Typography.Text strong style={{ display: 'block' }}>{flow.name}</Typography.Text>
        <Space size={6} style={{ marginTop: 2 }}>
          <FlowTypeBadge flow={flow} />
          <ProviderBadge pid={flow.providerId ?? 'default'} name={providerName[flow.providerId ?? 'default']} />
        </Space>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LifeFlow
          size="sm"
          nodes={flow.steps.map((s, i) => ({ key: `${s.tool ?? s.pipeline ?? 'step'}-${i}`, label: s.tool ?? s.pipeline ?? '步骤' }))}
        />
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <OpenInWorkspace kind="flow" refId={flow.id} title={flow.name} providerId={flow.providerId} />
      </span>
    </div>
  )
}
