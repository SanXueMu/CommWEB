/**
 * ProgressRing：圆环进度（UI 原则①——紧凑信息密度）。
 * 动画圆环展示进度百分比；中心 slot 放核心数字（如尝试次数）；整环可点击（如查看历史）。
 */

import { Progress, Tooltip } from 'antd'
import type { ReactNode } from 'react'

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
  /** 状态色：active/success/exception（antd Progress status） */
  status?: 'active' | 'success' | 'exception' | 'normal'
}

export function ProgressRing({ percent, center, title, onClick, size = 34, status = 'active' }: ProgressRingProps) {
  const ring = (
    <div
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', lineHeight: 0 }}
      role={onClick ? 'button' : undefined}
    >
      <Progress
        type="circle"
        size={size}
        percent={percent ?? 0}
        status={percent === null ? 'normal' : status}
        showInfo={false}
        strokeWidth={Math.max(3, Math.round(size * 0.08))}
        strokeLinecap="round"
      />
      {center !== undefined && (
        <div
          style={{
            marginTop: -size,
            height: size,
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
  return title ? <Tooltip title={title}>{ring}</Tooltip> : ring
}
