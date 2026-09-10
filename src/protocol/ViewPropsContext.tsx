import { createContext, useContext, type ReactNode } from 'react'
import { mergedViewProps, type SiteViewDecl } from '@/transfer/siteManifest'

/** 视图 props 上下文：站点声明（+用户偏好合并）注入通用视图组件（纯壳准则，2026-09-10）。
 *  CommWEB 组件只读声明，不持业务。 */
const ViewPropsContext = createContext<Record<string, unknown>>({})

export function ViewScope({ decl, pid, children }: { decl: SiteViewDecl; pid: string; children: ReactNode }) {
  return <ViewPropsContext.Provider value={mergedViewProps(decl, pid)}>{children}</ViewPropsContext.Provider>
}

export function useViewProps<T extends Record<string, unknown>>(): T {
  return useContext(ViewPropsContext) as T
}
