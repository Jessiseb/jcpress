# Tasks

> 二期（phase-2-visual）。**本 change 的产出不是可单测的代码**（视觉/动效/字体），
> 因此按用户要求把常规的 TDD 那一步换成**「标注样例 / 评估集跑一遍验证」**：
> 任务 1.2 产出的**效果对照矩阵**（`docs/phase2-effect-matrix.md`）就是本期的评估集，
> 每条参考效果都必须有可执行的判据，验收时逐条勾掉。
> 环境前置：vitest / vite build / 浏览器断言在本机都需要 `danger-full-access` 提权（见矩阵文件头部）。

## 1. 验收护栏前置扩容（先让断言认识新世界，再改样式）

- [x] 1.1 在 `.tmp/tools/audit-behavior.cjs` 的渐变宿主白名单里登记 `data-flow`（流线布景层）与 `data-glass`（玻璃面板），保留「姓名渐变恰好 1 个」判定 —— 验证：**未改任何样式前**跑 `node .tmp\tools\audit-behavior.cjs` 仍 26/26 全绿（扩容本身不引入失败）
- [x] 1.2 建立二期效果对照矩阵 `docs/phase2-effect-matrix.md`（=本 change 的评估集）：把两份参考组件里每条可命名效果（流线流动 / 长度呼吸 / 视差位移 / 滚动进度 / 玻璃层次 / 字号阶梓）逐条写成「参考效果 → 我们的实现 → 可观测判据 → 复核命令」—— 验证：表格无空判据、无「肉眼看着差不多」条目；每行命令可独立执行
- [x] 1.3 在矩阵文件头部写清本机三条硬前提（提权跑 vitest / 浏览器断言 / 构建）与 dev server 端口 5173 —— 验证：三条命令各跑一次，退出码均为 0

## 2. 令牌层与纪律记录

- [x] 2.1 在 `theme.jcpress.css` 新增流线剂量令牌（亮暗 `--ds-flow-line`、`--ds-flow-glow`）、面板令牌（`--ds-c-panel`、`--ds-c-panel-border`、`--ds-blur-panel`）与 `--ds-radius-panel: 14px` —— 验证：扩展 `node .tmp\tools\probe-tokens.cjs` 的期望键后，亮暗两套都能读到新令牌且取值符合预期
- [x] 2.2 令牌注释里写明「面板只用于两类区块」与「流线是布景层、环是标记层」两条新纪律（含 #46 与圆角 8px 上限的修订说明）—— 验证：注释可读且与 `openspec/changes/phase-2-visual/specs/visual-language/spec.md` 的措辞一致
- [x] 2.3 `docs/decisions.md` 追加纪律修订条目（图案两层 / 禁止清单改「剂量上限」/ 卡片化改「有限面板化」/ 展示字两档真字重），并标注被修订的原条号 —— 验证：新条目能被 #19 / #46 的原文交叉引用到；`git diff` 只增不改历史条目

## 3. 展示字 700 一档（流水线 → 字体 → 覆盖断言 → 落地）

- [x] 3.1 参数化 `frontend/scripts/build-font-subset.cjs`（`--weight` / `--chars` / `--out`），默认行为与现状完全一致 —— 验证：不传参执行 `npm run fonts:build` 仍产出 `serif-sc-500.woff2`，体积落在 90–100KB 区间
- [x] 3.2 新增 `frontend/scripts/collect-display-charset.cjs`：只遍历展示字元素（`h1` / `h2` / 关键数字 / `[data-display]`）收集字符 —— 验证：产出 `frontend/.tmp/fonts/chars-display.txt`，字符数明显小于全量 531，且包含姓名三个字
- [x] 3.3 生成 `frontend/public/fonts/serif-sc-700.woff2`，在 `theme.jcpress.css` 增加第二个 `@font-face`（`font-weight: 700`，`unicode-range` 与 500 档逐字一致）—— 验证：dev server 下该文件一次 200 请求、体积 **8–15KB**（实测 **9.0KB / 45 字**，比设计时的 30–50KB 预估低得多）、`document.fonts` 中两档都可查到
- [x] 3.4 新增 `frontend/scripts/audit-display-font.cjs`：断言渲染后展示字元素内的中文字符全部存在于 700 子集字符表 —— 验证：脚本退出码 0；**并做一次负向验证**（临时在标题文案里塞一个不在子集里的生僻字，脚本必须失败），随后复原
- [x] 3.5 展示字落到 700：`h1` / `h2` / 关键数字用 700，正文与导语保持 500；姓名 96→104px、区块标题 30→34px —— 验证：矩阵「字号阶梓」条目 + `audit-display-font.cjs` + 首屏亮暗裁图（截图归档后人工确认字面不糊）
- [x] 3.6 更新 `README.md` 的字体流水线说明（两档、`fonts:chars` 的两种模式、**新增汉字必须重跑**）—— 验证：照着 README 的步骤从零跑一遍能产出两个 woff2

## 4. 流线布景层

- [x] 4.1 新增 `frontend/src/components/visual/FlowField.tsx` + `FlowField.module.css`：`viewBox 696×316`、36×2 条镜像路径、`pathLength="1"` + dash 关键帧、确定性错峰（`20 + i % 11` 秒）、`aria-hidden` / `pointer-events:none` / `z-index:-1`、**不挂 `data-reveal`** —— 验证：断言「零图片请求」「`aria-hidden` 且不在无障碍树」「层叠位置低于正文」
- [x] 4.2 路径数按视口分档（桌面 36×2 / 平板 24×2 / 手机 12×2，`matchMedia` 驱动）—— 验证：390 / 768 / 1280 三档下断言实际渲染路径数为 24 / 48 / 72
- [x] 4.3 在 `App.tsx` 挂载全站 `fixed` 布景层，确认与顶栏、正文、页脚的层叠关系 —— 验证：首屏与页脚截图各一张；断言正文可选中、可点击（布景层不吃指针）
- [x] 4.4 `prefers-reduced-motion: reduce` 下流线静止 —— 验证：断言该环境下 `stroke-dashoffset` 在两次采样间不变化，且路径仍可见
- [x] 4.5 首屏环装置退役，环保留在频道页徽标 / 项目徽标 / 页脚（布景层 + 标记层）—— 验证：断言环宿主的位置与数量，更新后的 `环=N` 计数全绿；裁图确认徽标处环与流线不打架

## 5. 滚动联动（进度条 + 装饰层视差）

- [x] 5.1 新增 `frontend/src/hooks/useScrollProgress.ts`：单个 passive 滚动监听 + rAF，把 `--scroll-p`（0–1，三位小数）写到 `<html>`；卸载与 resize 时清理 —— 验证：断言 `--scroll-p` 随滚动单调递增、到页底为 1（±0.01）；连续切换路由 10 次无控制台错误
- [x] 5.2 顶部 2px 滚动进度条（`scaleX(var(--scroll-p))`、`transform-origin: left`、`pointer-events: none`）—— 验证：断言条带填充比例与滚动位置一致；`prefers-reduced-motion` 下仍可见且无过渡动画
- [x] 5.3 装饰层视差：`data-parallax` 层随 `--scroll-p` 位移（≤6vh）与缩放（≤1.04），给 spec 的 8% / 1.06 上限留余量 —— 验证：断言「位移只出现在 `data-parallax` 层」「正文 / 关键数字 / 控件的 `transform` 不随滚动变化」「位移 ≤8vh、缩放 ≤1.06」
- [x] 5.4 滚动联动的移动端开销控制：`data-parallax` 只用于首屏装饰，且分档减少动画元素 —— 验证：矩阵「滚动联动」条目 + 第 7 组的掉帧实测

## 6. 排版软化（节奏 + 不对称栅格 + 面板）

- [x] 6.1 区块节奏：加 `data-rhythm="major|minor"`，大节上留白 96px / 小节 48px 交替 —— 验证：断言相邻区块上留白存在两种档位且纵向交替，而非全页同值
- [x] 6.2 不对称栅格：区块内层 12 列网格，标题列 3 / 内容列 8 错位 1 列；`≤719px` 塌回单列 —— 验证：断言 1280 下标题与内容水平起点错位且标题列更窄；390 下左边缘对齐且无横向滚动
- [x] 6.3 玻璃面板只加在「关键数字」与「项目经历」两类区块容器上（`data-glass` + 面板类）—— 验证：断言带 `data-glass` 的容器只出现在这两个区块；其余区块无面板底色与投影
- [x] 6.4 面板不承担唯一信息层次，且面板上的文字对比度达标 —— 验证：`node .tmp\tools\audit-contrast.cjs` 亮暗未达标 0；忽略面板样式后 `dt` / 数值 / 出处 / 项目详情仍完整可读可展开
- [x] 6.5 首屏背景布景层不干扰正文（层叠、可读性）—— 验证：断言首屏姓名 / 一句话定位 / 自述三处文本对比度仍达标，且布景层不进入无障碍树

## 7. 集成验收（跨组，全部对矩阵逐条勾）

- [x] 7.1 扩容量后的浏览器断言全绿 —— 验证：`node .tmp\tools\audit-behavior.cjs`，记录条数 N/N 与新增断言列表
- [x] 7.2 对比度审计通过 —— 验证：`node .tmp\tools\audit-contrast.cjs`，亮暗「合计未达标：0」
- [x] 7.3 四视口无横向溢出与无重叠 —— 验证：`node .tmp\tools\shot-final.cjs .tmp\shots-p2`（1280/768/390/375），每档 `overflow=no`
- [x] 7.4 生产构建与体积对照 —— 验证：`cd frontend && npm run build`，记录 JS/CSS gzip 与两个字体文件的体积，与一期基线（JS 76.06KB / CSS 6.21KB gzip）逐项对照，首屏 JS ≤200KB
- [x] 7.5 移动端性能（一期欠账）—— 验证：`node .tmp\tools\audit-perf.cjs`（或本机可跑通的 Lighthouse 移动端），**必须在 journal 写明用的是哪条判据、数值多少**
- [x] 7.6 内部页不穿帮 —— 验证：`/tech`、`/algo`、404 各一轮截图，无面板样式错用、无错位、无横向滚动
- [x] 7.7 效果对照矩阵逐条勾选完毕 —— 验证：`docs/phase2-effect-matrix.md` 中每条效果的判据都已执行并留痕（未达标条目必须写明处置）

## 8. 文档同步与归档

- [x] 8.1 `docs/dev-journal.md` 的二期各阶段条目已实时写完（brainstorm 定稿 / 计划评审 / 每个任务组 / code review / finish）—— 验证：条目数与任务组数对得上，无「末尾一次性补记」痕迹
- [x] 8.2 `openspec validate "phase-2-visual" --strict` 通过 —— 验证：命令退出码 0
- [x] 8.3 归档：`openspec archive "phase-2-visual"` 把三个 delta 合入主干 spec，随后 `openspec list --specs` 与 `git status` 确认主干 spec 已更新 —— 验证：`openspec/specs/visual-language|homepage|site-shell/spec.md` 出现新要求，且归档目录落在 `openspec/changes/archive/2026-09-29-phase-2-visual/`
