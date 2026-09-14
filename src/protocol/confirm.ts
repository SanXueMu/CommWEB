/**
 * 通用确认弹窗协议层（纯逻辑，可脱 UI 独立测试）。
 *
 * 弹窗本体（components/ConfirmDialog）只负责「渲染选项、把选中的 value 解回去」；
 * 选项形态、返回值语义与调用侧映射全部在这里描述——新增一种多选项确认只需加一个构造器。
 */

/** 选项规格：value 为泛型返回值，label/description 由调用侧给定的文案注入。 */
export interface ConfirmOption<T> {
  value: T
  label: string
  /** 选项补充说明（弹窗内以次要文字展示，解释两种口径的差异） */
  description?: string
  /** 危险动作（删除类），UI 以 danger 样式呈现 */
  danger?: boolean
}

/** 确认结果：选中项的 value；取消/关闭为 null。 */
export type ConfirmResult<T> = T | null

/** 删除任务的两种口径。 */
export type DeleteRunMode = 'keep' | 'purge'

export interface DeleteRunLabels {
  keep: string
  keepDesc: string
  purge: string
  purgeDesc: string
}

/** 删除任务弹窗的选项（保留文件 / 含产物文件）。 */
export function deleteRunOptions(labels: DeleteRunLabels): ConfirmOption<DeleteRunMode>[] {
  return [
    { value: 'keep', label: labels.keep, description: labels.keepDesc },
    { value: 'purge', label: labels.purge, description: labels.purgeDesc, danger: true },
  ]
}

/** 选中项 → 删除请求参数；取消（null）不产生请求。 */
export function deleteRunParams(mode: ConfirmResult<DeleteRunMode>): { purgeFiles: boolean } | null {
  if (mode === null) return null
  return { purgeFiles: mode === 'purge' }
}

/** 按 value 反查选项（调用方可据此渲染「已按 X 删除」之类回执）。 */
export function optionByValue<T>(options: ConfirmOption<T>[], value: T): ConfirmOption<T> | undefined {
  return options.find((o) => o.value === value)
}
