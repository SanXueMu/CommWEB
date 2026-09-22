/**
 * 通用面板弹窗（壳组件）：注入标题 + 任意内容，或按站点声明 id 直接调起视图。
 *
 * 用法：
 *   const dialog = useDialog()
 *   dialog.open({ title: 'APIKey 管理', content: <SettingsKeys />, size: 'md' })
 *   dialog.openView('templates', { title: '模版管理' })   // 内容 = 声明视图组件（包 ViewScope）
 *
 * 与 ConfirmDialog 的分工：确认弹窗管「选一个选项」，本组件管「承载一块面板/页面」。
 * 尺寸与页面和谐：预设档 × 视口上限（min(size, 88vw)），正文超高内部滚动，
 * 弹窗始终不超出视口高度（顶/底留白固定），避免长内容把弹窗撑破页面。
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useProviders } from '@/transfer/context'
import { useSiteCatalog } from '@/config/useSiteCatalog'
import { ViewScope } from '@/protocol/ViewPropsContext'
import { viewComponent } from '@/protocol/views'
import { Modal } from '@/ui'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

/** 预设宽度档（实际宽度再与视口取 min，保证小屏不溢出）。 */
export const DIALOG_WIDTHS: Record<DialogSize, number> = { sm: 480, md: 720, lg: 900, xl: 1080 }

/** 正文最大高度：视口减「顶距 + 标题 + 底距」，超出部分内部滚动。 */
const BODY_MAX = 'calc(100vh - 200px)'

export interface PanelDialogRequest {
  title: React.ReactNode
  content: React.ReactNode
  size?: DialogSize
  width?: number
  footer?: React.ReactNode | null
  onClose?: () => void
}

export interface DialogApi {
  /** 打开一个面板弹窗（后开的替换先开的，单例避免叠窗）。 */
  open: (request: PanelDialogRequest) => void
  close: () => void
  /** 按站点声明 id 打开视图：内容 = 该视图组件（自动注入声明 props）。 */
  openView: (viewId: string, overrides?: Partial<Omit<PanelDialogRequest, 'content'>>) => void
}

const DialogContext = createContext<DialogApi | null>(null)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const { site } = useSiteCatalog()
  const { activeId } = useProviders()
  const [request, setRequest] = useState<PanelDialogRequest | null>(null)
  const requestRef = useRef<PanelDialogRequest | null>(null)
  requestRef.current = request

  const open = useCallback((req: PanelDialogRequest) => setRequest(req), [])
  const close = useCallback(() => {
    requestRef.current?.onClose?.()
    setRequest(null)
  }, [])

  const openView = useCallback<DialogApi['openView']>((viewId, overrides) => {
    const decl = site.declared.find((d) => d.id === viewId)
    if (!decl) return
    const Comp = viewComponent(decl.type)
    setRequest({
      title: decl.title,
      size: 'lg',
      ...overrides,
      content: (
        <ViewScope decl={decl} pid={activeId ?? ''}>
          <Comp />
        </ViewScope>
      ),
    })
  }, [site.declared, activeId])

  const api = useMemo<DialogApi>(() => ({ open, close, openView }), [open, close, openView])
  const width = request?.width ?? DIALOG_WIDTHS[request?.size ?? 'md']

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        isOpen={!!request}
        onOpenChange={(open) => !open && close()}
      >
        <Modal.Backdrop>
          <div style={{ marginTop: 72, maxWidth: `min(${width}px, 88vw)`, width: '100%' }}>
            <Modal.Container size="lg" placement="top">
              <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{request?.title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body style={{ maxHeight: BODY_MAX, overflow: 'auto', paddingRight: 4 }}>
                {request?.content}
              </Modal.Body>
              {request?.footer != null && <Modal.Footer>{request.footer}</Modal.Footer>}
              </Modal.Dialog>
            </Modal.Container>
          </div>
        </Modal.Backdrop>
      </Modal>
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog 必须在 DialogProvider 内使用')
  return ctx
}
