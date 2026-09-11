/**
 * 协议 v3 槽位层：会员（CommAND）在视图 props.slots 里声明「页面需要什么 UI」，
 * CommWEB 按白名单模板注册表渲染。热部署=配置热更新（会员传数据，永不传代码）。
 *
 * slot = { template, props?, data? }
 *  - template：SLOT_TEMPLATES 白名单名，未知降级占位卡（继承视图层 UnknownView 传统）
 *  - props：纯数据（深度禁函数/组件引用，校验拒绝）
 *  - data：声明式取数（path 限 /api/ 内部 GET，params 白名单基本类型）
 */

import { useQuery } from '@tanstack/react-query'
import { apiFor } from '@/api/client'

export interface DataDecl {
  /** 内部 API 路径，须以单个 / 开头且不含协议头（外部 URL 一律拒绝） */
  path: string
  params?: Record<string, string | number | boolean>
  /** 仅支持 GET——写路径不开放给声明式取数 */
  method?: 'GET'
  staleTime?: number
}

export interface SlotDecl {
  template: string
  props?: Record<string, unknown>
  data?: DataDecl
}

/** 从视图 props 提取 slots 声明（v2 视图无 slots 返回空表——完全兼容）。 */
export function slotsOf(props?: Record<string, unknown> | null): Record<string, SlotDecl> {
  const slots = props?.slots
  if (!slots || typeof slots !== 'object') return {}
  const out: Record<string, SlotDecl> = {}
  for (const [key, value] of Object.entries(slots as Record<string, unknown>)) {
    const decl = value as SlotDecl
    if (decl && typeof decl === 'object' && typeof decl.template === 'string') out[key] = decl
  }
  return out
}

const FORBIDDEN_PROPS = new Set(['function', 'object-with-call'])

/** v3 已注册模板名（渲染实现在 slotTemplates.tsx；名单在此供纯函数校验与测试）。 */
export const SLOT_TEMPLATE_NAMES = new Set(['list.panel', 'sidebar.filter', 'flow.lifeflow'])

export type SlotResolve =
  | { status: 'ok'; decl: SlotDecl }
  | { status: 'unknown'; reason: string }
  | { status: 'invalid'; reason: string }

/** 解析纯函数：模板存在性 + props/data 白名单校验（可单测，不引 React/antd）。 */
export function resolveSlot(decl: SlotDecl): SlotResolve {
  if (!SLOT_TEMPLATE_NAMES.has(decl.template)) return { status: 'unknown', reason: `未知模板 ${decl.template}` }
  const propsErr = validateSlotProps(decl.props)
  if (propsErr) return { status: 'invalid', reason: propsErr }
  if (decl.data) {
    const dataErr = validateDataDecl(decl.data)
    if (dataErr) return { status: 'invalid', reason: dataErr }
  }
  return { status: 'ok', decl }
}

/** props 深度白名单：只许纯数据（string/number/boolean/null/数组/平面对象）。 */
export function validateSlotProps(props: unknown, depth = 0): string | null {
  if (depth > 6) return 'props 嵌套过深'
  if (props === null || props === undefined) return null
  const t = typeof props
  if (t === 'string' || t === 'number' || t === 'boolean') return null
  if (t !== 'object') return FORBIDDEN_PROPS.has(t) ? `props 含 ${t}（禁函数/组件引用）` : `props 含 ${t}`
  if (Array.isArray(props)) {
    for (const item of props) {
      const err = validateSlotProps(item, depth + 1)
      if (err) return err
    }
    return null
  }
  const proto = Object.getPrototypeOf(props)
  if (proto !== Object.prototype && proto !== null) return 'props 含非平面对象（禁类实例/组件引用）'
  for (const value of Object.values(props)) {
    const err = validateSlotProps(value, depth + 1)
    if (err) return err
  }
  return null
}

/** data 声明白名单：仅内部路径 GET；拒绝外部 URL、协议头、路径穿越。 */
export function validateDataDecl(data: DataDecl): string | null {
  if ((data.method ?? 'GET') !== 'GET') return 'data.method 仅支持 GET'
  const path = data.path
  if (typeof path !== 'string' || !path.startsWith('/')) return 'data.path 须以 / 开头'
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return 'data.path 禁止协议头（外部 URL）'
  if (path.includes('//') || path.includes('..')) return 'data.path 疑似路径穿越'
  if (data.params) {
    for (const [key, value] of Object.entries(data.params)) {
      if (!['string', 'number', 'boolean'].includes(typeof value)) return `data.params.${key} 仅许基本类型`
      if (key.includes('=') || key.includes('&')) return `data.params.${key} 键名非法`
    }
  }
  return null
}

/** 声明式取数：data 缺省不取（组件自备数据的 v2 形态仍可用）。params 拼 query（client.get 无 params 形参）。 */
export function useDeclaredQuery(pid: string, data?: DataDecl) {
  const invalid = data ? validateDataDecl(data) : null
  const qs = data?.params
    ? '?' + Object.entries(data.params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
    : ''
  return useQuery({
    queryKey: ['provider', pid, 'slotData', data?.path, data?.params],
    queryFn: () => apiFor(pid).get<unknown>(data!.path + qs),
    enabled: Boolean(data) && !invalid,
    staleTime: data?.staleTime ?? 30_000,
  })
}
