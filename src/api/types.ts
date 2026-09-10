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

export interface Task {
  providerId?: string
  handle: string
  tool_id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'failed_review' | 'cancelled' | 'interrupted'
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: { kind: string; message: string } | null
  pipeline_run: string | null
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
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
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
  steps: { step_index: number; tool: string; latest: StepLatest | null }[]
}

export interface PipelineStep {
  tool: string
  input: Record<string, string | number | boolean | null>
}

export interface PipelineSummary {
  providerId?: string
  id: string
  name: string
  steps: PipelineStep[]
  doc_md?: string | null
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
    status: 'running' | 'succeeded' | 'failed' | string
    error: { kind: string; message: string } | null
    created_at: string
    finished_at: string | null
  }
  tasks: Task[]
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
