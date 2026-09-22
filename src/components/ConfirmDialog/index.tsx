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
import type { ConfirmOption } from '@/protocol/confirm'
import { Button, Modal } from '@/ui'

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
        isOpen={!!request}
        onOpenChange={(open) => !open && close(null)}
      >
        <Modal.Backdrop isDismissable={false}>
          <div style={{ maxWidth: request?.width ?? 460, width: '100%' }}>
            <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{request?.title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {typeof request?.content === 'function' ? request.content({ close }) : request?.content}
                {descriptions.length > 0 && (
                  <div style={{ color: 'var(--cw-text-secondary)', fontSize: 12, marginTop: 12 }}>
                    {descriptions.map((opt, index) => (
                      <div key={String(index)}><b>{opt.label}</b>：{opt.description}</div>
                    ))}
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onClick={() => close(null)}>
                  {request?.cancelText ?? '取消'}
                </Button>
                {(request?.options ?? []).map((opt, index) => (
                  <Button
                    key={String(index)}
                    variant={opt.danger ? 'danger' : index === 0 ? 'primary' : 'secondary'}
                    onClick={() => close(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </Modal.Footer>
            </Modal.Dialog>
            </Modal.Container>
          </div>
        </Modal.Backdrop>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm 必须在 ConfirmProvider 内使用')
  return ctx
}
