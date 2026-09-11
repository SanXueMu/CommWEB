/** 生命流程组件：标签+细线+箭头+流线的流程变化展示。
 *  数据驱动 nodes[]；横向/纵向；三档大小；running 节点间连线为流动虚线。
 *  纯渲染件，零业务语义——节点与颜色全部由调用方注入。 */

import './index.css'
import type { ReactNode } from 'react'

export type LifeFlowStatus = 'done' | 'running' | 'pending' | 'error'

export interface LifeFlowNode {
  key: string
  label: ReactNode
  color?: string
  status?: LifeFlowStatus
}

export interface LifeFlowProps {
  nodes: LifeFlowNode[]
  direction?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  activeKey?: string
}

const STATUS_COLORS: Record<LifeFlowStatus, string> = {
  done: '#3bb093',
  running: '#202753',
  pending: '#d9d9d9',
  error: '#cf1322',
}

const SIZES = {
  sm: { dot: 6, font: 11, gap: 8, line: 2 },
  md: { dot: 8, font: 12, gap: 12, line: 2 },
  lg: { dot: 12, font: 14, gap: 16, line: 3 },
} as const

export function LifeFlow({ nodes, direction = 'horizontal', size = 'md', activeKey }: LifeFlowProps) {
  const s = SIZES[size]
  const nodeColor = (n: LifeFlowNode) =>
    n.color ?? STATUS_COLORS[activeKey === n.key ? 'running' : (n.status ?? 'pending')]

  if (nodes.length === 0) return null

  return (
    <div className={`life-flow life-flow-${direction}`} style={{ gap: s.gap }}>
      {nodes.map((n, i) => {
        const color = nodeColor(n)
        const connector = i < nodes.length - 1
        const nextColor = connector ? nodeColor(nodes[i + 1]) : undefined
        const flowing = nodes[i].status === 'done' && (nodes[i + 1].status === 'running' || activeKey === nodes[i + 1]?.key)
        return (
          <div className="life-flow-cell" key={n.key}>
            <div className="life-flow-node" style={{ gap: s.gap / 2 }}>
              <span
                className={activeKey === n.key ? 'life-flow-dot life-flow-dot-active' : 'life-flow-dot'}
                style={{ width: s.dot, height: s.dot, background: color, borderRadius: 999 }}
              />
              <span className="life-flow-label" style={{ fontSize: s.font, color: activeKey === n.key ? '#202753' : undefined }}>
                {n.label}
              </span>
            </div>
            {connector && (
              <div
                className={`life-flow-connector life-flow-${direction === 'horizontal' ? 'h' : 'v'}`}
                style={{
                  '--life-flow-line': `${s.line}px`,
                  '--life-flow-gap': `${s.gap}px`,
                  '--life-flow-color': nextColor,
                  '--life-flow-dot': `${s.dot}px`,
                } as React.CSSProperties}
                data-flowing={flowing || undefined}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
