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
  /** 按流覆盖默认值：同一参数在不同路由下默认不同（如 mode 版式流默认 overlay、Word 流默认 bilingual）。 */
  default_by_flow?: Record<string, string>
  placeholder?: string
  when_flow?: string[]
}

/** 不支持的后缀规则（声明驱动，如旧版 .doc 需另存为 .docx）。 */
export interface UnsupportedRule {
  ext: string[]
  message: string
}

/** 按文件扩展名匹配全部候选路由（同后缀多条 → 由用户选择）。 */
export function matchRoutes(file: string | undefined, routes: Route[]): Route[] {
  if (!file) return []
  const lower = file.toLowerCase()
  return routes.filter((r) => r.ext.some((e) => lower.endsWith(e.toLowerCase())))
}

/** 单文件与批量共用的分流：用户显式选的流若仍匹配则优先，否则取第一条匹配。 */
export function flowForFile(file: string | undefined, routes: Route[], preferred?: string): string | undefined {
  const matched = matchRoutes(file, routes)
  return matched.some((r) => r.flow === preferred) ? preferred : matched[0]?.flow
}

/** 附加参数按选中流过滤（无 when_flow 恒显示）。 */
export function visibleParams(params: ParamField[], flow?: string): ParamField[] {
  return params.filter((p) => !p.when_flow || (flow !== undefined && p.when_flow.includes(flow)))
}

/** 参数默认值：按流覆盖优先，其次声明 default。 */
export function paramDefault(field: ParamField, flow?: string): string {
  if (flow !== undefined) {
    const byFlow = field.default_by_flow?.[flow]
    if (byFlow !== undefined) return byFlow
  }
  return field.default ?? ''
}

/** 参数默认值初始化。 */
export function defaultParams(params: ParamField[], flow?: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of visibleParams(params, flow)) out[p.name] = paramDefault(p, flow)
  return out
}

/** 命中不支持的后缀 → 返回声明里的提示文案（未命中返回 undefined）。 */
export function matchUnsupported(file: string | undefined, rules: UnsupportedRule[]): string | undefined {
  if (!file) return undefined
  const lower = file.toLowerCase()
  return rules.find((r) => r.ext.some((e) => lower.endsWith(e.toLowerCase())))?.message
}

/** 声明里全部受支持的后缀（用于提示文案，去重且保持声明顺序）。 */
export function supportedExtensions(routes: Route[]): string[] {
  return [...new Set(routes.flatMap((r) => r.ext.map((e) => e.toLowerCase())))]
}
