/**
 * 声明驱动的文件路由与附加参数（通用协议逻辑，零业务知识）。
 * 供 translate.studio 等工作台按声明 props.routes / props.params 通用消费。
 */

export interface Route {
  ext: string[]
  flow: string
  label?: string
}

export interface ParamField {
  name: string
  label: string
  type?: 'select' | 'text'
  options?: { value: string; label: string }[]
  default?: string
  placeholder?: string
  when_flow?: string[]
}

/** 按文件扩展名匹配全部候选路由（同后缀多条 → 由用户选择）。 */
export function matchRoutes(file: string | undefined, routes: Route[]): Route[] {
  if (!file) return []
  const lower = file.toLowerCase()
  return routes.filter((r) => r.ext.some((e) => lower.endsWith(e.toLowerCase())))
}

/** 附加参数按选中流过滤（无 when_flow 恒显示）。 */
export function visibleParams(params: ParamField[], flow?: string): ParamField[] {
  return params.filter((p) => !p.when_flow || (flow !== undefined && p.when_flow.includes(flow)))
}

/** 参数默认值初始化。 */
export function defaultParams(params: ParamField[], flow?: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of visibleParams(params, flow)) out[p.name] = p.default ?? ''
  return out
}
