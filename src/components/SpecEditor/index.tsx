/** SpecEditor：JSON 结构化编辑器（轻实现）——ViewSpec/TaskSpec 编辑，实时 parse 校验。
 *  纯壳准则：内置视图由声明 props 全量下发（名 + 完整 spec），本组件零业务知识。 */

import { useEffect, useMemo, useState } from 'react'

/** 内置视图快选项：名与完整 spec 一并下发，点选即得可直接使用的视图定义。 */
export interface BuiltinView {
  id: string
  name: string
  spec: Record<string, unknown>
}

export function SpecEditor({ value, onChange, rows = 10, builtinViews = [], specLabel,
  hideQuickPick = false }: {
  value: string
  onChange: (next: string) => void
  rows?: number
  builtinViews?: BuiltinView[]
  specLabel?: string
  /** AH3：视图 tab 有下拉（内置/我的视图/模板携带三组），快选 Tag 与其重复 → 隐藏 */
  hideQuickPick?: boolean
}) {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!value.trim()) {
      setError(null)
      return
    }
    try {
      JSON.parse(value)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [value])

  const status = useMemo(() => {
    if (error) return <Chip color="warning">JSON 无效</Chip>
    if (value.trim()) return <Chip color="success">JSON 有效</Chip>
    return <Chip>空</Chip>
  }, [error, value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {status}
        {!hideQuickPick && builtinViews.length > 0 && (
          <>
            <span style={{ color: 'var(--cw-text-secondary)', fontSize: 12 }}>{specLabel ?? '快选'}：</span>
            {builtinViews.map((v) => (
              <Chip
                key={v.id}
                style={{ cursor: 'pointer' }}
                // 写入完整 spec 而非视图名：records.view.query 直接可用
                // （此前写 JSON.stringify(name) 得到字符串，工具侧 ViewSpec(**str) 必抛错）
                onClick={() => onChange(JSON.stringify(v.spec, null, 2))}
              >
                {v.name}
              </Chip>
            ))}
          </>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder='输入 JSON（对象/数组），或点击上方快选'
        style={{ fontFamily: 'monospace', fontSize: 12, width: '100%', boxSizing: 'border-box' }}
      />
      {error && <div role="alert" style={{ color: 'var(--cw-warning)' }}>{error}</div>}
    </div>
  )
}
import { Chip } from '@/ui'
