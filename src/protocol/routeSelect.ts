/**
 * 声明驱动的文件路由与附加参数（通用协议逻辑，零业务知识）。
 * 供 translate.studio 等工作台按声明 props.routes / props.params 通用消费。
 */

export interface Route {
  ext: string[]
  flow: string
  label?: string
  /** 供「系统探测」自动选流：text=有文字层, scanned=扫描件（图片翻译） */
  for?: string
  /** 声明标记为本轮不处理（PPT 等）：入队后暂停留档，导出时放原文件 */
  skip?: boolean
}

export interface ParamField {
  name: string
  label: string
  /** select=下拉；combo=可选可手写（AutoComplete）；text=纯输入（缺省） */
  type?: 'select' | 'text' | 'combo'
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

/** 探测结论（CommAND GET /files/probe 的返回子集）。 */
export interface FileProbe {
  kind?: string
  pages?: number | null
  has_text_layer?: boolean | null
  image_max_pages?: number | null
}

/** 探测结论 → 选流：扫描件（无文字层）选声明 for='scanned' 的路由，有文字层选 for='text'。
 *  用户显式选过处理方式（preferred）时一律尊重；无声明标记时回落按扩展名分流。 */
export function routeForProbe(
  file: string | undefined, routes: Route[], probe?: FileProbe, preferred?: string,
): string | undefined {
  if (preferred) return preferred
  if (probe?.kind !== 'pdf' || probe.has_text_layer === null || probe.has_text_layer === undefined) {
    return flowForFile(file, routes)
  }
  const want = probe.has_text_layer ? 'text' : 'scanned'
  const matched = matchRoutes(file, routes).find((r) => r.for === want)
  return matched?.flow ?? flowForFile(file, routes)
}

/** 图片翻译页数上限（探测端点回传）；超出需拆分。 */
export function imagePageLimit(probe?: FileProbe): number | undefined {
  const limit = probe?.image_max_pages
  return typeof limit === 'number' && limit > 0 ? limit : undefined
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
