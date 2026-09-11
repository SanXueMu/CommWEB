/** 门户文案配置：站点级文字唯一来源（组件与页面不得自带文案）。 */

export const PORTAL = {
  siteName: 'CommWEB',
  footer: 'CommWEB · CommAND 之上的筋络 · 小工具与全自动流零前端代码自动上架',
  home: {
    title: '选择系统',
    subtitle: (n: number) => `共 ${n} 个已登记系统 · 点击进入`,
    manage: '管理会员',
    using: '本页正在使用',
    allOffline: '所有系统均不可达——检查网络或代理',
    retry: '重试探测',
    singleHint: '登记更多系统以接入多源渲染',
  },
  nav: {
    tools: '工具库',
    flows: '流工具',
    tasks: '任务中心',
    workspace: '工作区',
  },
  sidebar: {
    tags: '标签',
    status: '状态',
    kind: '分类',
    categories: '总类',
    subcategories: '子类',
    all: '全部',
    clear: '清空筛选',
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
    startFlow: '发起运行',
    startFlowHint: '点击展开运行会话（表单、控制条、步骤轨道与审计轨迹）',
    queued: '已入队：',
    submitFailed: '提交失败：',
    requiredSuffix: '必填',
  },
  toolDetail: {
    lifecycle: '数据转化生命周期',
    performance: '量化性能',
    recentTasks: '近期任务',
    run: '运行',
    executions: '执行次数',
    successRate: '成功率',
    avgSeconds: '平均耗时',
    noTasks: '暂无任务',
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
    skipped: '已跳过（when 条件未满足）',
    subrun: '子流',
    rerunFlowFull: '重跑流（原运行留档，另起新运行）',
    rerunFlowTitle: '重跑流',
    rerunFlowHint: '已按上一轮数据预填；仅修改过的字段作为覆盖提交，原运行留档不受影响。',
    rerunFlowOk: '重跑',
    rerunFlowSuccessPrefix: '已另起新运行 ',
  },
  studio: {
    templateLabel: '识别模版',
    templatePlaceholder: '选择识别规则（决定识别字段与流程）',
    newTemplate: '新建模版',
    dbsTitle: '结果库',
    dbsEmpty: '暂无结果库——完成一次识别后自动生成',
    uploadTitle: '上传识别文件',
    recognize: '开始识别',
    recognizeNoTemplate: '请先选择识别模版',
    recognizeNoFile: '请先上传识别文件',
    recognizeOk: '识别完成',
    recognizeFailedPrefix: '识别失败：',
    export: '导出 xlsx',
    exportOkPrefix: '已导出：',
    exportFailedPrefix: '导出失败：',
    recordsEmpty: '该库暂无记录',
    statusPrefix: '运行状态：',
  },
  toolDisabled: '已停用',
}

/** 流类型展示标签（语义由 CommAND pipelines.type 定义，标签属门户文案）。 */
export const FLOW_TYPE_LABELS: Record<string, string> = {
  flow: '普通流',
  workflow: '工作流',
}

/** 任务三层归类展示标签（语义由 CommAND tasks.task_kind 派生，标签属门户文案）。 */
export const TASK_KIND_LABELS: Record<string, string> = {
  tool: '工具任务',
  flow: '普通流任务',
  workflow: '工作流任务',
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
