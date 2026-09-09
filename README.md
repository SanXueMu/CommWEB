# CommWEB

CommAND 骨架之上的筋络——通用工具前端门户。工具零前端代码即自动获得完整界面（ToolFace 协议）。

> 铁律：CommWEB 只与 CommAND API 对话，永不直连工具、永不直连数据库。

## 启动

```bash
npm install
npm run dev        # :5173，proxy /api → CommAND(:8800)
npm run build      # 类型检查 + 产物
npm test           # protocol 层纯函数测试
```

CommAND 侧需先 `uv run main.py serve` 并 `uv run main.py register` 注册工具。

## 架构（四层单向）

```
pages（装配）→ components（交互）→ protocol（解析）→ api（出站）
theme 横切注入；服务端态 = TanStack Query，UI 态 = theme store
```

红线：pages 不直接 import api；components 不解析原始 schema（必须经 protocol）；api 层不含 UI 知识。

```
src/
├── api/          # CommAND typed 客户端（唯一出站通道）
├── protocol/     # ToolFace：resolver / widgets / renderers（纯函数，可单测）
├── components/   # AppHeader / DataListPanel（通用列表）/ HelpCardModal / ToolForm / EventStream / ResultRenderer / TaskDrawer
├── pages/        # ToolsHub（工具库）/ Tasks / ToolDetail（薄装配）
└── theme/        # design tokens 三预设 + localStorage 持久化
```

## 状态色板（与任务生命周期严格一致）

queued 蓝 / running 橙 / succeeded 青绿 / failed_review 紫 / 其余终态灰

## 架构体检记录

| 日期 | 变更摘要 | 单组件>300行? | 数据流单向? | 反模式命中? | 新工具零代码入前端? | 处置 |
|------|----------|---------------|-------------|-------------|--------------------|------|
| 2026-09-09 | 初始骨架（api/protocol/components/pages/theme 五层 + 三页 + 五组件） | 否（最大 TaskDrawer ~90 行） | 是（pages→components→protocol→api 无越级） | 否 | 是（dev.string.reverse / text.llm.translate 零代码上架，表单自动生成） | 通过 |
| 2026-09-09 | 美术重构（packy 风格）：白底细灰线 / AppHeader / DataListPanel 通用列表（卡片/列表双形态+输入即检）/ 工具库左标签筛选 + 阅读卡片弹窗 / 任务中心同构套用 / tags 链路 | 否 | 是（筛选与过滤留 pages，渲染下沉组件） | 否 | 是（tags 随 register 下发即筛选用） | 通过 |

五列体检项：① 单组件 >300 行？② 数据流单向？③ 反模式（巨型 page/复制粘贴组件/绕过 protocol/绕过 api/内联魔法色值）？④ 新工具零代码入前端（回归测试）？⑤ UI 声明是否仍最简？
