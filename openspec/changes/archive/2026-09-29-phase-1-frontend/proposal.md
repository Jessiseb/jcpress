# Proposal: phase-1-frontend

## Why

一期前端此前是「边做边定」：视觉语言、页面结构、交互纪律散落在 `docs/` 的多份设计与决策文档里，OpenSpec 侧没有任何 change 与主干 spec。结果是**没有可归档的契约**——后续 M3（文章详情页）想改动首页或视觉语言时，没有基线可以写 delta，也无法判断某次改动是否破坏了既有约定。

本 change 把一期**已交付并验收通过**的前端成果回溯补成正式 artifacts 并归档，同时建立项目第一批主干 spec。

## What Changes

- 新增主干 spec（能力）：`homepage`、`site-shell`、`visual-language`、`tech-article-list`。
- 记录一期的**行为契约**：首页各区块的内容与呈现约定、站点外壳（导航/主题/路由/占位页/404）的可用性约定、视觉语言的可用与**禁用**清单（图案只允许一种、禁止合成字重、hover 不得承载唯一信息、装饰性渐变白名单）、技术分享列表页在无详情页阶段的可用形态。
- 归档 `phase-1-frontend`：`openspec/changes/archive/2026-09-29-phase-1-frontend/`。
- **不新增任何功能代码**：本 change 是对既有已交付成果的记录与归档，`tasks.md` 中的任务全部为已完成状态。

## Capabilities

### New Capabilities

- `homepage`: 首页（关于我）的内容契约与呈现约定 —— 首屏信息层次、四个量化结果的完整性、实习经历排序、项目经历的可展开详情与键盘可达、教育与荣誉、联系方式（手机号不上站）、标题层级。
- `site-shell`: 全站外壳的可用性约定 —— 悬浮胶囊顶栏与窄屏抽屉、亮暗主题与首屏不闪白、占位页与 404 不得白屏、触摸目标 ≥44px、四档宽度无横向滚动、`prefers-reduced-motion` 降级。
- `visual-language`: 全站视觉语言的契约与**禁令** —— 图案只有「环装置」一种语言且静止、双主题共用一套结构、展示字必须真字重（禁合成）、斜体只给 Latin、等宽字不得用于含中文的句子、hover 不得承载唯一信息、装饰性渐变白名单、首屏体积预算。
- `tech-article-list`: 「技术分享」列表页在**无详情页阶段**的可用形态 —— 计数取自数据长度、列表项不提供链接（避免死链）、空态给出下一步方向、窄屏降级。

### Modified Capabilities

无（项目此前没有任何主干 spec）。

## Impact

- **文档与契约**：新增 `openspec/specs/{homepage,site-shell,visual-language,tech-article-list}/spec.md`（由归档时的 sync 生成）。
- **代码**：无改动。本 change 描述的代码已在 `main`（`eb90815`）上并已通过验收。
- **验收证据**（可复核）：`npx tsc --noEmit` 0 错误；`vitest` 5 文件 / 25 用例；浏览器行为断言 26/26；对比度审计亮暗各 227 处文本未达标 0；四视口（1280 / 768 / 390）`scrollWidth === clientWidth`；生产构建 `JS gzip 76.44KB`、`CSS gzip 6.75KB`。
- **验收工具**：`.tmp/tools/` 下的断言与审计脚本（行为断言、对比度审计、令牌探针、环周期探针、字体探针、元素裁图）。
- **已知未覆盖**：Lighthouse 移动端评分与真机（iOS Safari / Android Chrome）验证未做；后端（M1）、文章详情页与 Markdown 渲染（M3 剩余）、后台与部署（M5/M6）不属于本期。
