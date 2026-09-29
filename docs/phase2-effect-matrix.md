# 二期效果对照矩阵（phase-2-visual 的评估集）

> 本期的产出不是可单测的代码（视觉 / 动效 / 字体），因此按用户要求把常规的 **TDD 那一步换成「拿标注样例 / 评估集跑一遍验证」**。
> 本文件就是那个评估集：**两份参考组件里每一条可命名的效果，逐条对应到我们的实现与一条可执行的判据**。
> 纪律：不允许出现「肉眼看着差不多」的条目；未采纳的效果必须写明理由，不允许静默丢弃。

## 0. 本机三条硬前提（不满足则一切判据都不成立）

本机沙箱会拒绝子进程的管道 stdio，因此以下三类命令**必须提权（`danger-full-access`）**运行：

| 命令 | 用途 | 不提权的表现 |
| --- | --- | --- |
| `cd frontend && node node_modules/vitest/vitest.mjs run` | 单元测试（5 文件 / 25 用例） | `failed to load config … spawn EPERM`（vitest 内嵌 esbuild 起子进程被拒） |
| `node .tmp\tools\audit-behavior.cjs` | 浏览器行为断言 | `browserType.launch: spawn EPERM`（Edge 用 `--remote-debugging-pipe`） |
| `cd frontend && npm run build` | 生产构建与体积对照 | 同类 esbuild 子进程被拒 |

其他前提：

- **dev server 必须跑在 `http://127.0.0.1:5173/`**（所有 `.tmp/tools/*.cjs` 里的 URL 是硬编码的）。
- 浏览器用系统 Edge（`channel: 'msedge'`），Playwright 只有 `.tmp/tools/node_modules/playwright-core@1.63.0`，不下载浏览器。
- 字体流水线前提：Python 3 + `fonttools` + `brotli`（本机已具备），源字体 `NotoSerifSC-VF.ttf` 已缓存在 `frontend/.tmp/fonts/`。

## 1. 效果对照表（参考效果 → 我们的实现 → 判据）

状态图例：✅ 未开始 / 🟡 进行中 / ✅ 已达标 / ⚠️ 未达标（必须写处置）

| # | 参考效果（出处） | 我们的实现 | 可观测判据 | 复核命令 | 状态 |
| --- | --- | --- | --- | --- | --- |
| E1 | 36 条流动曲线铺满背景（background-paths） | `FlowField`：内联 SVG，`viewBox 696×316`，36 条 × 2 组镜像 | 路径节点数 = 视口档位（24 / 48 / 72）；零图片请求 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E2 | 「光段」沿线前进（`pathOffset`） | `pathLength="1"` + `stroke-dashoffset` 关键帧 `0 → -1` | 同一路径两次采样的 `stroke-dashoffset` 不同，且幅度单调 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E3 | 线条长度呼吸（`pathLength` 0.3→1→0.3） | **改判为「整层呼吸」**：每条线的 dasharray 呼吸在移动端把帧率打到 21 FPS 已移除；改为布景层整体明暗（0.78↔1，16s）。判据：层的 `animation-name` 在 reduced-motion 下为 `none`，运行时非 `none` | `.tmp/tools/audit-behavior.cjs` | ⚠️→✅ |
| E4 | 透明度脉冲 0.3 / 0.6 / 0.3（background-paths） | **改判**：脉冲随「每条线一条动画」的硬约束一并去掉，改为整层呼吸；单条线的浓度上限由 `min(var(--path-alpha), --ds-flow-alpha-max)` 封顶 | 计算描边 max **0.5**、屏上浓度 max **0.433**、令牌确实接线 | `.tmp/tools/audit-behavior.cjs` | ⚠️→✅ |
| E5 | 逐字上浮入场（spring，逐字母延迟） | **不采纳**：一期已有编排式入场序列（`useReveal` + `data-reveal`），逐字入场与「一个视野一套字形」的气质冲突且会打散中文词 | — | 见 §2 未采纳表 | ➖ |
| E6 | 渐变文字标题（`bg-clip-text`） | 沿用一期：**全站恰好 1 处**（姓名） | 渐变宿主计数 `姓名=1`，其他宿主 0 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E7 | 玻璃质感按钮 + hover 上浮 | 沿用一期 `.btn` 系统 + 指针聚光；新增面板玻璃令牌 | 悬浮断言 2 项通过；主按钮仍是首屏唯一发光元素 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E8 | 固定图形随滚动位移 / 缩放（landing-page 的 globe） | 装饰层视差：`data-parallax` 层消费 `--scroll-p`，位移 ≤6vh、缩放 ≤1.04 | 位移只出现在 `data-parallax` 层；正文 / 数字 / 控件的 `transform` 不随滚动变化；位移 ≤8vh、缩放 ≤1.06 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E9 | 顶部滚动进度条（landing-page） | 2px 进度条，`scaleX(var(--scroll-p))`，`pointer-events: none` | 填充量与滚动位置一致（顶部 0 / 底部 1±0.01）；reduced-motion 下仍可见 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E10 | 分节全屏 + 侧边导航点（landing-page） | **部分采纳**：采纳「大节 / 小节交替」的节奏；**不采纳**侧边导航点（首页七区块不需要额外导航，会与悬浮顶栏重复） | 相邻区块上留白存在 96 / 48px 两种档位并交替 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E11 | 内容左右分栏、居中对齐混用（landing-page 的 align 变体） | 不对称栅格：标题列 3 / 内容列 8，错位 1 列；`≤719px` 塌回单列 | 1280 下标题与内容水平起点错位且标题列更窄；390 下左边缘对齐、无横向滚动 | `node .tmp\tools\audit-behavior.cjs` + `node .tmp\tools\shot-final.cjs .tmp\shots-p2` | ✅ |
| E12 | 卡片化内容块 + 徽章层次（landing-page 的 feature 卡） | **有限面板化**：玻璃面板只用于「关键数字」与「项目经历」两类区块 | 带 `data-glass` 的容器只出现在这两区；其余区块无面板底色与投影 | `node .tmp\tools\audit-behavior.cjs` | ✅ |
| E13 | 大号标题阶梓（8xl 级） | `h1`/`h2`/关键数字切 700 真字重；姓名 96→104px、区块标题 30→34px | 展示字元素计算字重 700；**展示字字符集 ⊆ 700 子集**；姓名不再往上顶 | `node frontend\scripts\audit-display-font.cjs` | ✅ |
| E14 | 参考站/参考组件的「科技感」透明层 | 面板玻璃 + 流线布景层，剂量低于参考（参考正文稀、本站正文密） | 对比度审计亮暗未达标 0 | `node .tmp\tools\audit-contrast.cjs` | ✅ |

## 2. 未采纳项与理由（不允许静默丢弃）

| 参考里的东西 | 处置 | 理由 |
| --- | --- | --- |
| shadcn 目录结构 + Tailwind + `@/components/ui` | 不采纳 | 一期定死 `D4=A`：CSS 变量 + CSS Modules（#7）；工具类在本项目的 CSS Modules 里无法解析 |
| `framer-motion` | 本 change 不采纳（留逃生舱） | `pathLength`/`pathOffset` 观感可用 SVG 原生 `pathLength="1"` + dash 关键帧 1:1 复刻；若验收不达标，另开 change 引入 |
| `lucide-react` 图标、Unsplash 图片 | 不采纳 | 全站图案零请求；位图会破坏「新增 0 请求」与首屏体积预算 |
| `Math.random()` 生成长度 | 改成确定性错峰 | 随机相位让每次截图与断言都不可复现，验收无从对照 |
| 逐字 spring 入场（E5） | 不采纳 | 与一期 `useReveal` 编排冲突；逐字入场会打散中文词的字形统一 |
| 侧边分节导航点（E10 的一半） | 不采纳 | 七区块首页 + 悬浮顶栏已提供导航；再叠一层会与顶栏重复 |
| 滚动进度条 / 视差「任意元素可用」 | 收窄为「只作用于装饰层 + 剂量上限」 | 会动的正文/数字会让人怀疑数据真实性；剂量上限写进 spec |
| 全站卡片化 | 收窄为两类区块 | #46：每个区块都包卡片 = AI 味一叠卡片 |

## 3. 交叉判据（不属单条效果，但必须一起看）

| 判据 | 命令 | 门槛 |
| --- | --- | --- |
| 单元测试 | `cd frontend && node node_modules/vitest/vitest.mjs run` | 25/25 通过 |
| 类型检查 | `cd frontend && npx tsc --noEmit` | 0 错误 |
| 生产构建体积 | `cd frontend && npm run build` | 首屏 JS gzip ≤200KB；与一期基线（JS 76.06KB / CSS 6.21KB gzip）逐项对照 |
| 移动端性能 | `node .tmp\tools\audit-perf.cjs`（或本机可跑通的 Lighthouse） | ≥90（**必须写明用的是哪条判据**） |
| 四视口无横向溢出 | `node .tmp\tools\shot-final.cjs .tmp\shots-p2` | 每档 `overflow=no` |
| 内部页不穿帮 | 同上，附 `/tech`、`/algo`、404 | 无面板样式错用、无错位 |

## 4. 实测结果（2026-09-30 收口，逐条跑过一遍）

| # | 判据 | 实测 | 状态 |
| --- | --- | --- | --- |
| E1 | 路径数分档 / 零图片请求 | `1280→72 / 768→48 / 390→24`；图片请求 0 | ✅ |
| E2 | 光段沿线前进 | `stroke-dashoffset -0.314 → -0.361`（两次采样不同） | ✅ |
| E3 | 长度呼吸 | **改判**：dasharray 呼吸在移动端把帧率打到 21 FPS —— 已移除每条线的呼吸，改为**整层**明暗呼吸（见 E15） | ⚠️→✅ |
| E4 | 透明度脉冲（≤0.6） | 屏上实际浓度 = 描边 0.5 × 元素 1 × 层 0.78~1 → max **0.425** | ✅ |
| E6 | 姓名渐变恰 1 处 | `流线=1 面板=2 环=2 姓名=1 遮罩=1 聚光=1 其他=无` | ✅ |
| E7 | 悬浮反馈 2 项 + 首屏唯一发光元素 | 两项悬浮断言通过 | ✅ |
| E8 | 视差仅装饰层、剂量达标 | 位移 **6.00%**（上限 8%）/ 缩放 **1.04**（上限 1.06）/ 正文数字控件 `transform` 全为 `none` | ✅ |
| E9 | 进度条随滚动 | `p 0 → 0.5 → 1`；`bar 0.000 → 0.500 → 1.000`；`pointer-events:none`；降级下仍前进 | ✅ |
| E10 | 大小节交替 | `数字=major/96px 技术栈=minor/48px 实习=major/96px 项目=minor/48px 教育=major/96px 联系=minor/48px` | ✅ |
| E11 | 不对称栅格 | `标题84 → 正文368`（六节一致，数字节为 273）；导语栏 `260 < 正文 828`；390 下偏移全 0 | ✅ |
| E12 | 面板只两类区块 | `共 2：拿得出手的数字 / 项目经历`；其余四节正文底色透明 | ✅ |
| E13 | 展示字 700 覆盖完整 | 700 子集 **45 字 / 9.0KB**；`{700}`；墨量 **+31.2%**；覆盖断言 6/6；负向自检退出码 1 | ✅ |
| E14 | 对比度 | 亮 227 处 / 暗 243 处文本，**未达标 0** | ✅ |
| **E15** | **常驻动画的移动端代价（新增）** | 原实现 21 FPS / 掉帧 97% → 修后 **76 FPS / 掉帧 0%**；长任务 310→162ms | ✅ |
| **E16** | **Lighthouse 移动端（对生产构建）** | **98 分**（TBT 0ms / FCP 1.8s / LCP 2.0s / CLS 0）；对 dev server 只有 30 分，不作为判据 | ✅ |
| 交叉 | 断言套件 | **47/47**（一期 26 → 二期 47），连跑 4 次稳定 | ✅ |
| 交叉 | 构建体积 | JS **231.37KB / gzip 77.31KB**（一期 76.44 → +0.87KB）；CSS gzip 7.43KB | ✅ |
| 交叉 | 四视口溢出 | 1280 / 768 / 390 / **375** 全部 `overflow=no`；`/tech`、404 同样无溢出 | ✅ |

### 4.1 与矩阵原定预期的两处偏差（如实）

1. **E3（长度呼吸）被降级为「整层呼吸」**：原计划沿用参考组件的 `pathLength 0.3 → 1` 呼吸，实测发现它是移动端掉帧的主因之一（而且**任意第二条动画都会崩**，不只是 dasharray）。最终把呼吸上提到布景层一层。观感上「流线在流动」保留，「每条线各自呼吸」去掉。
2. **E15/E16 是本矩阵原来没有的条目**：性能判据原本只放在 §3 交叉判据里，实测后升格为独立效果项（它直接决定了「背景灵动」这条需求能不能成立）。
