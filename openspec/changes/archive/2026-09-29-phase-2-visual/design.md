# Design: phase-2-visual

## Context

动机见 `proposal.md - Why`。这里只记**约束**，因为二期几乎每一步都被一期已归档的规则夹住：

| 约束 | 出处 |
| --- | --- |
| 样式只走 CSS 变量 + CSS Modules；`tokens.curated.css` 是溯源基线保持原样，改动集中在 `theme.jcpress.css` | `docs/decisions.md` #7、`frontend/src/styles/theme.jcpress.css:29-35` |
| 不装 Tailwind / shadcn / lucide-react | #43、`docs/design-visual-language.md:417-423` |
| 入场的隐藏态由 `<html data-reveal="on">` 门控，JS 未运行则正文永远可见 | `frontend/src/hooks/useReveal.ts:10-13`、`global.css:263-283` |
| `data-reveal` 只能用在 HomePage 子树内（页脚挂它会永远停在 `opacity:0`） | #31、`Footer.tsx:11-12` |
| 装饰层三条纪律：`aria-hidden` + `pointer-events:none` + 位于正文之下；**居中不用 transform**、**组件内不写 opacity 过渡** | `RingField.tsx:18-22`、`RingField.module.css:5-9` |
| 装饰性渐变只允许登记过的宿主，断言硬卡「姓名渐变恰好 1 个」 | `.tmp/tools/audit-behavior.cjs:61-63,104-115` |
| `font-synthesis: none` 全局；中文展示字只有一档真字重 500（`serif-sc-500.woff2`，92.7KB / 531 字） | `global.css:37-39`、`theme.jcpress.css:16-24` |
| 首屏 JS ≤ 200KB gzip（当前 76.06KB）；图案零网络请求；断点只有 419 / 719 / 959 / 1440 | `项目前期规划.md:304`、`design-visual-language.md:373-376` |
| 首页结构被断言锁住：一个 `h1`、六个 `h2`、`dt=4`、`h3=3`、首屏两个链接且无 `button` | `.tmp/tools/audit-behavior.cjs:92-103` |

两份参考组件（`background-paths.tsx`、`landing-page.tsx`）在本设计里被当作**效果清单**使用，而不是依赖清单：它们的技术前提（shadcn/Tailwind/framer-motion/lucide/Unsplash）一条都不采用。

## Goals / Non-Goals

**Goals:**

1. 一个**零请求、确定性、可按视口分档**的流线布景层，观感对齐参考组件的流动效果。
2. 滚动进度指示 + 装饰层视差：**只作用于装饰层**，剂量写成可测量的上限。
3. 展示字得到**真 700 字重**，且「展示字字符集合 ⊆ 700 子集」可被断言证明。
4. 首页排版从「每节长得一样」变为**大节/小节交替 + 不对称栅格 + 两处面板**。
5. 纪律修订全部落成 spec 与断言，而不是只改代码。

**Non-Goals:**

- 不引入 Tailwind / shadcn / lucide / framer-motion。引入 motion 是**逃生舱**：仅当流线观感验收不达标，才另开一个 change 提出，本 change 不做。
- 不动首页信息结构：区块顺序、字段、`dt` / `h3` / `h1` 数量口径一律不变。
- 不重排 `/tech`、`/algo`、`/projects`、404：只保证令牌变化后不穿帮。
- 不做图片/插画素材；不引入噪点、网格、斜纹等第三类纹理。
- 不做真机（iOS Safari / Android Chrome）测试。
- 不改后端、接口与数据。

## Decisions

### D1 · 用 SVG 原生 `pathLength` + dash 关键帧复刻 `motion.path`，不引入动效库

参考组件用 framer-motion 的 `pathLength` / `pathOffset` 做「一段光沿路径流动 + 长度呼吸」。**SVG 原生有 `pathLength="1"` 属性**，把每条路径的几何长度归一化，于是：

- 「初始只显示 30%」= `stroke-dasharray: 0.3 0.7`（对应参考的 `initial.pathLength = 0.3`）；
- 「光段沿线前进」= 关键帧把 `stroke-dashoffset` 从 `0` 动到 `-1`（等价 `pathOffset: [0, 1, 0]`）；
- 「长度呼吸」= 关键帧在 `0.3 → 1 → 0.3` 之间改 `stroke-dasharray`。

**替代方案**：(a) 引入 motion 直接照抄——多 34–50KB gzip，并要提前作废两条「不动效库」纪律；(b) 用 CSS `mask` 平移动画模拟——每条路径几何不同，无法用一套 mask 对齐。选 (a) 的唯一理由（"做不到那个效果"）经此验证不成立，故取原生。

**一处刻意偏离参考**：参考用 `Math.random()` 生成长度，会让每次截图的动画相位都不同。我们改成**确定性错峰**：`duration = 20 + (i % 11)` 秒。截图与断言因此可复现——这条不是审美选择，是验收前提。

### D2 · 流线层结构：一个全站 `fixed` 层，路径数由 `matchMedia` 分档

- 组件 `components/visual/FlowField.tsx`：内联 SVG，`viewBox="0 0 696 316"`，36 条路径 × 2 组镜像（position `1` / `-1`），颜色与线宽按索引递增（照参考的公式）。
- 挂载位置：`App.tsx` 的 `main` 之前，`position: fixed; inset: 0; z-index: -1`。首屏不再是单独一层——流线在首屏自然最显眼，向下滚动时它作为背景延续（这也满足「全站背景层」的范围）。
- **分档**：路径数由 `matchMedia` 决定（桌面 36×2 / 平板 24×2 / 手机 12×2），因为「实际渲染的路径数」在断言里要数 DOM 节点，而 CSS `display:none` 藏掉的节点仍会被数到。无 JS 时装饰层不渲染——它是纯装饰，不承载信息，不违背 `useReveal` 的 SEO 纪律。
- 层级纪律沿用环装置（`aria-hidden` + `pointer-events:none` + `z-index:-1`），且**不挂 `data-reveal`**：它是常驻布景，不参与入场编排（一旦参与，`[data-reveal].is-revealed { opacity: 1 }` 会覆盖它自身的透明度——这是 `RingField` 踩过的坑）。
- 动画只触碰 `stroke-dashoffset` / `stroke-dasharray` / `opacity`（不触碰 `transform`），因此与任何 transform 动画互不干扰。

### D3 · 滚动联动：一个 rAF + 一个 CSS 变量，消费方只读

新增 `hooks/useScrollProgress.ts`：单个 `scroll` 监听（passive）+ `requestAnimationFrame` 节流，把进度写成 `<html>` 上的 `--scroll-p`（`0`–`1`，保留 3 位小数）。

- **进度条**（`TopNav` 上层或 `App` 内独立一层）：`transform: scaleX(var(--scroll-p))` + `transform-origin: left`，高 2px，`pointer-events: none`。
- **视差**：只加在带 `data-parallax` 的装饰层上，`translate3d(0, calc(var(--scroll-p) * -6vh), 0)`——**6vh 是给 8vh 上限留的余量**；缩放上限 1.06 同理取 1.04。
- **替代方案**：(a) 每个组件各写一个滚动监听——多份监听互相漂移、且难以保证「只有一个 rAF」；(b) `IntersectionObserver` 逐段驱动——做不出连续进度条。选单变量方案，理由是「所有滚动联动的取值都来自同一个数」，剂量上限只需在一处保证。

### D4 · 玻璃面板：新增两个面板令牌，只落在两类区块

- 令牌：`--ds-c-panel`（亮：`rgb(255 255 255 / 62%)`；暗：`rgb(16 18 24 / 58%)`）、`--ds-c-panel-border`、`--ds-radius-panel: 14px`、`--ds-blur-panel: 14px`。
- 应用面：**只有** `HighlightStats`（关键数字）与 `ProjectShowcase`（项目经历）的容器获得 `data-glass` + 面板类；其余区块保持通栏。
- 登记为渐变护栏的第 6 类宿主（`data-glass`），因为面板用了一层极淡的顶部高光渐变。
- **替代方案**：给所有区块包面板——被否，这正是 #46 记录的「一叠卡片 = AI 味」；只加圆角不用玻璃——观感不足，用户要的是「透明 + 一点科技感」。

### D5 · 700 字体：参数化流水线 + 只收集展示字

- `frontend/scripts/build-font-subset.cjs` 参数化：`--weight=700`、`--chars=<file>`、`--out=<file>`（默认行为与现有一致，避免破坏 500 的复现路径）。
- 新增 `frontend/scripts/collect-display-charset.cjs`：只遍历**展示字元素**（`h1`/`h2` 与关键数字、以及带 `[data-display]` 的元素），输出 `chars-display.txt`。它复用现有 `collect-charset.cjs` 的浏览器采集方式（dev server + Playwright/msedge）。
- `@font-face` 新增 `serif-sc-700.woff2`，`font-weight: 700`，`unicode-range` 与 500 档**完全一致**（只认 CJK，Latin 仍走 Georgia 真粗体）。
- 新增断言脚本 `frontend/scripts/audit-display-font.cjs`：收集渲染后展示字元素里的中文字符，断言**全部存在于 700 子集字符表**——这是防「同行混两档字重」的唯一硬证据。
- **替代方案**：(a) 全量变量子集 176.8KB——体积翻倍只为两档；(b) 用浏览器合成粗体——`font-synthesis: none` 已禁止，且这正是阶段 11「中文发糊」的根因。

### D6 · 排版：节奏与栅格用类名驱动，不动 DOM 结构

- 节奏：区块容器上加 `data-rhythm="major" | "minor"`，`major` 上留白 96px、`minor` 48px，**沿页面纵向交替**（数字 M / 技术栈 m / 实习 M / 项目 m / 教育 M / 联系 m）。**节奏与面板是两个独立维度**：节奏管留白，面板管内容分量——「项目经历」是 minor 但带面板，这是刻意的，不是错配。
- 不对称栅格：区块内层用 `grid-template-columns: repeat(12, 1fr)`，**不需要给 DOM 加包裹层** —— 用 `:not()` 直接给「除标题与导语之外的所有直接子元素」定位：
  - `.sectionTitle` → `grid-column: 1 / -1`（**保持通栏**，这一点是刻意的：一期的「顶部通栏发丝线 + 标题」是编辑式签名，通栏标题把它留住）；
  - `.sectionLead` → `grid-column: 1 / span 3`（窄栏）；
  - 其余直接子元素 → `grid-column: 4 / -1`（正文右移，与标题/导语形成可见错位）；
  - `[data-wide]`（目前只有「关键数字」）→ 正文从第 3 列起：这一节要平铺四个数字块，收窄到 8 列后 `1200ms → 50ms` 会文字溢出、与邻格贴在一起（截图确认过的真缺陷），因此给它多一列；与标题仍错开约 190px。**副作用（评审实测后补记）**：正文（3 起）与导语栏（1–3 列）在第 3 列重叠，栅格自动放置只能把正文另起一行 —— 所以这一节的正文**不与导语同排**，其余五节才是同排。这是刻意的取舍（宁可多一行，也不要叠字），但设计里原先没写。
- `≤719px` 时 `display: block` 塌回单列。
- 断言口径（`h1` / `h2` / `dt` / `h3` 数量）不受影响——只加类与网格，不加不减语义元素。

### D7 · 性能判据：优先 Lighthouse，跑不通则用 CDP 等价指标（并记录偏差）

一期 M2 DoD 的「Lighthouse 移动端 ≥ 90」至今未验。本机没有 `lighthouse` 包，`npx lighthouse` 需要联网安装。因此：

- 首选：若能安装并跑通 `lighthouse`，以它的移动端评分为准；
- 退路：`.tmp/tools/audit-perf.cjs` 用已有的 `playwright-core` + CDP 采集等价指标——CPU 6× 降速下的 LCP、CLS、以及**背景动画运行 3 秒内的掉帧率**；
- 无论走哪条路，都在 journal 明确写出用的是哪条，不允许含糊成「性能达标」。

### D8 · 布景层动画的硬约束：**每条流线只允许一条 CSS 动画**（实施中实测得出）

实施到第 7 组（集成验收）时，生产构建的 Lighthouse 移动端只有 **70 分**（TBT 2160ms）。用 `.tmp/tools/audit-perf.cjs`（390×844 / CPU 4× 降速 / 各采样 3 秒）做归因，结论出乎意料：

| 变体 | FPS | 掉帧率 | 长任务总时长 |
| --- | --- | --- | --- |
| A 原实现（位移 + dasharray 呼吸 + 脉冲 = 每条线 2 条动画） | 21 | 97% | 310ms |
| B 隐藏流线层 | 117 | 0% | 333ms |
| C 流线层保留但不播动画 | 117 | 1% | 334ms |
| D 只保留位移（每条线 **1** 条动画） | 118 | 0% | 143ms |
| E 只做透明度脉冲（每条线 **1** 条动画） | 117 | 1% | 281ms |
| F 路径数减半、仍每条线 2 条动画 | 45 | 7% | 283ms |
| G 位移 + 透明度脉冲（每条线 **2** 条动画） | 27 | 86% | 216ms |

两个反直觉的结论：

1. **主导项是「每条路径的动画条数」，不是「路径数量」。** F 把节点砍掉一半仍只有 45 FPS；而 D/E 只要每条线只剩一条动画就回到 117+ FPS。
2. **`stroke-dasharray` 每帧都要重算 dash 图案并重新细分描边**，是最贵的一项；但**任意两条动画叠加同样会崩**（G），所以不是「避开 dasharray」就够了，而是「一条为限」。

**最终实现**：位移（`stroke-dashoffset`）留在每条路径上（1 条动画），「呼吸」上提到**布景层一层**（`.field` 的 `fieldBreathe`，1 个元素 1 条动画）。修完实测：**76 FPS / 掉帧 0%**（长任务 310 → 162ms），生产构建 Lighthouse 移动端 **70 → 98 分**（TBT 2160 → 0ms）。

这条约束已写进 `specs/visual-language`（「单条流线 SHALL 只承载一条 CSS 动画」）与 `docs/decisions.md`，并由 `.tmp/tools/audit-perf.cjs` 长期把关。

## Risks / Trade-offs

| 风险 | 缓解 |
| --- | --- |
| 72 条 SVG 路径常驻重绘，移动端掉帧、发热 | **实测证实并已解决**：主导项是「每条路径的动画条数」而非节点数（见 D8）。每条流线只留一条动画 + 整层一条呼吸，实测 76 FPS / 掉帧 0%，Lighthouse 移动端 98 分 |
| 700 子集不覆盖某个展示字 → 同一行混用 500/700，观感「发糊」 | `audit-display-font.cjs` 断言「展示字集合 ⊆ 700 子集」；字符表随文案演进必须重跑流水线（写进 README 遗留） |
| 玻璃面板改变底色 → 对比度审计翻车（历史最高风险项） | 面板底色先取低不透明度，`audit-contrast.cjs` 每轮必跑；不达标就降不透明度或加深文字，而不是放宽门槛 |
| `backdrop-filter` 是 GPU 成本，移动端尤其贵 | 只用于两处、面积受控；掉帧率实测把关 |
| 流线层与既有 `data-reveal` / 环装置互相覆盖透明度或 transform | 流线层不挂 `data-reveal`；所有装饰层遵守「居中不用 transform、组件内不写 opacity 过渡」两条既有教训 |
| 视差/进度条被误用到正文或数据上 | 断言只允许带 `data-parallax` 的层发生滚动位移，并检查正文/数字/控件的 `transform` 不随滚动变化 |
| 渐变护栏断言会让新层直接亮红 | 先扩容断言白名单（`data-flow` / `data-glass`）到 6 类，再改样式；扩容本身是本 change 的一个任务 |
| 字体体积（设计时估 +30–50KB，**实测只有 +9.0KB / 45 字**，因为中文展示字本来就少） | 只打包展示字；产出后实测体积并与预估对照（实测远低于预估，故 build 脚本的 700 档告警阈值定为 25KB） |
| 内部页令牌变化后穿帮（背景层与排版只对首页重排） | `/tech`、`/algo`、404 走一轮截图；只要求不出现错位、不出现面板样式错用 |

## Migration Plan

1. 从 `main` 开分支 `feat/phase-2-visual`（一期遗留分支 `feat/homepage-about` 保留不动）。
2. 实施顺序（每步一次提交，可单独回滚）：断言白名单扩容 → 令牌层 → 字体 700（含流水线与断言）→ 流线布景层 → 滚动联动（hook + 进度条 + 视差）→ 排版（节奏 + 栅格）→ 玻璃面板 → 全量验收 → 文档与 archive。
3. **先扩断言再改样式**：渐变护栏与结构断言现在是"改了就亮红"的状态，先让它们认识新宿主，改样式的过程才有信号可看。
4. 回滚策略：代码回滚 = `git revert` 单个提交；纪律修订在 `openspec` delta 与 `docs/decisions.md` 中，若整期回滚，spec 随 change 一起撤销（未 archive 前主干 spec 未被修改）。
5. 主干 spec 同步：实施完成后用 `openspec archive` 把三个 delta 合入 `openspec/specs/`。

## Open Questions

以下三项都不改变 spec、做法与任务拆分，可在实施中定：

1. 项目徽标处的环与流线是否视觉打架——等首轮截图。
2. `index.html` 是否要为 700 档加 `preload`（若 500 与 700 都在首屏文字上，可能变成两次字体请求抢占）——等体积与 LCP 实测。
3. 本机能否跑通 Lighthouse——决定 D7 走首选还是退路。
