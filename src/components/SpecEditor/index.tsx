/** SpecEditor：JSON 结构化编辑器（轻实现）——ViewSpec/TaskSpec 编辑，实时 parse 校验。
 *  纯壳准则：内置视图名等快选项由声明 props 注入，本组件零业务知识。 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Input, Space, Tag, Typography } from 'antd'

export function SpecEditor({ value, onChange, rows = 10, builtinViews = [], specLabel }: {
  value: string
  onChange: (next: string) => void
  rows?: number
  builtinViews?: string[]
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
            {builtinViews.map((name) => (
              <Tag key={name} style={{ cursor: 'pointer' }} onClick={() => onChange(JSON.stringify(name))}>
                {name}
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
