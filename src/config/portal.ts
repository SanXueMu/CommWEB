/** 门户文案配置：站点级文字唯一来源（组件与页面不得自带文案）。 */

export const PORTAL = {
  siteName: 'CommWEB',
  footer: 'CommWEB · CommAND 之上的筋络 · 小工具与全自动流零前端代码自动上架',
  nav: {
    tools: '工具库',
    flows: '流工具',
    tasks: '任务中心',
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
}

/** 状态分组展示标签（组语义由 CommAND /api/meta/statuses 下发，标签属门户文案）。 */
export const STATUS_GROUP_LABELS: Record<string, string> = {
  active: '进行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
}
