/** 门户文案配置：站点级文字唯一来源（组件与页面不得自带文案）。 */

export const PORTAL = {
  siteName: 'CommWEB',
  footer: 'CommWEB · CommAND 之上的筋络 · 小工具与全自动流零前端代码自动上架',
  nav: {
    tools: '工具库',
    flows: '流工具',
    tasks: '任务中心',
    workspace: '工作区',
  },
  sidebar: {
    tags: '标签',
    status: '状态',
  },
  search: {
    tools: '搜索工具（名称 / id / 描述 / 标签）',
    flows: '搜索流（名称 / id / 步骤工具）',
    tasks: '搜索任务（工具 / handle / 状态）',
  },
  empty: {
    tools: '暂无工具——先在 CommAND 侧 register',
    flows: '暂无流工具——先在 CommAND 侧注册管线',
    tasks: '暂无任务',
    noTags: '（工具暂无标签）',
    workspace: '工作区还是空的——从工具库或流工具打开一个，即可在此多开工作',
  },
  footNote: {
    tools: '零前端代码自动上架',
    flows: '管线步骤可在任务中心逐步追踪',
  },
  form: {
    filePathPlaceholder: '本地路径（绝对路径）',
    tagsPlaceholder: '回车逐项添加',
  },
  run: {
    submit: '提交任务',
    formTitle: '运行（表单由 input_schema 自动生成）',
  },
  flowFailedPrefix: '流运行失败：',
  workspace: {
    pause: '暂停',
    resume: '恢复',
    abort: '中止',
    rerun: '重跑此步',
    rerunTitle: '断点重跑（以留档输入为底，可字段级覆盖）',
    overridePlaceholder: 'JSON 字段覆盖，如 {"model": "deepseek-v4-pro"}',
    newRound: '新开一轮',
    pausedHint: '暂停中（等待当前节点完成后停在边界）',
    runningHint: '运行中——暂停将在当前节点完成后生效',
  },
}

/** run_events 审计事件展示标签（kind 语义由 CommAND 定义，标签属门户文案）。 */
export const RUN_EVENT_LABELS: Record<string, string> = {
  created: '创建',
  step_queued: '步骤入队',
  step_started: '步骤开始',
  step_completed: '步骤完成',
  step_failed: '步骤失败',
  step_cancelled: '步骤取消',
  pause_requested: '请求暂停',
  paused_at_boundary: '停在边界',
  resume_requested: '请求恢复',
  resumed: '已恢复',
  abort_requested: '请求中止',
  run_aborted: '已中止',
  step_abort: '节点中止',
  rerun_requested: '请求重跑',
  step_rerun: '断点重跑',
  override_applied: '参数覆盖',
}

/** 状态分组展示标签（组语义由 CommAND /api/meta/statuses 下发，标签属门户文案）。 */
export const STATUS_GROUP_LABELS: Record<string, string> = {
  active: '进行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
}
