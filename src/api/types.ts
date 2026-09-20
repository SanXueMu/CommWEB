/** 与 CommAND schemas/模型同构的类型（api 层唯一类型源）。 */

export interface ToolSummary {
  providerId?: string
  id: string
  name: string
  version: string
  description: string
  input_types: string[]
  output_types: string[]
  runtime_kind: 'inproc' | 'subprocess' | 'http'
  path?: string | null
  tags?: string[]
  enabled?: boolean
  hidden?: boolean
  category?: string
  subcategory?: string
}

export interface ToolCategoryInfo {
  name: string
  subs: string[]
}

export interface ToolStats {
  executions: number
  success_rate: number | null
  avg_seconds: number | null
}

export interface ToolManifest {
  tool: { id: string; name: string; version: string; description: string; tags?: string[] }
  io: {
    input_schema: Record<string, unknown>
    output_schema: Record<string, unknown>
    input_types: string[]
    output_types: string[]
  }
  runtime: { kind: string; entry: string; sync?: boolean }
  doc_md?: string | null
  resources: { timeout_s: number; concurrency: number; max_attempts: number }
  ui?: UiDecl
}

export type ToolDetail = ToolSummary & { manifest: ToolManifest }

export interface UiDecl {
  order?: string[]
  group?: Record<string, string>
  field?: Record<string, { widget?: string; label?: string; help?: string; placeholder?: string }>
  submit_label?: string
  render?: { highlight?: string[] }
}

export type TaskKind = 'tool' | 'flow' | 'workflow'

export interface Task {
  providerId?: string
  handle: string
  tool_id: string
  tool_name?: string
  pipeline_name?: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'failed_review' | 'cancelled' | 'interrupted'
  /** 列表接口不再返回整段载荷（翻译步骤可达数 MB）；完整值走单任务详情接口。 */
  input?: Record<string, unknown>
  output?: Record<string, unknown> | null
  error: { kind: string; message: string; hint?: string | null;
    /** 非空表示该失败已按 on_failure 自动降级到这条流 */
    fallback_flow?: string | null } | null
  pipeline_run: string | null
  task_kind?: TaskKind
  root_run_id?: string | null
  root_pipeline_id?: string | null
  step_index: number
  attempt: number
  max_attempts: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface TaskEvent {
  id: number
  type: 'log' | 'progress' | 'artifact'
  data: Record<string, unknown>
  created_at: string
}

export interface TaskCreated {
  handle: string
  status: string
}

export interface StatusInfo {
  value: string
  label: string
  group: string
  terminal: boolean
}

export interface RunEvent {
  id: number
  task_handle: string | null
  kind: string
  actor: string
  detail: Record<string, unknown>
  created_at: string
}

export interface StepLatest {
  step_index: number
  handle: string
  status: string
  attempt: number
  /** 步跟踪来自列表接口：载荷可能不下发（完整值走任务详情）。 */
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
}

export interface RunSnapshot {
  run: {
    id: string
    pipeline_id: string
    status: string
    progress?: number | null
    error?: unknown
    input?: Record<string, unknown>
    created_at?: string
    finished_at?: string | null
  }
  steps: {
    step_index: number
    tool: string
    pipeline?: string | null
    latest: StepLatest | null
    skipped?: boolean
    subrun?: { run_id: string; status: string; pipeline_id: string } | null
  }[]
}

export interface PipelineStep {
  tool?: string
  pipeline?: string
  when?: Record<string, unknown> | null
  input: Record<string, unknown>
}

export interface PipelineSummary {
  providerId?: string
  id: string
  name: string
  steps: PipelineStep[]
  doc_md?: string | null
  type?: 'flow' | 'workflow'
  input_schema?: Record<string, unknown> | null
}

export interface PipelineRunCreated {
  run_id: string
  status: string
}

export interface PipelineRun {
  run: {
    id: string
    pipeline_id: string
    input: Record<string, unknown>
    batch_id?: string | null
    status: 'running' | 'succeeded' | 'failed' | string
    error: { kind: string; message: string; hint?: string | null;
    /** 非空表示该失败已按 on_failure 自动降级到这条流 */
    fallback_flow?: string | null } | null
    created_at: string
    finished_at: string | null
  }
  tasks: Task[]
  summary?: RunSummary['summary']
  /** AF4：任务输出里指向、但盘上已不存在的产物路径（前端标「已删除」） */
  missing_artifacts?: string[]
}

export interface FileUploaded {
  path: string
  name: string
  size: number
}

export interface OcrKey {
  name: string
  provider: string
  base_url: string
  api_key: string
  is_default: boolean
}

/** 批次摘要（GET /files/batches 全量清单项）。 */
export interface BatchInfo {
  id: string
  root: string
  files: number
  created_at: string
}

export interface RunSummary {
  id: string
  pipeline_id: string | null
  input: Record<string, unknown>
  status: string
  /** 批次：一次目录/压缩包上传 = 一个批次（批量导出按批次还原原目录结构）。 */
  batch_id?: string | null
  /** 非空表示本 run 是「因原 run 能力不可用而自动降级」产生的（指向原 run）。 */
  fallback_of?: string | null
  error: { kind: string; message: string; hint?: string | null;
    /** 非空表示该失败已按 on_failure 自动降级到这条流 */
    fallback_flow?: string | null } | null
  progress?: number | null
  created_at: string
  finished_at: string | null
  summary?: {
    artifacts?: { name?: string; path?: string }[]
    steps_total?: number | null
    steps_done?: number
    usage?: { prompt_tokens: number; completion_tokens: number } | null
    usage_by_model?: Record<string, { calls: number; prompt_tokens: number; completion_tokens: number }> | null
    calls?: number | null
    cache_hits?: number | null
    review_count?: number | null
    ok_count?: number | null
    /** X4：识别部分页失败数（未达熔断线时 run 落 succeeded）——徽标与「重试失败页」依据 */
    failed_pages?: number | null
    records_count?: number | null
    steps_skipped?: { step_index?: number; reason?: string }[] | null
    /** AA3：hook/勾稽告警数（校验不平、宽松修复等） */
    review_notes_count?: number | null
    /** AB2：running 时最新工具进度消息（「已识别 12/42 页」） */
    latest_note?: string | null
  }
}

export interface TranslateTemplate {
  id: string
  name: string
  desc?: string | null
  source_lang?: string | null
  target_lang?: string | null
  model?: string | null
  /** 业务领域（图片翻译的 domainHint，如「审计财务」） */
  domain_hint?: string | null
  terms?: [string, string][]
  terms_count?: number
  builtin?: boolean
  enabled?: boolean
}

export interface TranslateDictEntry {
  source: string
  translated: string
  model: string | null
  status: string
}

export interface OcrDbFile {
  path: string
  name: string
  size: number
  modified: string
}

export interface PipelineDefinition {
  id: string
  name: string
  steps: { tool: string; input: Record<string, unknown> }[]
  doc_md?: string | null
  status?: string
}
