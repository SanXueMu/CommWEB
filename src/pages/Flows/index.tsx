/** 流工具货架：管线 = 串联通用小工具的全自动流，零前端代码自动上架。
 * v3 起支持视图 props.slots 槽位声明（sidebar/list），缺省回落内置双形态。 */

import { Typography } from 'antd'
import { useMemo, useState } from 'react'
import { CatalogBadge } from '@/components/CatalogBadge'
import { DataListPanel } from '@/components/DataListPanel'
import { PORTAL } from '@/config/portal'
import type { PipelineSummary } from '@/api/types'
import { useActivePid } from '@/transfer/context'
import { apiFor } from '@/api/client'
import { useQuery } from '@tanstack/react-query'
import { FlowDetailModal } from '@/pages/Flows/FlowDetailModal'
import { FlowCard, FlowRow } from '@/pages/Flows/renderers'
import { slotsOf } from '@/protocol/slots'
import { SlotRenderer } from '@/protocol/slotTemplates'
import { useViewProps } from '@/protocol/ViewPropsContext'

const TYPE_LABELS = { flow: '普通流', workflow: '工作流' } as const
const TYPE_KEYS = ['', 'flow', 'workflow'] as const
const LABEL_OF: Record<string, string> = { '': PORTAL.sidebar.all, flow: TYPE_LABELS.flow, workflow: TYPE_LABELS.workflow }

export function Flows() {
  const [keyword, setKeyword] = useState('')
  const [flowType, setFlowType] = useState<'' | keyof typeof TYPE_LABELS>('')
  const [detailFlow, setDetailFlow] = useState<PipelineSummary | null>(null)
  const pid = useActivePid()
  const viewProps = useViewProps()
  const slots = slotsOf(viewProps)
  const { data, isLoading } = useQuery({ queryKey: ['provider', pid, 'pipelines'], queryFn: () => apiFor(pid).listPipelines() })
  const pipelines = data?.pipelines ?? []

  const flows = useMemo(() => {
    return pipelines.filter(
      (f) =>
        (!flowType || f.type === flowType) &&
        (!keyword || f.id.includes(keyword) || f.name.includes(keyword) || f.steps.some((s) => (s.tool || s.pipeline || '').includes(keyword))),
    )
  }, [pipelines, keyword, flowType])

  /** v3 槽位分支：会员声明 slots 则按声明渲染（sidebar/list），detail 弹窗仍为内置语义动作。 */
  if (slots.list || slots.sidebar) {
    const typeGroups = [
      {
        title: '类型',
        items: TYPE_KEYS.map((k) => LABEL_OF[k]),
        selected: [LABEL_OF[flowType]],
        onToggle: (label: string) => {
          const key = TYPE_KEYS.find((k) => LABEL_OF[k] === label)
          if (key === undefined) return
          setFlowType(key === flowType ? '' : (key as '' | keyof typeof TYPE_LABELS))
        },
      },
    ]
    return (
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        {slots.sidebar && (
          <SlotRenderer decl={slots.sidebar} pid={pid} context={{ pid, groups: typeGroups, onClearFilters: () => setFlowType('') }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {slots.list && (
            <SlotRenderer
              decl={slots.list}
              pid={pid}
              context={{
                pid,
                items: flows as unknown as Record<string, unknown>[],
                onItemClick: (f) => setDetailFlow(f as unknown as PipelineSummary),
                onSearch: setKeyword,
              }}
            />
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            共 {flows.length} 条流 · {PORTAL.footNote.flows}
          </Typography.Text>
        </div>
        {detailFlow && <FlowDetailModal flow={detailFlow} open onClose={() => setDetailFlow(null)} />}
      </div>
    )
  }

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
          {TYPE_KEYS.map((k) => (
            <span
              key={k || 'all'}
              onClick={() => setFlowType(k)}
              style={{ cursor: 'pointer', display: 'inline-flex' }}
            >
              <CatalogBadge
                value={LABEL_OF[k]}
                catalog={new Map()}
                fallback={flowType === k ? '#202753' : 'auto'}
                size="sm"
                radius="round"
                plain={flowType !== k}
              />
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
          renderCard={(flow) => <FlowCard flow={flow} onOpen={() => setDetailFlow(flow)} />}
          renderRow={(flow) => <FlowRow flow={flow} onOpen={() => setDetailFlow(flow)} />}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          共 {flows.length} 条流 · {PORTAL.footNote.flows}
        </Typography.Text>
      </div>
      {detailFlow && <FlowDetailModal flow={detailFlow} open onClose={() => setDetailFlow(null)} />}
    </div>
  )
}
