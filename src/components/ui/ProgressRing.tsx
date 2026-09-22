/**
 * ProgressRing：圆环进度（UI 原则①——紧凑信息密度）。
 * 动画圆环展示进度百分比；中心 slot 放核心数字（如尝试次数）；整环可点击（如查看历史）。
 */

import type { ReactNode } from 'react'
import { ProgressCircle, Tooltip } from '@/ui'

export interface ProgressRingProps {
  /** 进度 0-100；null 表示无进度数据（灰环） */
  percent: number | null
  /** 圆环中心内容（数字/文本） */
  center?: ReactNode
  /** hover 提示 */
  title?: string
  onClick?: () => void
  /** 直径 px（窄屏建议缩小） */
  size?: number
  /** 状态色：active/success/exception（兼容旧业务语义） */
  status?: 'active' | 'success' | 'exception' | 'normal'
}

export function ProgressRing({ percent, center, title, onClick, size = 34, status = 'active' }: ProgressRingProps) {
  const color = status === 'success' ? 'success' : status === 'exception' ? 'danger' : 'accent'
  const ring = (
    <div
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', lineHeight: 0, position: 'relative', width: size, height: size }}
      role={onClick ? 'button' : undefined}
    >
      <ProgressCircle
        value={percent ?? 0}
        maxValue={100}
        color={percent === null ? 'default' : color}
        size={size <= 28 ? 'sm' : size <= 44 ? 'md' : 'lg'}
        aria-label={title ?? '进度'}
        style={{ width: size, height: size }}
      />
      {center !== undefined && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.max(11, Math.floor(size / 3)),
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            userSelect: 'none',
          }}
        >
          {center}
        </div>
      )}
    </div>
  )
  return title ? (
    <Tooltip>
      <Tooltip.Trigger>{ring}</Tooltip.Trigger>
      <Tooltip.Content>{title}</Tooltip.Content>
    </Tooltip>
  ) : ring
}
