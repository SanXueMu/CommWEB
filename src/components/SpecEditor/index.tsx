/** SpecEditor：JSON 结构化编辑器（轻实现）——ViewSpec/TaskSpec 编辑，实时 parse 校验。
 *  纯壳准则：内置视图由声明 props 全量下发（名 + 完整 spec），本组件零业务知识。 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Input, Space, Tag, Typography } from 'antd'

/** 内置视图快选项：名与完整 spec 一并下发，点选即得可直接使用的视图定义。 */
export interface BuiltinView {
  id: string
  name: string
  spec: Record<string, unknown>
}

export function SpecEditor({ value, onChange, rows = 10, builtinViews = [], specLabel }: {
  value: string
  onChange: (next: string) => void
  rows?: number
  builtinViews?: BuiltinView[]
  specLabel?: string
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
    if (error) return <Tag color="orange">JSON 无效</Tag>
    if (value.trim()) return <Tag color="green">JSON 有效</Tag>
    return <Tag>空</Tag>
  }, [error, value])

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space size={8} wrap>
        {status}
        {builtinViews.length > 0 && (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{specLabel ?? '快选'}：</Typography.Text>
            {builtinViews.map((v) => (
              <Tag
                key={v.id}
                style={{ cursor: 'pointer' }}
                // 写入完整 spec 而非视图名：records.view.query 直接可用
                // （此前写 JSON.stringify(name) 得到字符串，工具侧 ViewSpec(**str) 必抛错）
                onClick={() => onChange(JSON.stringify(v.spec, null, 2))}
              >
                {v.name}
              </Tag>
            ))}
          </>
        )}
      </Space>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder='输入 JSON（对象/数组），或点击上方快选'
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      {error && <Alert type="warning" showIcon message={error} />}
    </Space>
  )
}
