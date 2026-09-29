# Proposal: phase-2-visual

## Why

二期提了三件事——**字体更大气、首页排版不再「太硬」、背景要「灵动」**。三件事指向同一个障碍：一期的视觉语言是刻意「克制的编辑式」气质（静止、无卡片、只有一种图案、真字重只有一档、禁止视差与滚动进度条），而这三条需求要的正是它的反面。

用户为此贴来两份参考组件（`background-paths` 的流线动画、滚动 globe 落地页的视差与进度条），并两次强调「这只是参考，还得根据项目具体情况实现」。这些参考的**每一条技术前提**都与一期已归档、且**有断言守着**的纪律正面冲突（Tailwind/shadcn/lucide/motion ↔ decisions #43；循环流动 ↔ 图案纪律 #19 与禁止清单；视差/进度条 ↔ 禁止清单；加粗 ↔ `--ds-fw-display: 500` 真字重上限；卡片化 ↔ #46 与圆角 8px 上限）。

一期自己留下了处理这种局面的元规则（`docs/decisions.md:86`）：

> 「mock 被选中之后，它就不再是「示意」，而是验收标准；实现阶段要偏离，必须显式提出并得到确认，不能默默收敛。」

因此本 change 的重点**不是"加几个效果"，而是把纪律本身改写成新的、仍然可验证的版本**：允许流线、允许滚动联动、允许有限面板化，但每一处解禁都配一条可观测的剂量上限与断言。

## What Changes

- **图案语言（BREAKING：纪律改写）**：新增流线背景层（内联 SVG，36 条路径 × 2 组镜像，`viewBox 696×316`，零网络请求）；「环」从首屏布景**退役为标记层**（项目徽标、频道页徽标、页脚）。图案从「只有一种」改为「两种、有主次」。
- **允许循环流动**：流线以 `pathLength="1"` + `stroke-dasharray/dashoffset` 关键帧沿路径流动，周期 20–30s，**确定性错峰**（不使用 `Math.random()`，保证截图与断言可复现）。
- **解禁两条禁止令（滚动进度条 + 视差）**：以「**只作用于装饰层** + 剂量上限（位移 ≤ 视口高度 8%、缩放 ≤ 1.06）」的形态写入 spec；正文、数据与控件**一律不参与**滚动联动。
- **字体加档**：新增 `serif-sc-700.woff2` 展示字子集（**只打包展示字**；实测 **9.0KB / 45 字**，设计时预估 30–50KB，实测低得多），`@font-face` 的 `unicode-range` 仍只认 CJK（Latin 继续走 Georgia 真粗体）。只给 `h1`/`h2` 与关键数字用 700，正文与导语保持 500。姓名 96→104px、区块标题 30→34px。
- **排版软化（BREAKING：纪律改写）**：大节/小节留白交替（96/48px）；不对称栅格（标题列 3/12、内容列 8/12 错位，`≤719px` 塌回单列）；玻璃面板 + 圆角 14px，**只用于「关键数字」与「项目经历」两类区块**——#46「不做卡片」与圆角 8px 上限被改写为「有限面板化」，而不是全面卡片化。
- **范围**：全站字体令牌与全站背景层；首页七区块重排；内部页（`/tech` 等）只保证不穿帮，不重排。
- **验收扩容**：渐变护栏合法宿主 4 → 6 类（+ 流线层、玻璃面板）；新增滚动联动剂量、字体覆盖完整性、移动端性能三类断言；补跑一期遗留的 Lighthouse 移动端。

## Capabilities

### New Capabilities

（无。二期没有引入新的能力域：图案、排版、资源预算与降级都属于既有的 `visual-language`，版面节奏属 `homepage`，滚动指示与降级属 `site-shell`。）

### Modified Capabilities

- `visual-language`：图案语言（一种 → 流线布景 + 环标记，且环静止条款被替换为可循环流动）、渐变宿主白名单（4 → 6 类）、展示字真字重（单档 500 → 500/700 两档，且展示字全集必须被 700 子集覆盖）、资源预算（新增移动端路径分档），并新增「滚动联动只作用于装饰层且有剂量上限」「常驻背景动画的移动端性能判据」「玻璃面板表面的文字对比度」三条要求。
- `homepage`：新增「版面节奏与不对称栅格」「重点区块的面板化」两条要求；「首屏信息层次」补充「背景流线层不遮挡正文、不进入无障碍树」场景。
- `site-shell`：新增「滚动进度指示」要求；「减少动态效果降级」的适用范围从入场序列扩展到**常驻背景动画与滚动联动**（流线静止、视差不生效，但进度条作为信息仍在）。

## Impact

- **前端样式**：`frontend/src/styles/theme.jcpress.css`（流线/面板/字体新令牌）、`frontend/src/styles/global.css`（节奏、面板、不对称栅格、进度条）。
- **新增组件与 hook**：`frontend/src/components/visual/FlowField.tsx` + `FlowField.module.css`、`frontend/src/hooks/useScrollProgress.ts`。
- **改动的现有组件**：`components/home/Hero.*`（背景层换流线、104px/700）、各区块 `*.module.css`（节奏与面板）、`components/layout/TopNav.*`（可能的进度条挂载点）、`index.html`（700 字体预加载）。
- **字体流水线**：`frontend/scripts/build-font-subset.cjs` 参数化字重与「仅展示字」模式；新增 `frontend/public/fonts/serif-sc-700.woff2`；新增 `frontend/scripts/audit-display-font.cjs`（展示字覆盖断言）。
- **验收工具**：`.tmp/tools/audit-behavior.cjs` 扩容；新增 `.tmp/tools/audit-perf.cjs`（移动端性能判据）。
- **文档**：`docs/decisions.md`（追加纪律修订条目）、`openspec/specs/visual-language|homepage|site-shell/spec.md`（archive 时同步主干）、`docs/dev-journal.md`。
- **依赖**：**不新增任何运行时依赖**。Tailwind / shadcn / lucide / motion 一律不引入；若动画质感验收不达标，引入 motion 将作为独立 change 另行提出（本 change 的逃生舱条款）。
- **不受影响**：首页信息结构（区块顺序、字段、`<dt>` 数量、`<h3>` 数量等一期断言口径一律不动）、后端与接口、`tech-article-list` 能力。
