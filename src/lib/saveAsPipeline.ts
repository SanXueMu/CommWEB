/** 三件套→管线 通用组装器（纯壳准则：组装规则来自会员声明 save_as，本模块零业务知识）。
 *
 *  引用语法（字符串值整体匹配才做类型保持替换，否则原样保留）：
 *  - {{input.X}}    → 本次运行输入的 X 字段
 *  - {{spec.a.b.c}} → 生成产物 specOut.normalized（或根）下点路径取值
 */

export interface SaveAsStepDecl {
  tool: string
  input: Record<string, unknown>
}

export interface SaveAsDecl {
  button_label?: string
  pipeline_prefix: string
  pipeline_name_from_input?: string
  steps: SaveAsStepDecl[]
}

function getByPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node == null ? node : (node as Record<string, unknown>)[key]), source)
}

function resolveValue(value: unknown, input: Record<string, unknown>, spec: unknown): unknown {
  if (typeof value !== 'string') return value
  const inputMatch = value.match(/^\{\{input\.([\w-]+)\}\}$/)
  if (inputMatch) return input[inputMatch[1]]
  const specMatch = value.match(/^\{\{spec\.([\w.[\]-]+)\}\}$/)
  if (specMatch) return getByPath(spec, specMatch[1].replace(/^\./, ''))
  return value
}

export function resolveTemplate(value: unknown, input: Record<string, unknown>, spec: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, input, spec))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveValue(v, input, spec)]))
  }
  return resolveValue(value, input, spec)
}

/** 按 save_as 声明组装管线定义；返回 null 表示产物/输入不齐（调用方提示）。 */
export function buildPipelineFromSaveAs(
  decl: SaveAsDecl,
  runInput: Record<string, unknown>,
  specOutput: unknown,
): { id: string; name: string; steps: { tool: string; input: Record<string, unknown> }[] } | null {
  const spec = (specOutput && typeof specOutput === 'object' && 'normalized' in (specOutput as Record<string, unknown>)
    ? (specOutput as Record<string, unknown>).normalized
    : specOutput) as unknown
  const steps = decl.steps.map((step) => ({
    tool: step.tool,
    input: resolveTemplate(step.input, runInput, spec) as Record<string, unknown>,
  }))
  if (steps.some((s) => Object.values(s.input).some((v) => typeof v === 'string' && v.includes('{{')))) {
    return null
  }
  const nameSeed = decl.pipeline_name_from_input
    ? String(runInput[decl.pipeline_name_from_input] ?? '')
        .replace(/[^\w\u4e00-\u9fff]+/g, '')
        .slice(0, 8)
    : 'custom'
  const id = `${decl.pipeline_prefix}${nameSeed || 'custom'}`
  return { id, name: `自定义管线：${nameSeed}`, steps }
}
