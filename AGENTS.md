# CommWEB AGENTS.md — 纯壳准则（2026-09-10 用户申明，最高优先级）

## 纯壳准则：CommWEB 代码零业务内容

> **申明原文**（2026-09-10）：CommWEB 禁止出现任何会员的业务代码/数据。任何会员在被注册以及每次热部署后，业务相关数据一律存入该会员的 PG 库；CommWEB 本身不存有任何业务内容。

### 禁止（违例即返工）

| 禁止项 | 违例案例（2026-09-10 已返工） |
|---|---|
| 业务页面 | `pages/OcrWorkbench`（写死 `flow.ocr.*` 流 ID、`ocrdb.extract.units` 工具名） |
| 业务默认值 | `provider: 'dashscope'`、内置视图名清单、提示词示例文本 |
| 业务声明入代码 | `DEFAULT_SITE` 里写死 `ocr.workbench` / `settings.keys` 等会员视图 |
| 工具/流/端点名硬编码 | 组件里直接引用 `records.view.query`、`/data/dbs` 之外的任何业务端点选择 |

### 允许（协议层白名单）

1. **通用视图类型**（协议组件，声明驱动）：`tools.grid` / `flows.list` / `tasks.table` / `workspace.tabs` / `tools.detail` / `flows.detail` / `data.browser` / `pipeline.studio` / `settings.keys`
2. **协议端点**：`/meta/site`、`/meta/statuses`、`/api/tools*`、`/api/pipelines*`、`/api/pipeline-runs*`、`/api/tasks*`、`/api/files*`、`/api/keys*`、`/api/data/dbs`（数据源选择器属协议能力）
3. **空站点兜底**：`DEFAULT_SITE = { views: [] }` + `EmptySiteGuide` 引导页（提示等待会员声明）
4. **业务 props 全部来自声明**：视图组件经 `useViewProps()`（ViewPropsContext）读取站点声明注入的 props；业务知识（流 ID 清单/内置视图名/组装规则）只存在于声明 JSON 数据中

### 数据流（业务知识的唯一合法路径）

```
CommAND（业务侧，PG site_views/pipelines/keys 表）
  → GET /meta/site（站点声明：view type + props，业务数据全在 props JSON）
  → CommWEB parseSite（声明→路由/导航，ViewScope 注入 props）
  → 通用视图组件（纯渲染 + 协议执行器，零业务判断）
```

### 评审检查单（新视图类型/组件准入前自问）

- [ ] 组件里有没有出现任何具体工具名 / 流 ID / 视图名 / provider 默认值？
- [ ] 换一个会员（不同业务）复用该组件，是否零代码改动、仅改声明？
- [ ] 新增文案是否包含业务语义（应移入声明 props）？
