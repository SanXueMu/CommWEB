/**
 * 通用确认弹窗（壳组件）：注入标题/内容/选项，返回选中项的 value（取消为 null）。
 *
 * 用法：
 *   const confirm = useConfirm()
 *   const mode = await confirm({ title, content, options, cancelText })
 *   if (mode) ...
 *
 * 特性：
 * - `options: ConfirmOption<T>[]` 任意条数与取值（泛型返回，调用侧自行映射）
 * - `content` 可传 ReactNode，或 `({ close }) => ReactNode` 以便在内容里放自定义动作
 * - 需要 ConfirmProvider 在应用根部挂载一次
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Button, Modal, Space, Typography } from 'antd'
import type { ConfirmOption } from '@/protocol/confirm'

export interface ConfirmRequest<T> {
  title: React.ReactNode
  /** 可注入任意内容；函数形态可拿到 close 以在内容内自定义动作 */
  content?: React.ReactNode | ((api: { close: (value: T | null) => void }) => React.ReactNode)
  options: ConfirmOption<T>[]
  cancelText?: React.ReactNode
  width?: number
}

export interface ConfirmApi {
  confirm: <T>(request: ConfirmRequest<T>) => Promise<T | null>
}

const ConfirmContext = createContext<ConfirmApi | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest<unknown> | null>(null)
  const resolver = useRef<((value: unknown) => void) | null>(null)

  const close = useCallback((value: unknown) => {
    const resolve = resolver.current
    resolver.current = null
    setRequest(null)
    resolve?.(value)
  }, [])

  const confirm = useCallback(<T,>(req: ConfirmRequest<T>) => {
    return new Promise<T | null>((resolve) => {
      resolver.current = resolve as (value: unknown) => void
      setRequest(req as ConfirmRequest<unknown>)
    })
  }, [])

  const api = useMemo<ConfirmApi>(() => ({ confirm }), [confirm])
  const descriptions = (request?.options ?? []).filter((o) => o.description)

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={!!request}
        title={request?.title}
        width={request?.width ?? 460}
        onCancel={() => close(null)}
        maskClosable={false}
        footer={
          <Space>
            <Button onClick={() => close(null)}>{request?.cancelText ?? '取消'}</Button>
            {(request?.options ?? []).map((opt, index) => (
              <Button
                key={String(index)}
                danger={opt.danger}
                type={index === 0 && !opt.danger ? 'primary' : 'default'}
                onClick={() => close(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </Space>
        }
      >
        {typeof request?.content === 'function' ? request.content({ close }) : request?.content}
        {descriptions.length > 0 && (
          <div style={{ marginTop: descriptions.length ? 12 : 0 }}>
            {descriptions.map((opt, index) => (
              <Typography.Text key={String(index)} type="secondary" style={{ display: 'block', fontSize: 12 }}>
                <b>{opt.label}</b>：{opt.description}
              </Typography.Text>
            ))}
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm 必须在 ConfirmProvider 内使用')
  return ctx
}
