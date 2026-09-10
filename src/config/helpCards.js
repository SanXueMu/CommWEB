/** 阅读卡片内容：纯数据，HelpCardModal 只渲染不持有文案。 */
export const HELP_CARDS = [
    {
        title: '这里是什么',
        body: '工具库是 CommAND 注册表的前端货架。每个工具只需一份 tool.toml 清单，刷新即自动上架——零前端代码。',
    },
    {
        title: '如何让工具上架',
        body: '在 CommAND 的 tools/ 下建目录，写 tool.toml（id / 输入输出 schema / runtime 形态），执行 register 即可。表单由 input_schema 自动推导。',
    },
    {
        title: '标签从哪来',
        body: '标签写在 tool.toml 的 [tool] tags 里，随注册进入注册表，用于左侧筛选。建议用稳定的类型词（文本 / 表格 / 文档…）。',
    },
    {
        title: 'ToolFace 协议',
        body: 'schema 推导为基线（零代码可用），[ui] 声明为增强（改文案 / 换控件 / 排序），render 声明改善输出呈现。协议住进 manifest，随 API 下发。',
    },
];
