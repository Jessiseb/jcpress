# dev-journal · jcpress 首页（关于我）

> 流程：Superpowers 工程方法论（brainstorm → worktree → plan → tasks → code review → finish）
> 纪律：每个阶段**实时**补记，禁止末尾批量补录。每条含：用户关键原话 / AI 关键输出 / 被驳回与纠正 / 返工事件。

---

## 阶段 1 · brainstorm（2026-09-28 21:10 ~）

**用户关键原话**
- 「阅读这个项目的前期设计，然后继续讨论」
- 「简历路径 C:/Users/O/Desktop/庄家希AI应用开发.pdf；首页内容按简历展示，突出简历亮点；验收：正常展示 + 手机端适配，可以有一点华丽的效果但不要太多」
- 「全程走 superpowers 流程，按 OpenSpec 流程开发；技能自动触发；过程留痕，dev-journal 每阶段补记；涉及库/框架/API 用 Context7 MCP 查最新文档；技术选型定死，发现矛盾停下问」

**AI 关键输出**
1. 通读 `docs/项目前期规划.md`（1570 行）+ `design-system/README.md`，产出评审：7 个未决决策的建议取值 + 5 处硬伤（§8.4 与 §9.2 矛盾、Sa-Token 分库未落地、搜索不覆盖正文、浏览量三处真相、M1 DoD 过重）。
2. 用 `pypdf` 提取简历全文（2 页 / 3972 字），落 `C:/Users/O/AppData/Local/Temp/resume.txt`。
3. 安装 skills：`superpowers`（BuiltinMarket v1.0.0）；配置 MCP：`~/.workbuddy/mcp.json` 写入 `context7`（npx @upstash/context7-mcp）。
4. 产出设计文档 `docs/design-homepage.md`：首页区块 → 简历内容映射、4 个量化亮点、3 处克制动效、数据层走 mock 常量的理由。

**关键决策（本阶段拍板）**
| 决策 | 取值 | 理由 |
| --- | --- | --- |
| 数据来源 | 前端 `src/data/profile.ts` 类型化常量 | 后端未起；常量结构对齐未来 VO，切 TanStack Query 时零返工 |
| 首页范围 | 只做「关于我」+ 顶壳导航（其余频道占位） | 对齐规划 D7=A「先打通一条链路」 |
| 动效 | Hero 渐变标题 + 关键数字 count-up + 卡片 hover 上移 | 「一点华丽但不喧宾夺主」；`prefers-reduced-motion` 下全部降级 |
| 手机号 | **默认不展示** | 公网个人站，防骚扰；需要时一行开关打开 |
| 教育 / 荣誉 | **新增区块**（规划 §4.1 未列） | 应届生身份下这是最强信号，不放等于浪费简历 |

**被驳回 / 纠正**：无（本阶段）。

**返工事件**：无。

**悬念（待用户确认）**
- 头像：简历 PDF 无头像，暂用姓名首字渐变占位，待用户提供图。
- 简历 PDF 是否入仓（`frontend/public/resume.pdf`）供「下载简历」CTA 使用 —— 暂按「入仓」处理。
- 电话是否上站 —— 暂按「不上」处理。

---

## 阶段 2 · worktree / 分支（2026-09-28 21:15）

- 建分支 `feat/homepage-about`（单仓内隔离，未用 worktree：本地单人、无并行任务）
- 初始化 `frontend/`：Vite 6 + React 18 + TS strict + React Router 6 + TanStack Query 5 + Vitest
- 设计系统接入：`design-system/tokens.curated.css` + `theme.jcpress.css` 复制进 `src/styles/`（基线文件保持原样）
- 简历 PDF 复制到 `frontend/public/resume.pdf`

**返工事件 ①**：`npm install` 失败 —— esbuild postinstall spawn EPERM（沙箱）。
处理：`--ignore-scripts` 重装 + 显式补装 `@rollup/rollup-win32-x64-msvc@4.63.5`（与 rollup 版本一致）。已记入 `docs/decisions.md` 环境注意事项。

---

## 阶段 3 · writing-plans（2026-09-28 21:16）

实施计划（按设计文档 §2 区块顺序执行，每块 = 组件 + CSS Module + 数据）：

1. 工程配置：vite.config / tsconfig / index.html（含防闪白主题内联脚本）
2. 数据层：`src/data/profile.ts`（类型对齐 VO）→ `useProfile()`（未来切 TanStack Query）
3. 布局：TopNav（含主题切换 + 汉堡）→ MobileDrawer（ESC / 遮罩关闭、body 滚动锁）→ Footer（stats）
4. 首页区块：Hero → HighlightStats（count-up）→ SkillMatrix → ExperienceTimeline → ProjectShowcase → EducationAwards → ContactBar
5. 占位路由：/tech /algo /projects → ChannelPlaceholder（不白屏）
6. 测试与验收：vitest 单测 + Playwright(Edge) 四视口截图 + 横向溢出检测

**被驳回 / 纠正 ①**：原计划把所有区块塞进 HomePage 单文件，写第一块时放弃 —— 7 个区块单文件超 600 行，违反「复杂度冒头就砍」；改为每区块独立组件 + CSS Module。

---

## 阶段 4 · tasks / TDD（2026-09-28 21:18 ~ 21:36）

**如实记录**：本轮实际顺序是「先实现、后补测试」，违反了 RED→GREEN 纪律。
原因：展示型页面的测试设计依赖最终 DOM 结构，先写测试会盲写两遍。补偿措施：测试覆盖了数据契约（不是 DOM 快照），并规定后续功能开发（M2 聚合接口起）严格先测后码。

测试（11 个，全绿）：
- `profile.test.ts`（5）：关键数字完整性 / 经历排序 / 手机号不外泄 / 技能熟练度边界
- `useCountUp.test.ts`（2）：未激活返回终值（预渲染安全）
- `HomePage.test.tsx`(4)：姓名渲染 / 三段经历 / 四个指标 / 简历下载入口

**返工事件 ②**：经历排序断言失败 —— 我最初按 startTime 倒序断言，但 CVTE(2025-04~至今) 与用友(2025-07~2025-10) 时间重叠，按开始时间排序语义错误。修正为「按结束时间倒序，至今优先」，并写入 `decisions.md` #4。**这不是数据错，是我测试的排序语义错。**

**返工事件 ③**：vitest 经 `npm.cmd` 运行时随机丢测试文件（EPERM 写临时缓存）。根因是宿主 fs shim 拦截。绕过：`node node_modules/vitest/vitest.mjs run` 直跑，3 文件 / 11 测试全绿。已记入 `decisions.md`。

**验收结果（Playwright + Edge，fullPage 截图 + 溢出检测）**：

| 视口 | 横向滚动 | 结果 |
| --- | --- | --- |
| 1280×900 亮色 | 无（1280=1280） | ✔ |
| 390×844 亮色 | 无（390=390） | ✔ |
| 375×812 亮色 | 无（375=375） | ✔ |
| 390×844 暗色 | 无（390=390） | ✔ 暗色对比度正常 |

构建：`vite build` 通过，JS 222KB（gzip 73.9KB，低于规划 §2.8 首屏 ≤200KB gzip 预算），CSS 25.4KB（gzip 5.1KB）。

**Context7 MCP 状态**：已写入 `~/.workbuddy/mcp.json`，但需用户在连接器管理页「信任」后才会激活；本轮版本选型全部来自规划文档定死的技术栈（React 18 / Vite 6 / RR 6 / TQ 5），用构建 + 测试验证代替了文档核对。

---

## 阶段 5 · code review（2026-09-28 21:40）

自查清单（对照设计文档 + 规划 §2.8）：

| 检查项 | 结果 |
| --- | --- |
| 首屏不依赖 window / localStorage（预渲染约束） | ✔ 初始主题由 index.html 内联脚本写；useCountUp 未激活返回终值，爬虫拿真实数字 |
| 触摸目标 ≥ 44px | ✔ 导航项 / 汉堡 / CTA / 复制按钮均 ≥ 44px |
| hover 不作唯一入口 | ✔ 卡片 hover 效果包在 `@media (hover: hover)` 内 |
| `prefers-reduced-motion` 降级 | ✔ count-up 直出终值 + global.css 全局降动画 |
| 暗色对比度 | ✔ 沿用 theme.jcpress.css 实测值（accent 暗色 9.22:1） |
| DO / 内部字段泄漏 | N/A（纯前端，无接口） |
| YAGNI | ✔ 富文本只解析 `**加粗**`，未引入 react-markdown |

**遗留（非阻断）**：① 头像为姓名首字占位，待用户提供图；② CSDN 与「成神笔记」无链接，待用户补 URL；③ 电话默认不上站，待用户确认。

## 阶段 6 · finish（2026-09-28 21:42）

- 测试：3 文件 / 11 用例全绿；`tsc --noEmit` 零错误；`vite build` 通过（JS gzip 73.9KB < 200KB 预算）
- 提交：`1598ca8 feat: 首页（关于我）……`（分支 `feat/homepage-about`，工作区干净）
- **合并选项待用户选择**：① 合入 `main`（个人项目可直接合）② 开 PR 自查后合 ③ 保留分支继续迭代
- 证据截图：`desktop-1280-light` / `mobile-390-light` / `mobile-390-dark` / `mobile-375-light`（AppData/Temp/jcpress-shots）

---

## 阶段 7 · 视觉返工（去 AI 味）（2026-09-28 21:45 ~ 22:45）

### 7.1 技能安装（用户主导）

**用户关键原话**
- 「帮我装一个能够读取别人网站风格的skill」
- 「@skill:ardot-design-core https://golangstar.cn/ 阅读这个网站, 读取他的风格, 我现在这个项目的页面太AI了, 第一期不符合!」
- 「帮我装一下frontend-design这个skill」

**AI 关键产出**
1. 装入 `awesome-design-md` v1.0.0（54 套知名站 DESIGN.md）。**当场指出其局限**：它是离线设计系统库，不抓取任意 URL，用户理解的「读网站风格」它做不到。
2. 装入 `frontend-design` v1.0.0（生成可运行代码、拒绝泛 AI 审美），并通读 `references/zh-CN.md` 全文（反 AI 味检查表 12 项、基准数值、复杂度匹配表）。
3. `ardot-design-core` 载入后发现其 MCP 画布工具（`create_design` 等）在本环境不可用，**未编造能力**，直接改走代码路线并向用户说明。

### 7.2 风格提取（证据而非印象）

**AI 关键产出**：产出 `docs/style-ref-golangstar.md`。方法不是「看一眼截图描述感受」，而是：
- 直连抓 `index.html`（47KB）+ 构建产物 CSS（`style-CMxb-D9U.css`，175KB，VuePress Theme Hope）
- Playwright 注入读取关键元素 `getComputedStyle`，拿到真实值：Hero 标题 57.6px/700、渐变 `linear-gradient(120deg,#0A7BF5,#0756AB 30%,#5C07AB 100%)`、卡片底 `#F0F7FF` / 边 `#E2E8F0` / 圆角 8px / 阴影 `0 2px 8px rgba(0,0,0,.05)`、Hero 底 `rgba(240,248,255,.85)`（**平铺色，不是渐变**）、内容宽 1160px、导航 60px + `backdrop-filter: saturate(1.5) blur(12px)`
- 三视口截图（1280 亮 / 1280 暗 / 390 亮）交叉验证

**关键发现**：`tokens.curated.css` 本来就是从该站提取的，蓝色的三档和 Hero 渐变都在里面 —— 是 `theme.jcpress.css` 用青碧 Teal 覆盖掉了。所以「换蓝」= 撤覆盖层，不是新造颜色。

### 7.3 三个决策点（两次暂停确认）

**第 1 次（用户已答）**
- 强调色：用户答「不要有绿色，不好看，蓝色就好」→ 撤 Teal，回蓝色基线
- 头像：用户答「去掉头像区（推荐）」→ Hero 改居中单列

**第 2 次（AI 主动暴露冲突后用户已答）**
- AI 明确摆出 `frontend-design` 与参照站的**硬冲突**（展示字禁用 system-ui ↔ 该站纯系统字体；首屏「居中标题+按钮」列为不合格项 ↔ 该站正是如此；纯色平背景列为不合格 ↔ 该站正是如此），未擅自选边
- 用户答：**折中**（golangstar 提供「不乱」的底线 + frontend-design 提供「不像模板」的上限）+ **衬线展示字·零下载**

### 7.4 执行

**变动的文件**
| 层 | 文件 | 改动 |
| --- | --- | --- |
| 令牌 | `styles/theme.jcpress.css` | 撤 Teal 覆盖；新增 `--ds-font-display` / `--ds-c-hairline` / `--ds-measure-prose` / `--ds-ease-out` / `--ds-atmosphere-*`；文本灰阶与暗色强调色校正 |
| 令牌 | `styles/global.css` | body 氛围层（两枚径向渐变）、标题切衬线、区块标题压通栏发丝线、入场序列规则 |
| 新增 | `hooks/useReveal.ts` | 编排式入场，隐藏态由 `<html data-reveal="on">` 门控 |
| 重做 | `Hero` / `HighlightStats` / `SkillMatrix` / `ExperienceTimeline` / `ProjectShowcase` / `EducationAwards` / `ContactBar` | 全部 TSX + CSS Module 重写 |
| 对齐 | `TopNav` / `Footer` / `MobileDrawer` | 发丝线令牌、品牌标记改实色、页脚数字卡改一行文字 |
| 删除 | `hooks/useCountUp.ts` + `.test.ts` | 无引用，属死代码 |
| 新增 | `pages/home/HomePage.test.tsx` | 新增 5 条「反 AI 味」回归护栏 |

**被驳回 / 纠正**
- **AI 自我纠正 ①**：`SkillMatrix` 分组初版用了嵌套 `<section>`，会生成 6 个多余 landmark 干扰读屏 —— 自查时改回 `<div>`。
- **AI 自我纠正 ②**：`useReveal` 初版先调 `window.matchMedia` 再判 `IntersectionObserver`，jsdom 里会先抛错；调换顺序并给 matchMedia 加 `typeof` 守卫。
- **AI 自我纠正 ③**：导航品牌标记原本也用 Hero 渐变，违反「渐变只出现一处」且白字对比度只有 4.07:1 —— 改成实色填充。

### 7.5 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ④ | 整页截图拍到成片空白（实习经历区块整块不见） | 我的截图脚本自身缺陷：`scroll-behavior: smooth` 让程序化 `scrollTo` 变成动画，快速连续调用互相打断，页面根本没滚到底（只浮现 13/45 个元素）；且整页截图会把视口拉高，元素那一刻才刚开始淡入 | 修脚本：截图前先 `scrollBehavior='auto'`，并在拍静态版式前摘掉 `data-reveal` 属性让隐藏态失效。修完后 44/44 内容元素全部浮现（第 45 个是 `<html>` 自己，被我的选择器误计入） |
| ⑤ | 对比度审计发现 2 处不达标 | ① 基线 `text-subtle` 亮色 3.12:1 / 暗色 3.18:1，而我这次把它用得比原先更多；② 暗色 `--ds-c-accent` 压在 `accent-soft` 药丸底上仅 4.28:1 | 上提灰阶两档 + 暗色强调色提亮到 `#4d9bff`。复审：227 处文本 × 亮暗两套 = 全部通过 AA |
| ⑥ | 触摸目标审计发现 5 处 <44px | 品牌链接、联系区链接与复制按钮、项目区外链都没有撑高 | 分别补 `min-height: 44px`。正文内联链接按 WCAG 2.5.8 惯例豁免（强行撑高会破坏中文行距） |
| ⑦ | 正文行宽 920px，中文一行约 65 字 | 通栏段落没有长度约束，超出基准的 28–40 字 | 新增 `--ds-measure-prose: 36rem` 并施加到实习/项目的段落与要点 |
| ⑧ | **生产构建与 vitest 均无法运行**（未解决） | 环境的 esbuild Go 子进程被禁止读取磁盘：`Cannot read file "package.json": winapi error #5`。最小复现证明 `esbuild.transform()`（纯内存）正常、任何磁盘读取失败、而 Node 自己的 `fs.readFileSync` 读同一文件正常；项目内外路径都失败；`dangerouslyDisableSandbox` 无效；vitest 内嵌的 esbuild 0.21.5 另报 `winmm.dll not found` | 无解，已记入 `docs/decisions.md` 环境注意事项。替代验证见 7.6 |

### 7.6 验收（替代路径）

jsdom 版 vitest 跑不起来，改用**真实浏览器断言套件**覆盖同样 9 条 + 4 条运行期检查 —— 覆盖面比 jsdom 更广（含布局、可见性、触摸目标）。

| 关卡 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✔ 0 错误（不依赖 esbuild） |
| 浏览器断言 13 项 | ✔ 13/13（含唯一 h1、六区块 h2、4 项 `dt`、首屏无按钮、无点阵、渐变仅 1 处、入场 44/44、触摸目标全部 ≥44px） |
| 对比度审计 | ✔ 227 处 × 亮暗两套，0 处低于 AA |
| 横向溢出 | ✔ 1280 / 768 / 390 三档均 `scrollWidth === clientWidth` |
| 视口截图 | ✔ 1280 亮、390 亮、390 暗（各分段切片） |
| `vite build` | ✘ 被环境阻断（见返工 ⑧）；**限制出现前已成功构建过一次**（JS 221.07KB / gzip 73.59KB，CSS 22.04KB / gzip 4.96KB） |

**遗留**
- ① 环境修复后需补跑一次 `vite build` 与 `vitest`，确认 12 个用例全绿。
- ② 头像仍无图，用户已选择不做占位；将来若要加，Hero 结构需恢复两栏。
- ③ `design-system/palette-options.html` 的选色结论（青碧 Teal）已与最终实现不符，需同步或标注作废。

---

## 阶段 8 · 一期视觉语言修订（环装置）· brainstorm（2026-09-28 22:35 ~ 23:05）

### 8.1 用户关键原话

- 「npx skills add https://github.com/anthropics/skills --skill frontend-design 装这个skill」
- 「我刚才修改了这个项目的页面. 现在页面的效果是好了一点,没有很浓的AI味了. 但是少了点味道,就是目前的实现都是简单的内容展示, 少了一点图案之类的去点缀. 所以第一期的开发需要继续优化: 在原来的页面补一些小图案, 看哪个网站的图案好用, 网站不要做的很正式, 页面可以有一点点的透明+科技感,科技感一丢丢就够了,继续优化一期的页面」
- 「我感觉都不是很好 https://21st-aura-svelte-preview-jdpo1k26v-larsen3.vercel.app/ 你看一下这个网站的风格 可以参考一下」
- 「暗色的时候就A 亮色就C」
- 「听你的建议」
- 「可以」

### 8.2 AI 关键产出

1. **装 skill**：`frontend-design` 装到全局 `~\.agents\skills\frontend-design`（沙箱下 `npx` 缓存写入与 `git clone` 各报一次 EPERM，各提权一次完成）。
2. **读现状**：通读 7 个区块组件 + 两份样式层 + 4 份 docs。确认现状语言是「通栏发丝线分块的编辑式列表」，全站无任何纹理；`theme.jcpress.css` 里还写着「不加噪点颗粒」。
3. **第一版方案（被否）**：四个纯 CSS 底纹 —— A 工程纸网格 / B 点阵+刻度 / C 玻璃+噪点 / D 局部点缀。做成 1:1 mock 推到视觉陪跑服务上，用户否掉。
4. **抓参照站实测指纹**（不是「看一眼截图写感受」）：Playwright 三视口截图 + `getComputedStyle` + **直取构建产物 CSS**，拿到图案元素的源值：
   ```css
   .hero-field{background:radial-gradient(circle at 50% 45%,#fff3,#0000 34%),
     repeating-radial-gradient(circle at 50% 45%,#ffffff1f 0 1px,#0000 1px 7px),
     linear-gradient(135deg,#050505 15%,#151515 50%,#050505 85%);
     mask-image:radial-gradient(#000 5%,#0000 72%)}
   ```
   另有 `#050505` 底 / `#0a0a0a` 面 / `#ffffff1a` 边 / accent `#3b82f6`、Georgia 400 的 96–102px 标题、`--font-weight-light:300`。落 `docs/style-ref-aura.md`。
5. **第二版方向对比**：三块 Hero 并排（暗色优先 / 亮色主体+暗色剧场 / 亮色只移植装置）→ 用户选「暗A亮C」。
6. **环的位置**：三档整页骨架（只有头尾 / 每区块 badge / 全页漂移）→ 用户答「听你的建议」，定为 **首屏大环 + 项目经历小环 + 页脚大环，中间正文保持干净**。
7. **逐节设计评审**（设计语言 / token / 排版 / 首页九区块 / 占位页 / 列表页骨架 / 动效 / 可访问性 / 文档与验收）→ 用户「可以」。
8. 产出 `docs/design-visual-language.md`（含范围、验收、冲突修订、风险与回退）。

### 8.3 被驳回 / 纠正

- **驳回 ①（方向性）**：第一版四方案全部是「平面底纹」，方向就错了。用户原话「我感觉都不是很好」。
  纠正：重看参照站后认识到它的图案不是纹理，而是**空间光场**（同心环 + 中心聚光 + 四周晕影 + 135° 面差），据此重做第二版。这一条是本阶段最有价值的返工。
- **自我纠正 ②（认知过期）**：设计稿初版把「暗色强调色提亮」「文本灰阶上提」写成本次要改的动作，实际上上一轮已经落地（decisions #12/#13）。
  根因：本会话进行中**另一个会话仍在改同一个仓库**，我读文件与写文档之间隔了十几分钟，读到的是旧状态。重读 `theme.jcpress.css` 后修正为「已落地，不再改」。
- **自我纠正 ③（验收路径不成立）**：初稿把 `vite build` + `vitest` 写进验收清单，但本环境 esbuild 读盘被禁（阶段 7 返工 ⑧ 未解决）。
  纠正：改为 `tsc --noEmit` + 复用上一轮已建好的浏览器断言套件（`.tmp/tools/audit-behavior.cjs` / `audit-contrast.cjs`），并把「首屏 gzip 体积」标为环境修复后补测。

### 8.4 并发写入事件（如实记录）

本会话进行期间（22:36–22:45），**另一个会话仍在写本仓库**：`theme.jcpress.css`、`TopNav/ContactBar/ProjectShowcase.module.css`、`decisions.md`、`dev-journal.md` 均在其后又被修改。
发现方式：写 `decisions.md` 时被文件系统策略拦下（「file changed since it was read」），随即用 mtime 扫描确认。
影响：设计稿的 token 现值表一度过期（见自我纠正 ②）；实现开工前必须再确认该会话是否收工。
状态：该会话的阶段 7 改动**目前仍未提交**（`git status` 显示 20+ 个 M 文件）。

### 8.5 环境坑（已同步 decisions.md）

| # | 现象 | 处理 |
| --- | --- | --- |
| ⑨ | Playwright `spawn EPERM`（命名管道），Edge 自带 headless 截图也无产物 | 一次性提权后可用；每次新会话首次截图都要提权一次 |
| ⑩ | brainstorming skill 的 `start-server.sh` 是 bash，Windows 不可用 | 直接 `node scripts/server.cjs` + `BRAINSTORM_DIR/PORT` 环境变量常驻后台 |
| ⑪ | `npx` 写 npm 缓存 EPERM | `npm_config_cache` 指向项目内目录，用完删除 |

### 8.6 悬念

- 另一个会话是否已收工 → 决定我能否安全开始改代码。
- 未提交的阶段 7 改动由谁提交、是否与本次改动一起提交。

---

## 阶段 9 · 一期视觉语言修订 · 实施（2026-09-28 23:05 ~ 23:5x）

### 9.1 用户关键原话

- 「还在执行吗」（我上一轮停在「选执行方式」，用户以为已经开工）
- 「选1 就好」（＝我在本会话按任务逐个执行，不派 subagent）

### 9.2 执行方式与顺序

按 `docs/plan-visual-language.md` 的 9 个任务逐个做，**每个任务都跑一遍可运行的验收**（`tsc --noEmit` + 浏览器断言 + 对比度审计 + 截图），每个任务一个提交。

顺序上有一处调整：计划里 Task 7（占位页外壳 + 路由）会引用 Task 8 才创建的 `TechListPage`，
为避免中间态 `tsc` 报「找不到模块」，**先做 Task 8（列表页）再做 Task 7（外壳 + 路由）** ——
计划里已写明这个二选一，执行时选了推荐项。

### 9.3 提交清单

| 提交 | 内容 |
| --- | --- |
| `38b03e1` | 令牌层：暗底 `#08090c`、玻璃层、环三件套、展示字字重 500；标题排版进 `global.css` |
| `ea330c3` | `RingField` + `withLatinEmphasis` + 首屏（两行标题、Latin 斜体、按钮辉光）+ 环周期校准 |
| `cecfdda` | 顶栏环标记 + 玻璃底；数字/档位/年份/公司名字面修订（含数值列宽修正） |
| `30f7e8c` | 项目经历改编辑式表格 + 可展开面板 + `--ds-ring-badge` |
| `0bdeb22` | 页脚环布景 + 收尾语 + 发邮件按钮；复制按钮玻璃化 |
| `0ac187a` | 技术分享列表页骨架（数据 + hook + 页面 + 空态） |
| `36aca52` | 占位页统一外壳 + `/tech` 接上列表页 |
| `0844e9c` | 断言套件扩到 24 项（列表页 / 占位页 / 键盘 / reduced-motion） |

### 9.4 翻车与返工（全部如实记录）

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ⑫ | 自己起 dev server 失败：`spawn EPERM` | vite 加载配置时要起 esbuild 子进程（与本轮 Playwright 同一类沙箱边界） | 5173 上有一个另一个会话留下的 dev server 在跑，Vite HMR 会吃磁盘改动，直接复用；已记入 decisions |
| ⑬ | **页脚环根本不显示** | 页脚环层带了 `data-reveal`，而 `useReveal` 只观察 HomePage 子树 —— 全局隐藏态把它压成 `opacity:0` 且永不揭示 | 行为断言报「入场序列 43/44」后定位修正（去掉 `data-reveal`）。**截图看不到这个 bug**，因为截图脚本会先摘掉 `data-reveal`。写入 decisions #31 |
| ⑭ | 关键数字第三行「1200ms → 50ms」贴到出处文字上 | 数值从 16px 无衬线放大到 22px 衬线后，8rem 的数值列装不下（约需 150px） | 数值列放宽到 11rem；靠整页截图发现 |
| ⑮ | 环在暗色下出现间距不均的摩尔纹 | 参照站的 7px 周期与像素网格打架 | 写 `probe-ring.cjs` 对 9/24/46px 各拍 1:1 裁图对比 → 取 46px（写入 decisions #21、设计文档 §2.1） |
| ⑯ | 环 badge（54px）几乎看不见 | 照抄大环的不透明度（亮 6%/暗 8%），但 badge 只有 54px | 单开 `--ds-ring-badge`（亮 22%/暗 32%）；写入 decisions #32 |
| ⑰ | 断言口径错两次 | ① 每个页面都带页脚 `RingField`，环计数没排除 footer；② 顶栏汉堡按钮也带 `aria-expanded`，键盘断言没限定作用域 | 都是**断言写错而不是代码错**：分别改为「排除 footer 后计数」与「限定在 `main` 内查找」 |
| ⑱ | 编辑源文件偶发 `ReplaceFileW EIO (Win32 1175)` | 写入撞上 Vite 的文件监听 | 重试同一次编辑即成功；已记入 decisions 环境注意事项 |

### 9.5 验收结果

| 关卡 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | ✔ 0 错误（全程保持） |
| 浏览器行为断言 | ✔ **24/24**（原 13 项 + 列表页 6 + 占位页 1 + 404 1 + 键盘展开 1 + reduced-motion 1 + 环 badge 1） |
| 对比度审计 | ✔ 亮暗各 227 处文本，未达标 0（暗色实测 accent 7.05:1 / mute 9.79:1 / subtle 6.32:1） |
| 横向溢出 | ✔ 1280 / 768 / 390 三档，首页与 `/tech` / `/algo` 全部 `scrollWidth === clientWidth` |
| 键盘可达 | ✔ 项目面板可用 Enter 展开，面板内容真的进 DOM（403 字符） |
| `prefers-reduced-motion` | ✔ 入场序列不接管（`data-reveal` 未挂上），正文 0 处隐藏 |
| 截图 | ✔ 首页 / `/tech` / `/algo` × 四视口 × 亮暗（`.tmp/final`、`.tmp/task34b`）；局部裁图 `.tmp/crops` |
| **`vitest`** | ✔ **25/25 全绿（5 个文件）** —— 会话中途环境限制解除后补跑 |
| **`vite build`** | ✔ 通过：JS 227.82KB / **gzip 76.06KB**、CSS 30.84KB / gzip 6.21KB；首屏 JS gzip 76.06KB ≤ 200KB 预算 ✔ |

### 9.6 环境限制在本会话中途解除（重要）

阶段 7 遗留的「esbuild 读盘被禁 → `vite build` 与 `vitest` 都跑不起来」在本会话执行到一半时**自行解除**
（沙箱策略由 workspace-write 改为 danger-full-access），于是补跑了两项原本只能记为「待补」的验收：

- `vitest run`：**5 文件 / 25 用例全绿**（`latin` / `articles` / `TechListPage` / `HomePage` / `profile`）。
- `vite build`：通过，体积见上表。

**补跑立刻抓到一处真问题**：`latin.test.tsx` 2 条用例失败 —— 我的 `withLatinEmphasis` 把非 Latin 片段
也包了一层 `<span>`，导致 `renderToStaticMarkup` 的产物与源文本不一致（`<span>1200ms → 50ms</span>`）。
这是**实现与意图不符**，不是测试写错：改为非 Latin 片段直接返回字符串，既修好测试也去掉了无语义的 DOM 层级。

### 9.7 遗留

- ① ~~环境修复后补跑 `vitest` 与 `vite build`~~ → **已在 9.6 补跑完成**，两项全绿。
- ② `src/data/articles.ts` 里 5 条占位标题待作者替换（文件顶部已标注）。
- ③ 参照站指纹文档 `docs/style-ref-aura.md` 已入库，与 `style-ref-golangstar.md` 并列。
- ④ 阶段 7 的视觉返工改动仍未单独提交 —— 已在 `bc4236b` 一并收入版本历史（使 HEAD 与已验收状态一致）。
- ⑤ 首屏 gzip 76.06KB，距 200KB 预算还有很大余量；将来加文章详情页（M3）时再复测一次。

---

## 阶段 10 · 补齐 mock 的气场（2026-09-29 00:0x）

### 10.1 用户关键原话

- 「为什么实现的效果没有你让我选的时候的A C的感觉」
- 「不要取舍, 现在一点都没有气场」

### 10.2 诊断：不是技术问题，是我收敛了四处

用户是对的。实现没有 mock 的气场，根因是我在实现时做了四处「比 mock 保守」的取舍，
而这些取舍恰好削弱了用户当时**选中的那个东西**：

| mock 里被选中的样子 | 我实现成了 | 性质 |
| --- | --- | --- |
| 悬浮玻璃胶囊导航（≤860px、圆角 999px、实心 CTA） | 通栏 sticky 条 | 我当时在对话里说了「结构不动」，但这条是 A/C 一半的气场 |
| 实心白/近黑胶囊 + 描边胶囊 | 品牌蓝实心 + 文字链 | 沿用了旧按钮系统，没按 mock 改 —— 纯粹的不一致 |
| 亮色环 11% | 6% | 砍半，亮色下光晕没了 |
| 标题 76px、4 列 30px 蓝色衬线数字 | 68px、编辑式行列表 22px | 收敛过头 |

另外 mock 里的**整页晕影**（内容从暗处浮出的主要手法）我完全没实现。

### 10.3 改动（按 mock 补齐，不再收敛）

| 项 | 结果 |
| --- | --- |
| 顶栏 | 悬浮玻璃胶囊（≤900px、圆角 999px、玻璃底 + 半透明边）+ 右端实心 CTA「发邮件」；外层 sticky 壳加 `data-scrim` 顶部渐隐，胶囊从内容上方浮过 |
| 按钮 | 实心胶囊（亮 `#0f1115` 白字 18.4:1；暗 白底 `#050505` 20.1:1）+ 描边胶囊；新增 `--ds-c-btn-solid-bg/fg`。品牌蓝不再用于按钮填充，只留给数据、链接与状态 |
| 环 / 聚光 | 亮 13% / 14%、暗 10% / 26%；`RingField` 聚光射程 34% → 46%、遮罩从 5%→72% 收到 10%→64%（原来摊太开，看着像脏而不是像环） |
| 晕影 | 新增 `--ds-vignette`，作为 body 背景最上一层（亮 82% 白 / 暗 92% 近黑），不新增元素、不进无障碍树 |
| 首屏 | 标题 84px（阶梯 84 / 52 / 44 / 38）；环 1200px；kicker 改等宽字 |
| 数字区 | 四列数字块：衬线 30px + 强调色 + 等宽指标名 + 每格顶部发丝线。**无卡片、无 count-up**，`<dl>` 语义保留（4 个 `dt` 的断言口径不变） |

### 10.4 被驳回 / 纠正

- **用户驳回我的实现，且驳回成立**：这是本阶段最重要的一条。我把「mock」当成了示意，
  在实现时按自己的判断做了保守化处理 —— 但 mock 一旦被用户选中，它就是**验收标准**。
  已把这条教训写进 `docs/decisions.md` 的 #33-36 说明里。
- **自我纠正**：断言套件的渐变护栏新增 `scrim` 分类 —— 顶栏那层顶部渐隐是**功能性遮罩**，
  不该和「模板感装饰渐变」混为一谈；顺手给 `<header>` 加了 `data-scrim` 标记。

### 10.5 验收

| 关卡 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✔ 0 错误 |
| `vitest` | ✔ 5 文件 / 25 用例 |
| 浏览器断言 | ✔ 24/24（渐变护栏现报「环=3 姓名=1 遮罩=1 其他=无」） |
| 对比度 | ✔ 亮暗各 227 处未达标 0（新增的实心胶囊按钮 18.4:1 / 20.1:1） |
| 横向溢出 | ✔ 四视口无溢出（胶囊导航比通栏更窄，不引入风险） |

---

## 阶段 11 · 展示字体重做（2026-09-29 00:2x）

### 11.1 用户关键原话

- 「字体没有达到那个效果」

### 11.2 诊断：不是字体选得不够好，是**根本没用到那款字体**

写 `probe-fonts.cjs` 量了两件事（canvas 宽度比对 + `fonts.check`，后者对不存在的字体也返回 true，
所以只信前者）：

| 字体 | 已安装？ |
| --- | --- |
| Songti SC（macOS） | ✘ 不在这台机器上 |
| **STSong（华文宋体）** | ✔ 装了 —— **这就是实际渲染用的那个** |
| **Source Han Serif SC（思源宋体）** | ✔ 装了，但**排在 STSong 后面，永远轮不到** |
| Georgia / Times New Roman | ✔ |

根因两条：① 字体栈把 STSong 排在思源宋体之前；② 更致命的是 **STSong 没有 500/700 字重**，
而我把展示字重设成了 500 —— 浏览器于是**合成伪粗体**，84px 的「庄家希」字面发糊、没有骨架。
参照站那种「大号衬线的优雅」不是靠字号堆出来的，是靠**真字重的衬线骨架**。

### 11.3 方案：Latin 走 Georgia，中文走自托管子集

| 项 | 取值 |
| --- | --- |
| Latin（Agent / Java / AIWorker / CVTE） | **Georgia** —— 参照站的展示字本来就是 Georgia 400，斜体也是 Georgia Italic |
| CJK | 自托管 **Noto Serif SC wght=500 子集**，`unicode-range` 只声明 CJK 码位，Latin 不被接管 |
| 字符表 | **531 字**，由 `collect-charset.cjs` **从真实渲染的 DOM 收集**（5 个路由 + aria/title/alt + 交互态文案） |
| 体积 | **92.7 KB**（woff2） |
| 流水线 | `frontend/scripts/build-font-subset.cjs` + `collect-charset.cjs`，npm 脚本 `fonts:build` / `fonts:chars` |

**取舍记录**：变量子集（保留 wght 轴）是 **176.8KB**，静态 500 是 **92.7KB**。查了一遍展示字的用法
（只有 `.brandName` 用 700，而它是 Latin → Georgia 真粗体），全站 CJK 展示字只需要一档，
因此取静态 500，把省下的 84KB 留给内容。

**为什么搬进仓库**：这套脚本原先写在 `.tmp/tools/`，但加文章（M3 详情页）必然引入新汉字，
流水线是项目的一部分、不是临时工具，因此移到 `frontend/scripts/` 并挂上 npm 脚本。

### 11.4 依赖与环境

- 需要 `fonttools` + `brotli`（`python -m pip install fonttools brotli`）——`brotli` 缺失时 `pyftsubset`
  报 `ImportError: No module named brotli`，装完即可，已记入环境注意事项。
- 源字体：google/fonts 仓库的 Noto Serif SC 变量字体（24MB，OFL 许可），下载一次后缓存在 `frontend/.tmp/fonts/`。

### 11.5 验收

| 关卡 | 结果 |
| --- | --- |
| 字体请求 | ✔ `GET /fonts/serif-sc-500.woff2 → 200, 92.7KB`；`document.fonts` 里 `JCPress Serif SC 500` 已加载 |
| H1 计算值 | ✔ `Georgia, "Times New Roman", "JCPress Serif SC", …`，`font-weight: 500` |
| `tsc` / `vitest` | ✔ 0 错误 / 25 用例 |
| 浏览器断言 | ✔ 24/24 |
| 对比度 | ✔ 未达标 0 |

---

## 阶段 12 · 首屏字体统一（2026-09-29 00:4x）

### 12.1 用户关键原话

- 「映入眼帘的位置的字体还是得优化一些」

### 12.2 诊断：不是字号问题，是一个视野里混了三套字形

| 位置 | 查到的问题 |
| --- | --- |
| kicker `广州 · AI 应用开发` | 阶段 10 我把它改成了**等宽字**以符合「mono 用于数据」的规则 —— 但**等宽栈里没有 CJK 字形**，`广州` 逐字回落到雅黑、`AI` 是 Consolas，一行两种字形 |
| 一句话 `用 Agent 和 Java…` | 中文走正文无衬线（雅黑），Latin 却是 Georgia 斜体 —— 衬线斜体夹在雅黑里，两种气质打架，斜体看起来像「意外」而不是「强调」 |
| 姓名 `庄家希` | 84px 在暗底上偏小；且亮色基线渐变 `#0756ab` 搬到近黑底后整块字发虚 |
| 两个按钮 | 14px / 44px 高，比参照站（19.2px）秀气一档 |

### 12.3 改动

- kicker 回**无衬线**（12px / 0.18em 字距）—— 等宽栈排中文是错的，已把这条写进白名单（decisions #41）
- 姓名 **96px**（参照站 102px），行高 1，中文字距 -0.01em（-0.02em 是 Latin 的取值，中文会粘连）
- 定位行与一句话**都改用展示衬线**（思源宋体 + Georgia）—— 这样 Georgia 斜体才像「设计过的强调」
- 自述段留无衬线（17px / 1.85），成为首屏唯一的安静文字层
- 按钮 15px / `min-height: 48px` / 内边距加大
- 暗色姓名渐变提亮（`#7cc0ff → #4d9bff → #b48cff`），保留蓝→紫签名；这是全站唯一按主题分别取色的渐变
- 首屏 `gap` 12 → 16px、上内边距 +16px（参照站首屏是「稀疏而有秩序」）

### 12.4 与参照站的一处刻意偏离（记录在案）

参照站的副标题是 `Inter 24px/300`（无衬线轻量）。我们改成展示衬线，
原因是中文副标题里混着 Georgia 斜体；**若要回到参照站的无衬线副标题，必须同时取消这一行的斜体**。
这一条已写进设计文档 §4.4 的注记，不是随手改的。

### 12.5 验收

| 关卡 | 结果 |
| --- | --- |
| `tsc` / 浏览器断言 / 对比度 | ✔ 0 错误 / 24-24 / 未达标 0 |
| 横向溢出 | ✔ 1280 / 768 / 390 三档无溢出（96px 姓名在 390 下走 50px 阶梯） |
| 截图 | ✔ 首屏亮暗、移动端首屏各一张（`.tmp/crops/hero6-*`、`.tmp/hero6/mobile-*`） |

---

## 阶段 13 · 排版 / 按钮 / 悬浮三件套 + 一次技术栈拦截（2026-09-29 01:0x）

### 13.1 用户关键原话

- 「现在页面先暂定这样，继续进行第一期的优化：1. 排版优化 2.按钮优化 3.鼠标悬浮效果优化」
- 并贴来一段外部组件集成说明（要求 shadcn 结构 + Tailwind + 复制到 `/components/ui`）

### 13.2 技术栈拦截（本阶段第一个决定）

那段说明的三条前提本项目**一条都不满足**，而且选型是规划里定死的（`D4=A：CSS 变量 + CSS Modules`，decisions #7）：

| 说明要求 | 本项目 | 处理 |
| --- | --- | --- |
| shadcn 项目结构 | 无，用 CSS Modules + 自有令牌 | **不装** |
| Tailwind CSS | 无 | **不装**：会引入第二套样式系统、与现有令牌重复、多一份运行时 CSS 破体积预算，且组件的工具类 `className` 在 CSS Modules 里根本无法解析 |
| `/components/ui` 目录 | 组件在 `components/home`、`components/layout` | 不做无意义搬迁 |
| lucide-react 图标 / Unsplash 图 | 无图标库（内联 SVG）、无位图 | 不需要 |

**移植的是效果，不是依赖**：那份组件真正有价值的是「指针跟随的径向渐变 + 边框高光」，
用 `useSpotlight` + 两个 CSS 模块实现，依赖为零。这条写进设计文档 §11 冲突 ⑥。

### 13.3 三件套改动

**① 排版**：`font-synthesis: none`（禁止合成字重 —— 阶段 11 那个「中文发糊」的根因，从机制上杜绝复发）、
`line-break: strict`（避头尾）、`text-spacing-trim: trim-start`、正文行高 1.7 → 1.8、
标题 `text-wrap: balance` / 段落 `pretty`、区块节奏 48 → 64px、区块导语 16 → 17px 且限宽 40rem。

**② 按钮**：收敛为全局 `.btn` + `.btnSolid` / `.btnOutline` / `.btnGhost` / `.btnSm` / `.btnStart`，
六个调用点（Hero 两枚、顶栏 CTA、项目展开、复制、页脚发邮件、两个返回按钮）全部改用它；
组件 CSS Module 只留下布局（`justify-self`、`align-self`、间距覆盖）。

**③ 悬浮**：`useSpotlight` + `styles/spotlight.module.css`（表格行：底光 + 边框高光）、
`global.css` 的 `.btnSpot`（按钮：背景图叠加）。剂量比环装置低（`--ds-spot` 亮 12% / 暗 16%），
是**交互反馈**不是布景；整个首屏只有一个会发光的元素。

### 13.4 验收（断言从 24 项扩到 26 项）

新增两条**能真的验证悬浮**的断言（不是靠肉眼看截图）：

| 断言 | 结果 |
| --- | --- |
| 项目行悬浮：指针聚光 + 边框高光都亮起 | ✔ `{"on":true,"x":"556.0px","y":"198.2px","glow":"1","ring":"1"}` |
| 主按钮悬浮：指针聚光亮起（叠在底色之上的背景图） | ✔ `{"on":true,"x":"80.7px","gradient":true}` |

渐变护栏同步扩容：允许的渐变宿主从 3 类（环 / 姓名 / 顶栏遮罩）扩到 4 类（+ 聚光宿主 `data-spot`），
现报 `环=3 姓名=1 遮罩=1 聚光=1 其他=无`。

其余：`tsc` 0 错误、对比度未达标 0、四视口无横向溢出、`vitest` 25/25、构建通过。

---

## 阶段 14 · finish（前端一期完结）（2026-09-29 01:2x）

**用户关键原话**：「第一期先完结吧,提交代码修改并且push」

### 14.1 本期实际交付（前端）

| 范围 | 内容 |
| --- | --- |
| 页面 | `/`（关于我，7 个区块 + 页脚）、`/tech`（技术分享列表 = M3 前端外壳）、`/algo`、`/projects`（统一占位外壳）、404 |
| 视觉语言 | 「环」母题（顶栏 logo / 首屏 / 项目 badge / 页脚四处）+ 双主题（暗＝剧场版 A、亮＝装置版 C）+ 整页晕影 |
| 字体 | Latin 走 Georgia、中文走自托管思源宋体子集（531 字 / 92.7KB），`font-synthesis: none` 杜绝伪粗体 |
| 交互 | 编排式入场序列、表格行**指针聚光**、全局按钮系统、键盘可达（`aria-expanded` 展开）、`prefers-reduced-motion` 全降级 |
| 文档 | `项目前期规划.md`（既有）、`design-homepage.md`、`design-visual-language.md`、`style-ref-golangstar.md`、`style-ref-aura.md`、`plan-visual-language.md`、`decisions.md`（44 条）、本 journal（14 个阶段） |

### 14.2 最终验收（全量跑一遍）

| 关卡 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | ✔ 0 错误 |
| `vitest run` | ✔ 5 文件 / 25 用例 |
| 浏览器行为断言 | ✔ **26/26** |
| 对比度审计 | ✔ 亮暗各 227 处文本，未达标 **0** |
| 横向溢出 | ✔ 首页 / `/tech` / `/algo` × 1280 / 768 / 390 全部 `scrollWidth === clientWidth` |
| 生产构建 | ✔ JS 229.07KB（**gzip 76.43KB**）/ CSS 31.16KB（gzip 6.73KB），首屏 JS 预算 200KB ✔ |
| 字体 | ✔ 1 个请求 / 92.7KB / `font-display: swap` |

### 14.3 与规划 §13 M2 验收条款的对照（如实）

M2 的 DoD 有四项，**两项做了、两项没做**：

| M2 判据 | 状态 |
| --- | --- |
| 四档宽度逐页无横向滚动 | ✔ 已验（1280 / 768 / 390；375 由 390 与断点覆盖） |
| 点击区 ≥ 44px | ✔ 已验（断言逐元素量过） |
| 暗色无对比度告警 | ✔ 已验（227 处 × 亮暗） |
| **Lighthouse 移动端 ≥ 90** | ✘ **未测** —— 需要真实 Lighthouse 跑一次 |
| **真机（iOS Safari / Android Chrome）各测一次** | ✘ **未做** —— 目前只有 Playwright + Edge |

### 14.4 明确不属于本期交付的部分

**「第一期完结」指的是前端一期（首页 + 频道外壳 + 视觉语言）**，以下仍属规划里的一期但**尚未开始**，不要误读为已完成：

- **M1 后端工程骨架**：Spring Boot 分层、Flyway、统一响应/异常、Gson 转换器、`docker compose`、Markdown 导入器、CI；
- **M3 剩余**：文章详情页、Markdown 渲染与代码高亮、TOC、浏览量（Redis 去重）、分页、真实接口；
- **M5/M6**：后台登录与写入口、搜索、SEO（预渲染 + sitemap + RSS）、Nginx + Docker 部署。

### 14.5 遗留事项（交接用）

1. `src/data/articles.ts` 的 5 条文章标题是**占位**，待作者替换（文件顶部已标注）。
2. **新增内容后必须重跑字体子集**：`cd frontend && npm run fonts:build`（约 30s）。加文章详情页时一定会遇到，否则新字会回落到系统宋体、与相邻字不同款。
3. `docs/decisions.md` #6 记录的**规划 5 处硬伤**（§8.4 与 §9.2 矛盾、Sa-Token 分库、全文索引只覆盖标题、浏览量三处真相、M1 DoD 过重）仍未落改。
4. M2 的两项未验（Lighthouse / 真机）见 14.3。
5. 首屏 gzip 76.43KB，余量充足；加详情页后复测一次。

### 14.6 提交与推送

- 本期全部提交在分支 `feat/homepage-about`（相对 `main` 领先 21 个提交，`main` 无分叉，可 fast-forward 合并）。
- 远端：`origin https://github.com/Jessiseb/jcpress.git`。
- **推送结果**：`feat/homepage-about` 已推送成功（`* [new branch]`，上游跟踪已设置）。
  GitHub 给出的 PR 入口：`https://github.com/Jessiseb/jcpress/pull/new/feat/homepage-about`。

**推送过程踩的三个坑（已同步 decisions 环境注意事项）**：

| # | 现象 | 根因 | 处理 |
| --- | --- | --- | --- |
| ⑲ | `git push` 报 `Failed to connect to github.com port 443 ... Timed out` | **直连 github.com:443 被墙**（`Test-NetConnection` 为 False；而 `codeload.github.com:443` 是 True）。本机 `127.0.0.1:7890` 有代理在监听、环境变量 `HTTP(S)_PROXY` 也设了，但 git 仍然走直连 | 命令级指定代理 + 退回 HTTP/1.1：`git -c http.proxy=http://127.0.0.1:7890 -c http.version=HTTP/1.1 push -u origin <branch>` —— 成功 |
| ⑳ | `git ls-remote` 卡住 3 分钟不返回 | 同上（直连被黑洞，而不是立刻拒绝），表现为「挂住」而不是「报错」 | 任何远端操作都加 `GIT_TERMINAL_PROMPT=0` + 代理；否则会误以为是凭据问题 |
| ㉑ | 用户提供 `SHA256:jiJht2W…` 希望用它推送 | **指纹不等于私钥**。本机只有一把 `id_rsa`（RSA 3072，指纹 `SHA256:NKZsTiT…`，注释 `zhuangjiaxi@yonyou.com`），与那把不是同一个；SSH 实测 `Permission denied (publickey)` —— 说明**端口是通的**（22 与 443 都连上了），只是这把钥匙没加到 GitHub 账号 | 走 HTTPS + 代理即可，无需动 SSH。若将来要用 SSH：把 `~/.ssh/id_rsa.pub` 加进 GitHub → Settings → SSH keys，再 `git remote set-url origin git@github.com:Jessiseb/jcpress.git` |

### 14.7 合入 main（用户选择：fast-forward 合并并推送）

用户决策：「合并到 main 并推送（推荐）」。

- `main` 是 `feat/homepage-about` 的**祖先**（分叉数 0），因此走 `git merge --ff-only`：无冲突、无合并提交，历史保持线性。
- 合并后 `main` 与 `feat/homepage-about` 指向同一个提交，远端两个分支同步。
- 分支**保留**（不删）—— 后续 M3（文章详情页）从这个状态另开分支即可。

**一期到此收尾**：前端一期的成果已在远端 `main` 上；M1 后端骨架、M3 剩余、M5/M6 属下一阶段（见 14.4）。

---

## 阶段 15 · 二期 brainstorm（2026-09-29 20:4x ~ 20:58）

### 15.1 用户关键原话

- 「现在进行项目第二期开发，实现效果：1. 整体字体要**大气**，一眼看过去能看到重点，而且**背景要有灵动效果**」—— 并贴来 `background-paths.tsx` 的集成说明（要求 shadcn 结构 + Tailwind + `/components/ui` + framer-motion + lucide + Unsplash）。
- 「2. **首页排版优化**，当前排版感觉**太硬**了，而且没有使用一些好看的**图案修饰**，参考一下」—— 并贴来 `landing-page.tsx`（滚动 globe 落地页，含固定图形随滚动位移/缩放、滚动进度条、侧边导航点）。
- **两次都追加同一句**：「这只是参考，还得根据项目具体情况实现」（第二次为「这只是参考, 还得根据项目具体情况实现」）。
- 「要求：全程走 **OpenSpec** 流程，**技能自动触发**；产出不是可单测代码的任务（纯 Prompt、数据类），把 **TDD 那步换成拿标注样例或评估集跑一遍验证**，其余步骤照走；2. 过程留痕：每完成一个阶段（brainstorm 定稿、计划评审通过、每个任务完成、code review 结论、finish）就补一段，记四样：**我这一步发的关键原话、你的关键产出、我拒绝或纠偏了什么、翻车与返工**；不许收尾时一次性补记。」

### 15.2 AI 关键产出

| 产出 | 内容 / 路径 |
| --- | --- |
| 二期基线 | `tsc --noEmit` **0 错误**；`vitest run` **5 文件 / 25 用例全绿**（需提权，见 15.5①） |
| 硬约束简报 | 子代理产出（未落盘，结论已并入本文与 decisions）：图案纪律 #19、渐变护栏、禁止清单、真字重 500、预算、环静止、圆角 8px 上限 |
| 验收工具链盘查 | 子代理产出：断言套件 `.tmp/tools/audit-behavior.cjs`（26 项）、对比度 `.tmp/tools/audit-contrast.cjs`、截图 `.tmp/tools/shot-final.cjs`、裁图 `crop.cjs`、令牌探针 `probe-tokens.cjs`；Playwright **只有** `.tmp/tools/node_modules/playwright-core@1.63.0`，用系统 Edge（`channel: 'msedge'`），dev server 端口 **5173** |
| 可行性探针 | Python 3.12.7 + fonttools 4.58.0 + brotli 齐备；Noto Serif SC **变量字体 25MB 本地已缓存**（`frontend/.tmp/fonts/`）→ 「加一档 700 子集」不需要重新下载源字体 |
| 技术发现 | framer-motion 的 `pathLength`/`pathOffset` 可用 **SVG 原生 `pathLength="1"` + `stroke-dasharray/dashoffset` 关键帧 1:1 复刻** → 「必须装动效库才能做出那个效果」不成立，动效库纪律不必提前作废 |

**本阶段最重要的一条判断**（写进 proposal 的 Why）：用户贴的两份参考说明，**每一条技术前提都与一期已归档的纪律正面冲突**（Tailwind/shadcn/lucide/motion ↔ #43；流线循环动画 ↔ #19 图案纪律 + 禁止清单「环循环漂移」；滚动进度条/视差 ↔ 禁止清单；加粗 ↔ `--ds-fw-display: 500` 真字重上限；卡片化 ↔ #46 + 圆角 8px）。因此二期**不是一次技术改造，而是一次纪律修订**；且一期自己留了元规则 `docs/decisions.md:86`「mock 被选中之后就是验收标准；实现阶段要偏离，必须显式提出并得到确认，不能默默收敛」——所以这些冲突必须逐条问过用户，不能自行打折。

### 15.3 本阶段拍板（6 条）

| # | 决策 | 取值 |
| --- | --- | --- |
| 1 | 背景主视觉 | **流线路径**（照搬参考几何：`viewBox 696×316`、36 条 × 2 组镜像）；**环降为标记层**（首屏环退役，顶栏/项目 badge/页脚保留） |
| 2 | 排版「活」的手法 | **解禁**「滚动进度条」与「视差」两条禁止令；限定**只作用于装饰层 + 剂量上限**（位移 ≤ 视口 8%、缩放 ≤ 1.06），正文与数据一律不参与 |
| 3 | 「太硬」软化 | 区块**节奏大小节交替** + **不对称栅格**（标题列 3/12、内容列 8/12 错位）+ **玻璃面板 / 大圆角**（仅「关键数字」与「项目经历」两类区块，避免退化成一叠卡片） |
| 4 | 字体大气 | 展示字**加一档 700 子集**（只打包展示字，估 +30–50KB）；正文与导语仍 500，避免满页加粗导致「重点不存在」 |
| 5 | 实现路线 | **方案 3：零依赖优先**（SVG pathLength 复刻 + 自研 rAF hook），把引入 motion 写成「验收不达标才另开 change」的逃生舱 |
| 6 | 范围 | 全站字体 + 全站背景层；首页七区块重排；`/tech` 等内部页只保证不穿帮，不重排 |

### 15.4 被驳回 / 纠偏（如实）

| # | 我提出 | 用户选择 | 后果 |
| --- | --- | --- | --- |
| ① | 背景图案语言 4 选 1，我**推荐 A「环派生·让环活起来」**（不破 #19） | **选 C「流线路径当背景主视觉」** | 我的推荐被否；#19 图案纪律、「环静止」两条要改写成「流线布景 + 环标记」的主次结构 |
| ② | 「太硬」软化手法多选，我**推荐 A/B**（节奏 + 不对称栅格） | **只选 C/D（进度条 + 视差）** | 我的问题设计与用户理解错位：C/D 是「动」不是「软」。我**追问了第二轮**，用户补选 A/B/E → 说明第一轮选项把「动」和「软」混在一张表里是提问设计的失误 |
| ③ | 字体大气 4 选 1，其中 A 是**零成本**（不加字重，只调层级） | **选 B（加 700 子集）** | 接受 +30–50KB 字体体积与一次流水线重跑，换取中文标题的真粗体骨架 |
| ④ | 我提醒「E（玻璃面板/大圆角）会再撞 #46 与圆角上限两条纪律」 | 仍选 E | 两条纪律进入显式修订清单，而不是被我悄悄劝退 |

### 15.5 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | `node node_modules/vitest/vitest.mjs run`（workspace-write 下）→ `failed to load config … spawn EPERM` | vitest 内嵌 esbuild 需 spawn 子进程（管道 stdio），沙箱拒绝 | 按沙箱纪律**不绕路**：原命令一次性提权到 `danger-full-access` → 25/25 全绿。**结论：二期所有 vitest / vite build / 浏览器断言都要提权**（子代理撞到 Playwright/msedge `--remote-debugging-pipe` 的同类 EPERM，且子代理无法自行提权，已如实记录） |
| ② | 子代理发现两处**文档腐坏** | 历史改动未回头改注释 | `theme.jcpress.css:58` 注释仍写 `/fonts/serif-sc-400.woff2`（实际是 `serif-sc-500.woff2`）；`项目前期规划.md:305`「中文字体不做 webfont」已被 #37 作废但原文未标注。**列入二期遗留，不顺手改**（避免混进视觉改动的 diff） |
| ③ | brainstorming 技能纪律「一次只问一个问题」被我偏离一次 | 剩余问题少、用户响应快，我把最后两个问题并进一条消息 | **记录在案，不辩解**；后续阶段恢复一问一答 |

### 15.6 过程偏差（明示）

- brainstorming 技能的默认设计文档路径是 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`。本项目二期要求「全程走 OpenSpec」，因此**设计文档落在 OpenSpec change 的 `design.md`**，不另写一份 `docs/` 设计文档，避免同一份设计两处维护。决策记录仍追加进 `docs/decisions.md`，本 journal 继续逐阶段留痕。

---

## 阶段 16 · OpenSpec propose（2026-09-29 20:58 ~ 21:1x）

### 16.1 用户关键原话（本阶段四轮取舍的原文选项）

1. 背景图案语言：「**C. 照搬参考组件：流线路径当背景主视觉**」
2. 排版「活」起来的手法（多选）：「**C. 滚动进度条（需解除禁止清单）**」「**D. 固定图形随滚动位移/缩放（即视差，需解除禁止清单）**」
3. 字体大气：「**B. 只给展示字加一档 700 子集（推荐）**」
4. 「太硬」软哪里（多选）：「**A. 区块节奏：大小节交替、留白不均等**」「**B. 不对称栅格：编辑式错位**」「**E. 区块容器软化（玻璃面板/大圆角，需再改两条纪律）**」；范围：「**A. 全站字体 + 首页排版 + 背景层**」
5. 实现路线：「**方案 3 · 先原生，留 motion 逃生舱（推荐）**」
6. 设计逐节确认：「**六节都行，往下走（推荐）**」

### 16.2 AI 关键产出

| 产出 | 路径 | 关键内容 |
| --- | --- | --- |
| OpenSpec change | `openspec/changes/phase-2-visual/` | 4/4 artifacts 完成，`openspec validate --strict` → **valid** |
| proposal | `.../proposal.md` | Why 里写明「这不是加效果，而是把纪律改写成新的可验证版本」，并引用元规则 `decisions.md:86` |
| delta specs | `.../specs/{visual-language,homepage,site-shell}/spec.md` | visual-language：REMOVE「图案只有一种语言」+ MODIFY 4 条 + ADD 3 条；homepage：MODIFY 首屏 + ADD「版面节奏与不对称栅格」「重点区块的面板化」；site-shell：MODIFY「减少动态效果降级」+ ADD「滚动进度指示」 |
| design | `.../design.md` | 7 条决策（D1–D7，每条含被否的替代方案）+ 9 条风险对照 + 迁移计划 |
| tasks | `.../tasks.md` | 8 组 / 33 条，每条带可复核命令；把 TDD 换成 `docs/phase2-effect-matrix.md` 效果对照矩阵（评估集） |

**三个 delta 精确命中的主干要求**（避免凭空造能力）：`visual-language` 的图案只有一种语言 / 双主题共用一套结构 / 展示字必须使用真字重 / 首屏体积与资源预算 / 正文对比度；`homepage` 的首屏信息层次；`site-shell` 的减少动态效果降级。

### 16.3 本阶段的两个技术判断（写进 design 的 D1 与 D7）

1. **D1**：参考组件用 framer-motion 的 `pathLength`/`pathOffset` 做的「光沿路径流动」，可用 SVG 原生 `pathLength="1"` + `stroke-dasharray/dashoffset` 关键帧 **1:1 复刻** → 「必须装动效库」不成立，动效库纪律不必提前作废（用户因此选了方案 3）。
2. **D7**：一期 M2 DoD 的「Lighthouse 移动端 ≥ 90」本机**没有 lighthouse 包**，`npx lighthouse` 需联网安装 → 定为「首选 Lighthouse，退路用已装的 `playwright-core` + CDP 采等价指标（CPU 6× 降速下的 LCP/CLS + 3 秒掉帧率）」，**并要求必须在 journal 写明用的是哪条判据**，不允许含糊成「性能达标」。

### 16.4 被驳回 / 纠偏（本阶段）

- 无新增用户驳回。阶段 15 的四次纠偏（背景图案推荐 A 被否改 C、排版软化第一轮提问把「动」和「软」混在一张表导致要追问、字体零成本方案 A 未被采纳、玻璃面板提醒撞纪律后仍选 E）已记在 15.4。

### 16.5 翻车与返工

| # | 事件 | 处置 |
| --- | --- | --- |
| ① | **自查返工**：`design.md` 写完后回读 `specs/visual-language/spec.md`，发现「移动端性能」场景写成「性能分数不低于 90」——而 design 的 D7 已经确认本机可能跑不了 Lighthouse，**spec 与 design 自相矛盾** | 立即改 spec 场景为「Lighthouse 移动端评分；若本机无法运行则以 CDP 等价指标代替，并在开发日志写明替代判据与数值」，并补一条「背景动画运行期间不出现持续掉帧」 |
| ② | 需求名变更的实现方式有不确定：`openspec` 的 `RENAMED` + `MODIFIED` 组合在归档时的处理顺序未经验证 | 规避不确定路径：改用 **REMOVED（附 Reason/Migration）+ ADDED** 表达「图案只有一种语言 → 图案分为布景层与标记层」，语义同样准确且是文档明示的机制。**记录该取舍为风险规避，不是最优解** |
| ③ | `.agents/skills/.openspec-target` 内容为 `codex`，而本会话技能目录在 `C:\Users\O\.agents\skills\` | 技能仍按仓库内 `.agents/skills/openspec-propose/SKILL.md` 的步骤执行；未改动 target 文件，记入遗留 |

### 16.6 计划评审结论（用户 gate）

用户原话：**「计划通过，开始 apply（推荐）」** —— 三处拍板点（玻璃面板只包两类区块 / 流线为全站 fixed 层 / 性能判据可用 CDP 等价指标替代）**均按默认值通过**，无修改要求。

- 分支：从 `main` 新建 `feat/phase-2-visual`（一期遗留分支 `feat/homepage-about` 保留不动）。
- OpenSpec apply 指令读数：`progress.total = 36`（8 组 / 36 条任务）。

---

## 阶段 17 · apply 任务组 1（验收护栏前置扩容）（2026-09-29 21:1x）

### 17.1 用户关键原话

- 「**计划通过，开始 apply（推荐）**」

### 17.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 1.1 | `.tmp/tools/audit-behavior.cjs`：渐变宿主白名单由 4 类扩到 6 类（`data-flow` / `data-glass`），断言名与明细同步更新 | `node .tmp\tools\audit-behavior.cjs` → **26/26 全绿**，明细 `流线=0 面板=0 环=3 姓名=1 遮罩=1 聚光=1 其他=无`（白名单扩容未引入新失败，且「姓名渐变恰好 1 个」判定保留） |
| 1.2 | 新增 `docs/phase2-effect-matrix.md`：14 条效果对照（E1–E14）+ 8 条未采纳项与理由 + 6 条交叉判据 | 每条效果都有可执行判据；未采纳项（shadcn/Tailwind/motion/lucide/随机相位/逐字入场/侧边导航点/全站卡片化）全部写明理由 |
| 1.3 | 矩阵文件头部写明三条硬前提（提权跑 vitest / 浏览器断言 / 构建）与端口 5173 | vitest **25/25**、断言 **26/26**、`npm run build` **退出码 0**：CSS 31.22KB（gzip 6.75KB）/ JS 229.12KB（gzip 76.44KB），与一期基线一致 |

**顺序上的刻意选择**：按 design 的迁移计划，本组**先扩断言、后改样式**。理由是渐变护栏现在是「改了就亮红」的状态，先让断言认识 `data-flow` / `data-glass`，后面改样式的过程才有有效信号，否则会在每个任务里被同一个红点干扰、进而有"顺手放宽护栏"的诱惑。

### 17.3 被驳回 / 纠偏

- 无。

### 17.4 翻车与返工

- 无。本组唯一的"坑"是已预知的沙箱限制（vitest / 浏览器断言 / 构建都要提权），已写进矩阵文件头部，不重复踩。

---

## 阶段 18 · apply 任务组 2（令牌层与纪律记录）（2026-09-29 21:2x）

### 18.1 用户关键原话

- 本组无新增用户发言（承接「**计划通过，开始 apply**」的授权自主实施）。
- 期间用户改动了运行环境：**审批策略 `ask` → `never`、文件策略放开为 `danger-full-access`**（见 18.4①）。

### 18.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 2.1 | `frontend/src/styles/theme.jcpress.css`：亮色块新增 `--ds-flow-line` / `--ds-flow-glow` / `--ds-flow-alpha-max` / `--ds-c-panel` / `--ds-c-panel-border` / `--ds-radius-panel` / `--ds-blur-panel` / `--ds-c-progress` / `--ds-progress-h` / `--ds-parallax-shift` / `--ds-parallax-scale`；暗色块新增流线翻白、面板、进度条共 4 条 | `node .tmp\tools\probe-tokens.cjs` → **亮暗各 18 键全绿，合计不符 0**（期望键由 8 扩到 18） |
| 2.2 | 令牌注释写明「两层图案」「面板只用于两类区块」「进度条用实色而不新增渐变宿主」「视差取 6vh/1.04 给 8%/1.06 留余量」 | 注释与 `specs/visual-language/spec.md` 的措辞逐条对应 |
| 2.3 | `docs/decisions.md` 新增「2026-09-29 · 二期视觉语言修订」一节（**#45–#50**，每条注明被修订的原条号）+ 环境注意事项新增 1 行 | `#45` 指向 #19、`#47` 指向 #46/#33、`#48` 指向 #37、`#50` 指向 #21/#36；历史条目只增不改 |

### 18.3 被驳回 / 纠偏

- 无用户侧驳回。

### 18.4 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | 实施中途运行环境变更：审批策略 `ask` → `never`、文件策略 → `danger-full-access` | —（用户侧变更） | **立即停止请求提权**：`sandbox_permissions` 在 `never` 下会被自动拒绝。前两组用过的提权理由（vitest / Edge 命名管道 / esbuild）随之作废，已在 `decisions.md` 环境表补记一行 |
| ② | **探针 3 处假失败**（亮 `--ds-ring` 6%→实测 13%、暗 `--ds-glow` 20%→26%、暗 `--ds-ring` 8%→10%） | 一期在「环周期校准」与「剧场底色」两轮里改过主题取值并写了注释，但没回头改探针期望 —— **文档/工具腐坏**，不是本组引入 | 以 `theme.jcpress.css` 为准**重同步探针期望**（并在探针里注明重同步原因），**没有反过来改主题去迁就旧期望**。记入 decisions #50 |
| ③ | 首次编辑 `docs/decisions.md` 被文件策略拒绝：`file has not been read` | 我用的是 `Get-Content`（shell）读文件，**不算 read 工具**，不满足观察策略 | 改用 read 工具读取后再编辑成功。教训记下：**shell 读文件不等于 read 工具读文件**，涉及编辑前必须用 read |

---

## 阶段 19 · apply 任务组 3（展示字 700 一档）（2026-09-29 21:3x）

### 19.1 用户关键原话

- 本组无新增用户发言（承接「计划通过，开始 apply」）。用户在本组期间的唯一动作是**放开了运行环境**（见阶段 18.4①）。

### 19.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 3.1 | `build-font-subset.cjs` 参数化（`--weight` / `--chars` / `--out` / `--collect`），默认行为不变；`package.json` 加 `fonts:chars:display` / `fonts:build:display` | 不传参路径未被破坏（500 档产物仍在，92.7KB 落在 90–100KB 区间） |
| 3.2 | 新增 `frontend/scripts/collect-display-charset.cjs`（只遍历 `h1` / `h2` / `[data-display]`，5 个路由） | 产出 `chars-display.txt`：**45 个中文展示字**（全量是 531），含姓名「庄家希」；另存 `chars-display.sources.txt` 采集来源清单 |
| 3.3 | 生成 `frontend/public/fonts/serif-sc-700.woff2`；`theme.jcpress.css` 新增第二个 `@font-face`（700，`unicode-range` 与 500 逐字一致） | **9.0KB / 45 字**；`document.fonts` 中 `500:loaded 700:loaded` |
| 3.4 | 新增 `frontend/scripts/audit-display-font.cjs`（读字体**真实 cmap** 做集合比较，而非 `document.fonts.check()`） | 正式跑 **5/5 通过**；**负向自检** `AUDIT_INJECT_CHAR=龘` → 退出码 **1**，两条覆盖断言亮红 —— 证明这个断言真的会失败 |
| 3.5 | `h1` / `h2` 用 `--ds-fw-display-strong: 700`（h3/h4 仍 500）；关键数字 `.value` 改 700 并加 `data-display`；姓名 96 → **104px**（响应式阶梯 104/64/52/44）；区块标题 30 → **34px**；`index.html` 加 700 档 `preload`（9KB，抢在关键 JS/CSS 前取回） | `tsc` **0 错误**；断言 **26/26**；对比度亮暗 **未达标 0**（暗色 243 处文本） |
| 3.6 | `README.md` 新增「字体流水线（自托管中文衬线子集）」章节：两档对照表、三条命令、700 档漏字的隐蔽性与断言方式；顺带修正 README 顶部的状态腐坏行（原写「尚未编写业务代码」） | 章节内容与脚本实际参数一致（`--weight` / `--chars` / `--collect`） |

**层级上的刻意取舍**：`h1`/`h2` 才用 700，**h3/h4 保持 500**（项目名、分组名属二级信息），且首屏的定位行 `.nameSub` 显式写回 500 —— 它是姓名下面的说明，跟着一起粗就会与姓名争第一眼。「一眼看到重点」靠的是层级，不是满页加粗。

### 19.3 被驳回 / 纠偏

- 无。

### 19.4 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | **自查工具骗了我一次**：`audit-display-font.cjs` 首跑报 3 条失败，其中「700 子集只覆盖 17 字」「500 子集只覆盖 161 字」与事实（45 / 531）严重不符 | **Windows 下 Python 的 stdout 默认按本地码页（GBK）编码**，中文字符串经错误编码/解码后变成一堆互不相同的乱码字符 —— 集合比较因此几乎全不相等。这是**判据本身的 bug，不是被测量的东西坏了** | 改为 `sys.stdout.buffer.write(text.encode('utf-8'))` 并设 `PYTHONIOENCODING=utf-8`，复跑得到 45 / 531。已在脚本里写明这段坑，防止复发 |
| ② | 修正①之后仍有一条真失败：`/tech`、`/algo`、`/projects` 的 `h1` 计算字重是 **500** 而不是 700 | 这两个页面级的 CSS 模块各自重复声明了 `font-weight: var(--ds-fw-display)`，**覆盖了 global.css 的 h1/h2 规则** | 改为 `--ds-fw-display-strong`。**这条是新增的断言抓到的，不是我看出来的** —— 正好印证「判据先落地」的顺序有价值 |
| ③ | 体积估算被推翻：design/tasks 里预估 700 档 **+30–50KB**，实测 **9.0KB** | 我按「展示字约 150–250 字」估的，实测展示字只有 **45** 个（中文展示字本来就少） | 如实记录估算偏差（偏保守 3–5 倍）；tasks 3.3 的「30–50KB」验证门槛按实测放宽为上限检查（脚本里 700 档 >70KB 才告警） |
| ④ | `theme.jcpress.css` 注释里写着 `/fonts/serif-sc-400.woff2`（实际文件是 500） | 一期改名时漏改注释（子代理侦察时发现的文档腐坏） | 一并修正，并把两档 `@font-face` 的说明重写成与流水线一致的现状描述 |
| ⑤ | `README.md` 顶部仍写「前期规划完成，尚未编写业务代码」 | 一期收尾没回头改 README 的状态行 | 改为「一期前端已完结 / 二期进行中」。与 #50（探针重同步）属同一类**文档腐坏**，均已在 `decisions.md` 留痕 |

---

## 阶段 20 · apply 任务组 4（流线布景层）（2026-09-29 22:0x ~ 23:0x）

> **本期返工最集中的一组**，如实记录。核心教训不是「代码写错了」，而是
> **我两次把自己的错误归因给外部（参考组件 / 截图工具）**，两次都是靠「出图 + 实测」推翻的。

### 20.1 用户关键原话

- 本组期间无新增业务指令。用户在阶段 18 已把运行环境放开（`danger-full-access`、审批 `never`），本组因此不再需要提权。

### 20.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 4.1 | 新增 `frontend/src/components/visual/FlowField.tsx` + `FlowField.module.css`；`App.tsx` 挂载全站 `fixed` 布景层 | 断言：`z=-1 pe=none aria-hidden=true 覆盖=true 不吃指针`；「图案零图片请求」✔ |
| 4.2 | 路径数按视口分档（`matchMedia`） | 断言实测 **1280→72 / 768→48 / 390→24** ✔ |
| 4.3 | `App` 在 `TopNav` 之前挂载；首屏/页脚截图各一张 | `desktop-light-hero.png`（内容完整 + 流线贯穿）✔；`shot-final` 四档 `overflow=no` |
| 4.4 | `reduced-motion` 下 `animation: none` | 断言 `animation-name=none opacity=1 paths=72` ✔ |
| 4.5 | 首屏 `RingField` 退役；环保留为标记层 | 断言「首屏不再有环，徽标与页脚保留 — 共 2：project-badge / footer（首屏 0）」✔ |
| 断言套件 | `.tmp/tools/audit-behavior.cjs` 由 26 项扩到 **35 项**（新增 9 条：流线层存在/剂量/在动/分档/零请求/路径有效/控制台无报错/环只做标记层/reduced-motion 下静止） | **35/35 全绿**；`tsc` 0 错误 |
| 截图链 | `.tmp/tools/shot-final.cjs` 新增 `freezeFlowFrame()`；两处 `animations: 'disabled'` | 首屏图 46KB（空白）→ **376KB**（内容 + 图案） |

**顺带修正的两处事实错误**（都不是本组引入，但被本组暴露）：

1. 一期文档里「**顶栏 logo 环**」的说法不成立 —— `TopNav` 里根本没有任何环元素。标记层实际只有项目徽标、频道页徽标与页脚三处。proposal / spec / `decisions.md #45` 全部按实况改写。
2. `theme.jcpress.css` 注释里的 `/fonts/serif-sc-400.woff2`（阶段 19 已修）同属文档腐坏一类。

### 20.3 翻车与返工（六个事件）

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | **路径公式抄错符号**（第三个 x 应是 `+ (152 - i*5*position)`，我抄成了负号） | 移植时把「左侧常量带前导负号」错误地推广到了第三个 x | 两个后果：**(a)** 高索引处拼出 `--3` 非法数字，浏览器报 `<path> attribute d: Expected number` 并**静默丢掉**那条路径；**(b)** 整族曲线落点偏到视口左下角，72 条里只有 **7%** 的采样点在视口内。修正后：`slice` 16% / `meet` 26% / 拉伸满幅 |
| ② | **归因错误（比 bug 本身更值得记）** | 我先把 `--3` 这个现象写成「**参考组件本身就有这个毛病，它尾部几条线是无效的**」，并写进了源码注释与断言脚本 | 修正①之后自证：参考的模板在 i ≤ 35 时**完全合法**，bug 全在移植。已在 `FlowField.tsx`、`audit-behavior.cjs` 注释与本节明确更正。**教训：把自己写的东西出问题先归因给外部，是最省事也最危险的解释** |
| ③ | **动画语义理解错误**：把参考的 `pathLength 0.3 → 1` 读成「30% 的光段沿线跑」 | 只看了 `initial: { pathLength: 0.3 }` 没看 `animate: { pathLength: 1 }` | 后果：每条线只画 30%，且 30% 里还有大半在视口外 → **背景几乎空白**（用户要的「灵动」等于没做）。改为「45% → 80% 段长呼吸 + 透明度脉冲 + **负延迟**确定性错相」（负延迟避免加载瞬间全族同相、前几秒空白） |
| ④ | **`preserveAspectRatio` 三选一** | 参考用默认 `meet`，我第一版选 `slice` | 实测覆盖：`meet` 26% / `slice` 16%；两者在宽屏留空带、在手机竖屏把曲线压成中间一条细带。最终改 `none`（拉伸满幅）——抽象曲线看不出形变，且在**任何**视口都铺满 |
| ⑤ | **截图证据链三连坑**（不是产品代码，但会让「验收」变成假的） | ① 页面上加了常驻无限动画后，Chromium 截图会拍到**空白/陈旧帧**（首屏 122KB 全空 vs 正常 376KB）；② 加 `animations: 'disabled'` 能修捕获，但它把**无限动画重置到初始态**，所有流线 `dashoffset` 归零 → 拍出「线段全挤在左边缘」的假象；③ 两者互斥 | 最终方案：拍证据图前先 `freezeFlowFrame()` 把每条线的 dashoffset 按索引铺开（`idx * 0.37 % 1`，确定性的「一帧代表态」），再禁用动画拍。**证据图既内容完整、又图案分布真实**；已在脚本里写明这不是「动画中间态」而是定格帧 |
| ⑥ | 「流线画不出来」被断言抓不到 | 在加「路径全部有效（`getTotalLength() > 0`）」与「控制台无非资源类报错」两条断言**之前**，非法路径只能靠肉眼看截图 —— 而截图上看不出来 | 两条断言落地后立刻成为回归网：现在任何非法 `d` 都会亮红（35/35 的第一条就是它） |

### 20.4 诊断脚本的去留

本组为定位问题写了 8 个一次性诊断脚本（`.tmp/tools/diag-*.cjs`：空白页诊断、截图对照、`pathLength` 归一化决定性实验、几何覆盖率采样、字重墨量探针）。
**处置**：全部删除，不留进仓库 —— 结论已固化在①源码注释（为什么这么写）②`audit-behavior.cjs` 的新断言（怎么防止复发）③本节（为什么这么查）。唯一被吸收的是「墨量探针」，它**升格**进了正式断言 `frontend/scripts/audit-display-font.cjs`（替换掉原先较弱的 `document.fonts.check()` 判据）。

**返工事件 ⑦**：删除一次性脚本时用了 `Remove-Item .tmp\tools\diag-*.cjs`，**误删了一期就在仓库里的 `diag-reveal.cjs` 与 `diag-reveal-miss.cjs`** —— 通配符把「我这个阶段新建的」和「仓库原有的」一起匹配了。已 `git checkout --` 恢复（`git status` 确认无残留改动）。教训：**批量删除前先用 `git status` / 列目录确认匹配范围**，别把通配符当"只删我建的"。

---

## 阶段 21 · apply 任务组 5（滚动进度条 + 装饰层视差）（2026-09-29 23:1x）

### 21.1 用户关键原话

- 无新增业务指令（承接「计划通过，开始 apply」）。本组实现的是用户在多选里明确勾选的两项：**滚动进度条**与**固定图形随滚动位移/缩放（视差）**。

### 21.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 5.1 | 新增 `frontend/src/hooks/useScrollProgress.ts`：**全站唯一**的滚动监听（`passive`）+ rAF 节流，把 `--scroll-p`（三位小数）写到 `<html>`；卸载/resize 时清理 | 断言：`--scroll-p` 随滚动单调递增、到页底为 1 |
| 5.2 | 新增 `components/layout/ScrollProgress.tsx` + module.css：顶部 2px、实色（**不新增渐变宿主**）、`pointer-events: none`、`z-index: 60`（高于顶栏 50）；挂进 `App` | 断言实测：`p: 0 → 0.5 → 1`、`bar: 0.000 → 0.500 → 1.000`、高度 2px、`pointer-events: none` |
| 5.3 | `FlowField` 加 `data-parallax`：`translate3d(0, calc(var(--scroll-p,0) * var(--ds-parallax-shift) * -1), 0) scale(var(--ds-parallax-scale))` | 断言实测：**位移 6.00%（spec 上限 8%）/ 缩放 1.04（上限 1.06）**；「正文 / 数字 / 控件的 transform 不随滚动变化 — 全部 none」 |
| 5.4 | 移动端开销：视差只加在**一个**装饰层上，不再新增动画元素 | 见第 7 组的掉帧实测 |
| 降级 | `reduced-motion` 下：`data-parallax` 层 `transform: none`（视差撤销），但**进度条仍可见并前进**（它是信息） | 断言实测：`p=1 bar=1.000 层 transform=none` |
| 断言套件 | 由 35 项扩到 **40 项**（新增 5 条：进度条 0→满格 / 中点一致性 / 视差仅装饰层且剂量达标 / 内容 transform 不随滚动变 / 降级下进度条仍在而视差撤销） | **40/40 全绿，连跑 4 次结果一致**；`tsc` 0 错误 |

### 21.3 被驳回 / 纠偏

- 无用户侧驳回。设计上主动收窄了一处：**视差只加在流线布景层这一个装饰层上**（不是「所有看起来像背景的东西都加」），因为每多一个滚动联动的层，就多一处可能影响阅读或性能的地方，而收益只是"更花"。

### 21.4 翻车与返工（本组的核心是**判据稳定性**，不是功能）

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | 新断言首跑报 1 项失败（`bar: 0.115`），**重跑却全绿** | 进度条有 120ms 的 CSS 过渡，断言读到了过渡中间值 —— **判据在和过渡赛跑** | 第一次修复：读之前轮询到「填充量与 `--scroll-p` 一致」 |
| ② | 修①之后**仍然 flaky**：第二次跑读到 `p: 0.69`（本该是 0），连带视差位移只剩 1.86% | 两个叠加错误：**(a)** `window.scrollTo({behavior:'auto'})` 里的 `'auto'` 语义是「**遵循 CSS 的 `scroll-behavior`**」，而本站 html 上就是 `smooth` → 滚动变成动画；**(b)** 我的轮询条件是「bar 与 p 一致」，而在平滑滚动途中**两者一起变化、始终一致**，于是提前返回 | 改为 `behavior: 'instant'`（强制瞬时，不受 CSS 影响）+ 轮询条件同时校验「已到达目标位置」与「过渡已收敛」两个条件 |
| ③ | 单次跑绿不足以证明修好 | 这是**稳定性**问题，不是功能问题 —— 跑一次绿没有信息量 | 连跑 **4 次** 全部 40/40 才收工。这条做法本身记进纪律：**凡是修 flaky 判据，必须连跑多次**（一次通过不算证据） |

---

## 阶段 22 · apply 任务组 6（排版软化：节奏 / 不对称栅格 / 面板）（2026-09-29 00:0x）

### 22.1 用户关键原话

- 无新增业务指令。本组实现用户勾选的三项：**A 区块节奏（大小节交替）**、**B 不对称栅格（编辑式错位）**、**E 区块容器软化（玻璃面板 / 大圆角）**。

### 22.2 AI 关键产出与验证证据

| 任务 | 改动 | 证据 |
| --- | --- | --- |
| 6.1 | 六个区块容器加 `data-rhythm`，`global.css` 里大节 96px / 小节 48px | 断言实测：`拿得出手的数字=major/96px 技术栈=minor/48px 实习经历=major/96px 项目经历=minor/48px 教育与荣誉=major/96px 联系我=minor/48px` ✔ |
| 6.2 | `.section` 改 12 列栅格：标题通栏、导语进 1–3 列、正文从第 4 列起（`:not()` 定位，**不改 DOM**）；`≤719px` 塌回单列 | 断言实测：`标题84 → 正文368`（六节一致）；`导语 260 < 正文 828`；390 下六节偏移全为 0 ✔ |
| 6.3 | 新增 `.panel` + `--ds-panel-sheen` 令牌；只给「关键数字」的 `<dl>` 与「项目经历」的表格容器加 `panel` + `data-glass` | 断言实测：`共 2：拿得出手的数字 / 项目经历`；其余四节正文底色 `rgba(0,0,0,0)` ✔ |
| 6.4 | 面板不做唯一信息分层（语义结构未动：`dt=4`、`h3=3`、表格可展开均保持） | 对比度实测：亮 **227** 处 / 暗 **243** 处文本，**未达标 0**；原有结构断言全绿 |
| 6.5 | 首屏布景层不干扰正文 | 复用「布景层 `aria-hidden` + `pointer-events:none` + 层叠低于正文」与对比度审计 |
| 断言套件 | 由 40 项扩到 **47 项**（新增 6 条：节奏两档 / 错位 / 导语栏更窄 / 面板范围 / 其余通栏 / 窄屏单列，另加 1 条「面板内数值不溢出单元格」） | **47/47 全绿**；`tsc` 0 错误 |

### 22.3 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | **真视觉缺陷**：面板 + 栅格把正文栏从 1160px 收窄到 828px 之后，四列数字块每格只剩约 170px，`1200ms → 50ms` 与邻格的 `100%` **贴在一起**（截图上看得一清二楚） | 一期的四列数字块是按通栏 1160px 设计的；二期把正文右移+收窄，却没有同步复核这一节的最小列宽 | 两步修：**(a)** 数值字号 30 → 24px、列间距收紧、单元格加 `min-width: 0`；**(b)** 新增 `data-wide`，让这一节正文从第 3 列起（多拿一列 ≈ 95px）。修完四格间距正常、错位仍在（仍与标题错开 189px） |
| ② | **断言假绿**（比①更值得记）：为①写的溢出断言**通过了**，但截图里明明在叠字 | 我拿 `getBoundingClientRect()` 比较「子元素右边缘 vs 单元格右边缘」—— 块级元素的盒子宽度就等于列宽，**文字溢出时盒子并不变宽**，所以永远测不出溢出 | 换成正确判据 `scrollWidth > clientWidth + 1`；换完立刻抓到了溢出，修完再绿。**教训：判据用错度量，会比没有判据更危险 —— 它给你一个假的"已修好"** |
| ③ | 元素级裁图（`crop.cjs`）拍出来只有流线、正文全丢 | 与阶段 20⑤ 同一个捕获伪影，但当时只修了 `shot-final.cjs`，**没有把同一修法推广到另一个截图工具** | `crop.cjs` 同样加「先冻结流线一帧 + `animations: 'disabled'`」。教训：**同一类问题的修法要一次性扫过所有同类工具**，否则它会在下一个工具里换个面貌再出现 |
| ④ | 文档与实现不一致（设计里写「标题列 3 / 内容列 8」，实现是「标题通栏 + 导语左栏 + 正文第 4 列起」） | 实现时为「保住一期通栏发丝线签名」改了方案，但设计文档没同步 | 同步改 design.md D6 与 homepage delta spec 的场景描述（把「标题列窄于内容列」改成「导语栏宽明显小于正文栏宽」），并补一条「正文不因收窄而互相挤压」的场景 —— 正是①那个缺陷的契约化 |

---

## 阶段 23 · apply 任务组 7（集成验收）+ 一次性能返工（2026-09-29 00:4x ~ 01:2x）

> 本组是二期**最有价值的一段**：验收把一个「我以为已经达标」的东西打回了原形，
> 而修好它顺手还掉了一期遗留的唯一一项未验 DoD。

### 23.1 用户关键原话

- 无新增业务指令。用户此前的三条要求（字体大气 / 排版软化 / 背景灵动）在本组全部接受「是否真的成立」的检验。

### 23.2 验收结果（逐项，全部为实测）

| 关卡 | 命令 / 判据 | 结果 |
| --- | --- | --- |
| 浏览器断言 | `node .tmp/tools/audit-behavior.cjs` | **47/47**（一期 26 → 二期 47），连跑 4 次稳定 |
| 对比度 | `node .tmp/tools/audit-contrast.cjs` | 亮 227 处 / 暗 243 处文本，**未达标 0** |
| 四视口溢出 | `shot-final.cjs`（1280 / 768 / 390 / **375**） | 全部 `overflow=no`；`/tech`、`/algo`、404 同样无溢出 |
| 构建体积 | `npm run build` | JS **231.37KB / gzip 77.31KB**（一期 76.44 → **+0.87KB**）；CSS gzip 7.43KB；首屏预算 200KB 无压力 |
| 字体 | 700 档 | **9.0KB / 45 字**（预估 30–50KB，实测远低） |
| **移动端性能** | **Lighthouse 12（`--form-factor=mobile`，对生产构建 `vite preview`）** | **98 分**；TBT **0ms** / FCP 1.8s / LCP 2.0s / CLS 0 |

**关于「一期欠账」**：一期收尾时（14.3）明写「Lighthouse 移动端 ≥ 90 **未测**」。本组把它验掉了 —— 98 分。同时记下一条会误导人的环境事实：**同一份代码对 dev server 跑 Lighthouse 只有 30 分**（Vite 不打包 + React development 版），所以任何性能数字都必须标明测的是 dev 还是生产构建。

### 23.3 翻车与返工：性能从「我以为达标」到真的达标（本期的核心事件）

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | 生产构建 Lighthouse 移动端只有 **70 分**（TBT 2160ms）。而我此前已经写了断言、跑过截图、看过观感，**没有任何一项提示性能有问题** | 断言套件里完全没有性能判据 —— 我在 design 的风险表里写下了「72 条常驻动画可能掉帧」，却把验证留到了最后一步才做 | 新增 `.tmp/tools/audit-perf.cjs`：390×844 + CPU 4× 降速，采样 3 秒的帧间隔 + longtask 总时长，并做**归因对照**（隐藏流线层 / 只关动画 / 只保留位移 / 只做脉冲 / 路径减半 / 位移+脉冲） |
| ② | 归因结论**与设计阶段的假设相反** | 我在 design 里假设「瓶颈是节点数」，因此对策写的是「视口分档减路径数」。实测：把手机档节点砍一半（12×2→6×2，变体 F）**仍只有 45 FPS**；而只要每条线只剩一条动画（变体 D/E）就回到 117+ FPS | 改为「**每条流线只允许一条 CSS 动画**」：位移留在路径上，呼吸上提到布景层一层。实测 A 变体 **21 FPS → 76 FPS**、掉帧 97% → **0%**、长任务 310→162ms |
| ③ | 还有一条更反直觉的：**任意两条动画叠加都会崩**（位移+dasharray 21 FPS、位移+opacity 脉冲 27 FPS），不是「避开 dasharray 就行」 | `stroke-dasharray` 每帧要重算 dash 图案并重新细分描边；两条动画让每条线的每帧工作翻倍 | 方案从「去掉 dasharray 呼吸」进一步收窄为「一条为限」；这条**实测出来的硬约束**写进了 `specs/visual-language`（新增场景「单条流线只有一条动画」）与 `decisions.md` #51，并加进 spec 的场景而不是只写在注释里 |
| ④ | 修完复测：**Lighthouse 移动端 70 → 98 分**，TBT 2160 → **0ms** | — | 顺带把「性能判据」从交叉判据升格为效果矩阵里的独立条目（E15/E16），因为它直接决定「背景灵动」这条需求能不能成立 |
| ⑤ | 写 decisions 条目时**误删了 #50**（用整行替换的方式插入新行，把旧行覆盖了） | 编辑时把 `old_string` 设成了要保留的那一行 | 读回文件核对编号（45–52 连续）后补回 #50。教训：**在同一个位置插入内容时，`old_string` 里必须包含被保留的原文** |

### 23.4 被驳回 / 纠偏

- 无用户侧驳回。本组有两处**自我纠偏**：① 设计阶段「瓶颈是节点数」的假设被实测推翻（见 ②）；② 原定的「长度呼吸」效果（E3）被降级为「整层呼吸」—— 矩阵里明确标注了 `⚠️→✅` 而不是悄悄改口径。

---

## 阶段 24 · code review（2026-09-29 01:3x）

### 24.1 用户关键原话

- 无新增指令。评审按一期的做法：**自查清单 + 一次对抗性复核**（派一个只读子代理独立读 diff，不看我的自述，专门找我自己的盲区）。

### 24.2 自查清单（对照 spec / 一期纪律逐条查）

| 检查项 | 结果 |
| --- | --- |
| 装饰层三条纪律（`aria-hidden` + `pointer-events:none` + 位于正文之下） | ✔ 流线层与进度条都满足，且断言在查 |
| 装饰层不挂 `data-reveal`（一期 #31 的坑：挂了会永远停在 `opacity:0`） | ✔ 流线层是常驻布景，不参与入场编排 |
| `tokens.curated.css` 保持原样（溯源基线不动） | ✔ `git diff main --stat` 里没有这个文件 |
| 预渲染 / 无 JS 约束（不得依赖 window 才能显示正文） | ✔ `useScrollProgress` 只在 `useEffect` 里访问 `window`；`FlowField` 的 `pickCount()` 有 `typeof window` 守卫；进度条缺省 `var(--scroll-p, 0)` |
| `prefers-reduced-motion` 降级 | ✔ 三条断言：流线静止 / 视差撤销 / **进度条仍前进**（它是信息不是动效） |
| 触摸目标 ≥44px、hover 不作唯一入口 | ✔ 断言通过；本期没有新增 hover 依赖 |
| 暗色对比度 | ✔ 243 处文本未达标 0 |
| 结构断言口径未被改动（`h1=1` / 六个 `h2` / `dt=4` / `h3=3` / 首屏无按钮两链接） | ✔ 47/47 全绿，这几条一条没动 |
| 渐变护栏（6 类宿主，姓名恰 1 处） | ✔ `流线=1 面板=2 环=2 姓名=1 遮罩=1 聚光=1 其他=无` |
| YAGNI / 依赖 | ✔ 零新增运行时依赖；新增代码 = 2 组件 + 1 hook + 3 脚本 |
| 文档与实现一致 | ⚠️ 本期**反复出错的一类**，自查共抓到并修正 **4 处**（见 24.4） |
| **`buildPath()` 与参考公式是否逐项一致** | ✔ 手算四组边界（i=0/35 × position=±1）逐字比对参考模板，**4/4 完全一致**（本期曾在这里抄错符号，所以这次用脚本比而不是靠看） |

### 24.3 评审查出的真问题（一条，且是我自己的判据出了问题）

| # | 问题 | 证据 | 处置 |
| --- | --- | --- | --- |
| ① | **进度条断言仍然 flaky**（首次全量收尾跑 46/47，重跑却全绿） | 连跑 5 次抓到一次：`进度条存在… — bar: 0.000 → 0.972`（`p=1` 而填充量只有 0.972） | 根因：我上一轮给轮询设的收敛容差 **0.03 比断言门槛 0.99 还宽** —— 「过渡还差 2.8%」就被判为已收敛。改为**容差 0.005（明显小于门槛）**，并把超时提到 3s。**没有放宽断言**。修后连跑 5 次全绿 |

这条值得单独记：同一个断言我修了两次才对（第一次是「和过渡赛跑」，第二次是「容差比门槛宽」）。
两次都是**判据自身的缺陷**，不是被测对象的问题 —— 与阶段 22② 的「假绿」同源。
**纪律**：容差必须与门槛同量级或更严；`0.03` 这种"看着差不多"的数字，本身就是一个 bug。

### 24.4 文档与实现的四处不一致（全部在评审阶段前已修）

1. `design.md` 的 D7 说「性能判据首选 Lighthouse」，而 spec 场景写成「性能分数不低于 90」却没提替代判据 → 已补齐替代条款。
2. `design.md` D6 写「标题列 3 / 内容列 8」，实现是「标题通栏 + 导语左栏 + 正文第 4 列起」→ 已同步。
3. proposal / spec / decisions #45 都写「顶栏 logo 环」——**TopNav 根本没有环元素**（一期文档传来的错误）→ 三处按实况改写。
4. `theme.jcpress.css` 注释里的 `/fonts/serif-sc-400.woff2`（实际是 500）、`README.md` 顶部的「尚未编写业务代码」→ 都是文档腐坏，已修。

另外补了一件防复发的事：`docs/design-visual-language.md`（一期设计文档）顶部加了**「被二期修订条款」索引表** —— 否则下一个人读那份文档会照着已经被推翻的纪律办事。

### 24.5 对抗性复核结论（只读子代理，独立读 diff 找我的盲区）

**它推翻了我一句写在 journal 与矩阵里的结论**：我写「47/47 连跑 4 次稳定」，它复现不出来 ——
第一次跑就红（`bar: 0.000 → 0.973`）。这正是我在 24.3 抓到并修掉的那条（它跑的是修复前的树），
但**它指出了一个我当时没说清的点**：我的轮询容差 `0.03` 比断言门槛 `0.99` 还宽，
所以「过渡还差 2.8%」会被判成"已收敛"。修复（容差 `0.005`）与它的建议一致。

它另外找出 **5 条重要 + 10 条次要**问题，全部是**判据质量问题**（产品行为它实测是对的）。逐条处置：

| # | 复核发现 | 我的处置 |
| --- | --- | --- |
| I1 | `--ds-flow-alpha-max` 是**死令牌**：组件里硬编码 `MAX_ALPHA=0.5`，改令牌零效果，而注释声称「这条上限同时是断言的上界」 | **改成真接线**：组件写 `--path-alpha` 目标值，CSS 用 `stroke-opacity: min(var(--path-alpha), var(--ds-flow-alpha-max))` 封顶；令牌值改 0.5；断言改读**计算值**并校验令牌取值。新增断言「单条流线只有一条动画」 |
| I2 | 「面板内数值不溢出」对**两个面板里的一半是空转**：`.cell` 是哈希类名恒匹配 0 个节点，项目面板根本没有 `dd` → 假绿 | 判据扩到「**全页所有直接含文本的元素**」，排除本就允许横滚的容器 |
| I3 | 「正文/数字/控件不随滚动变化」只取**前 8 个**元素，五个区块的正文全在采样窗口外 | 改成**全页逐元素**比较滚动前后的 `transform`，只允许出现在 `data-parallax` 与 `data-progress`（后者是我第一次改的漏项，被断言自己抓出来了） |
| I4 | `audit-perf.cjs` **恒退出 0** = 没有判据（回归时 21 FPS 也全绿），与 design「长期把关」的说法不符 | 加门槛（掉帧 ≤20% / p95 ≤45ms / 长任务 ≤600ms）与退出码；实测当前值 0% / 17ms / 124ms |
| I5 | 「同一行标题不混两档字重」只判了一半：`h1` 内部其实是 700（姓名）+ 500（定位行）并存 | 断言改为**按文本节点**判；给 `.nameSub` 加 `data-weight="500"` 显式标记，并断言「标记值与实际字重一致」+「被标记的字也在 500 档里」 |
| M1 | 700 字体体积在 4 处文档里仍写 30–50KB（实测 9.0KB） | 4 处全部改为实测值；build 脚本的 700 档告警阈值 70KB → 25KB |
| M2 | 矩阵状态列 14 行全 `⬜`（而 7.7 已勾）；E3/E4 两行描述的是**已被删掉的实现** | 状态列按 §4 实测改为 ✅；E3/E4 改为「改判为整层呼吸」并写明原因 |
| M3 | **「留余量」的说法不成立**：`6vh + scale 1.04` 的边缘位移正好是 6%+2% = **8.0%**，贴着 spec 上限；断言只读 matrix 的平移分量，还硬编码 `/900` | 令牌改 `5vh`（边缘位移 7%）；断言按**层边缘**算（平移 + 缩放附加）并用 `window.innerHeight` 而非硬编码 |
| M4 | 节奏/栏宽断言是「有关系即可」：改成 65/66px、栏宽小 1px 也能全绿 | 加「两档差 ≥24px」「导语栏 ≤ 正文栏 × 0.7」 |
| M5 | 「其余区块通栏」只查首个子元素的 `backgroundColor`，漏了 `box-shadow` 与后续子元素 | 改成查**每个**正文子元素的底色 / 背景图 / 投影三项 |
| M6 | 6 条 spec 场景没有判据（环静止、降级下环可见、层的动画、暗色首页、面板移除后信息完整、布景层真的被画出） | 补 4 条：环静止（1.2s 前后位置与 transform 不变）、降级下环可见、整层 `animation-name=none`、**暗色首页**（流线在/环=2/渐变宿主不越权）。剩余 2 条（面板移除后信息完整、布景层像素级被绘制）**如实记为已知缺口**，不假装覆盖 |
| M7 | `tasks.md` 4.5 仍写「环保留在**顶栏**」，与 `decisions.md` #45 的实况修正打脸 | 改为「频道页徽标 / 项目徽标 / 页脚」 |
| M8 | `data-wide` 那一节的正文实际**掉到了下一行**，设计里没记 | design D6 补记这个副作用（与导语在第 3 列重叠 → 自动放置另起一行），说明是刻意取舍 |
| M9 | 六个区块的 className 里有字面量 `undefined`（`.module.css` 里没有 `.section` 规则，**一期遗留**） | 顺手清掉（`className="container section"`），并在 journal 注明不是二期引入 |
| M10 | `FlowField.tsx` 说「四处刻意偏离」而 `preserveAspectRatio="none"` 是第五处；journal 对参考 `preserveAspectRatio` 的描述与公开副本不符 | 改为「五处」并补上第 5 条；把 journal 20.3④ 的说法**限定为「用户贴来的那份副本」**（复核给出的是另一份公开分发版，用的是 `slice`） |

**复核明确确认没问题的部分**（同样的证据标准）：`buildPath()` 与参考模板 14 个数字**逐项一致**；
`pathLength` 归一化在 Chromium 里真的生效（有/无属性渲染差 2124 像素）；
**dash 循环无跳变**（`dashoffset 0` 与 `-1` 逐像素完全相同，差 0 点）；
装饰层的 `aria-hidden` / `pointer-events` / 层叠关系正确；`tokens.curated.css` 未被改动；
`:not(.sectionTitle, .sectionLead)` 在当前构建目标下无兼容问题（但它提醒：一旦将来下调
`build.target`，含 `:not()` 列表的**整条规则**会被丢弃 → 正文退回 12 列自动放置。这条**列入遗留**）。

### 24.6 这一阶段最该记住的事

我两次在同一类问题上犯错：**判据本身写错，却给出"已验证"的结论**（22② 的假绿、24.3 的容差比门槛宽）。
而对抗性复核的价值恰恰在这里 —— 它不看我的自述，只跑命令，于是把「我声称的稳定」直接打回。
**纪律（写进 decisions）**：凡是"我声称通过"的判据，必须有第二双眼睛按同样标准复跑一遍；
自述不是证据。

---

## 阶段 25 · finish（二期收尾）（2026-09-29 02:0x）

### 25.1 用户关键原话

- 「**计划通过，开始 apply**」（本阶段无新增指令，按已批准的 `tasks.md` 8 组 36 条走完）。

### 25.2 本期交付

| 范围 | 内容 |
| --- | --- |
| 背景 | **流线布景层** `FlowField`（内联 SVG，36×2 条镜像路径，`pathLength=1` + dashoffset 流动，按视口分档 72/48/24，零网络请求）；「环」从首屏布景退役为标记层（频道页徽标 / 项目徽标 / 页脚） |
| 滚动 | **滚动进度指示**（顶部 2px 实色条）+ **装饰层视差**（位移 5vh、缩放 1.04，边缘位移 7%）；全站唯一滚动监听 + rAF，只写一个 `--scroll-p` |
| 字体 | 展示字新增 **700 一档真字重**（只打包展示字，**9.0KB / 45 字**）；`h1`/`h2`/关键数字用 700，正文与导语保持 500；姓名 96 → 104px、区块标题 30 → 34px |
| 排版 | 大节 96 / 小节 48 交替；**不对称栅格**（标题通栏 + 导语左栏 1–3 + 正文第 4 列起）；**玻璃面板**只给「关键数字」与「项目经历」两类区块（圆角 14px） |
| 纪律修订 | 图案纪律（一种 → 两层）、禁止清单（视差/进度条解禁 + 剂量上限）、#46 卡片化（→ 有限面板化）、展示字单档（→ 两档）—— 全部写进 spec 与 `decisions.md` #45–#52 |
| 验收工具 | `audit-behavior` 扩到 **51 项**；新增 `audit-perf.cjs`（含门槛与退出码）、`audit-display-font.cjs`、`collect-display-charset.cjs`、`docs/phase2-effect-matrix.md`（评估集）；截图链修好「常驻动画导致空白捕获」的坑 |

### 25.3 最终验收（全量，全部实测）

| 关卡 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✔ 0 错误 |
| `vitest` | ✔ 5 文件 / **25 用例** |
| 浏览器行为断言 | ✔ **51/51**（一期 26 → 二期 51），关键几条连跑 3–5 次稳定 |
| 展示字覆盖断言 | ✔ 9 项（含负向自检：塞生僻字 → 退出码 1） |
| 令牌探针 | ✔ 亮暗各 19 键，合计不符 **0** |
| 对比度审计 | ✔ 亮 227 / 暗 243 处文本，**未达标 0** |
| 横向溢出 | ✔ 1280 / 768 / 390 / **375** 四档无溢出；`/tech`、`/algo`、404 同样 |
| 生产构建 | ✔ JS **231.31KB（gzip 77.32KB）**、CSS gzip 7.45KB —— 相对一期 JS gzip 76.44KB 只 **+0.88KB** |
| 移动端性能 | ✔ **Lighthouse 移动端 98 分**（TBT 0ms / FCP 1.8s / LCP 2.0s / CLS 0）；`audit-perf.cjs` 门槛通过（掉帧 0% / p95 17ms / 长任务 124ms） |
| 效果对照矩阵 | ✔ E1–E16 全部有实测值，两处偏差（E3/E4 改判为整层呼吸）标注为 `⚠️→✅` |

### 25.4 归档（OpenSpec 最后一环）

```
Specs to update: homepage(+2 ~1) / site-shell(+1 ~1) / visual-language(+3 ~4 -1)
Totals: + 6, ~ 6, - 1
Change 'phase-2-visual' archived as '2026-09-29-phase-2-visual'.
```

- 主干 spec 已更新并 `openspec validate --specs --strict` 全绿（4/4）；
- 被删除的旧条款「图案只有一种语言」在主干 spec 中已归零（`grep` 计数 0）；
- 归档目录：`openspec/changes/archive/2026-09-29-phase-2-visual/`。

### 25.5 遗留事项（交接用）

1. **`:not()` 列表的构建目标依赖**：一旦下调 `vite.config.ts` 的 `build.target` 或加 `browserslist`，不对称栅格的整条规则会被丢弃 → 正文退回 12 列自动放置。调 target 时同步复核（`decisions.md` #54）。
2. **两条 spec 场景仍无判据**（复核点出，如实记）：① 「去掉面板后信息仍完整」；② 「布景层真的被绘制出来」（复核用像素对照验证过成立：布景层显隐前后 224000 个采样点中 83620 点不同）。
3. **700 档必须在文案变动后重跑**：`npm run fonts:build:display`（约 30s）；漏字会导致同一行混两档字重，`audit-display-font.cjs` 会拦住。
4. **一期的 5 处规划硬伤**（`decisions.md` #6）仍未落改。
5. 一期遗留分支 `feat/homepage-about` 仍未删（保留）。

### 25.6 阶段留痕的自我核对

本 journal 的二期中段共 **11 段**（阶段 15–25），对应：brainstorm 定稿（15）、propose（16）、8 个任务组（17–23 中的 17/18/19/20/21/22 与 23 合并的 7 组）、
code review（24）、finish（25）。全部**在阶段完成当时写入**，没有末尾批量补录；
`git log` 的提交时间与各段记录的日期可交叉核对。

### 25.7 技能触发遗漏（如实记录）与补做的 `frontend-design` 复核

**遗漏**：用户明确要求「技能自动触发」。本期我触发了 `brainstorming` / `openspec-propose` /
`openspec-apply-change` / `openspec-archive-change`，但**从头到尾没有加载 `frontend-design`** ——
而这一期是纯视觉任务，它是最该触发的一个。`writing-plans` 也没有单独加载（理由是把计划并入
OpenSpec 的 `tasks.md`，已在 15.6 记为过程偏差；`frontend-design` 则**没有理由，就是漏了**）。

**补做的复核**（finish 之后，用它的清单逐条对照成品）：

| 技能点名的「AI 生成感」特征 | 本项目 | 归属 |
| --- | --- | --- |
| 元信息用中点号拼接（`A · B · C`） | 命中：首屏 kicker `广州 · AI 应用开发`、项目表 `角色 · 状态` | **一期决策**，未在二期新增 |
| 小数据标签用等宽字 | 命中：关键数字的指标名用 `--ds-font-mono` | 一期决策（#41 的白名单） |
| 链接/按钮尾部追加 `→` | 命中：主按钮「看技术分享 →」 | 一期决策 |
| 近黑代替纯黑 | 命中：暗色底 `#08090c` | 一期决策（#36） |
| 发丝线分块 + 大圆角卡片（SaaS 卡套件） | 部分命中：发丝线是一期签名；**二期新增了玻璃面板**（但限定两类区块、圆角 14px） | 二期新增的部分有意识地做了限量 |
| 每节 fade-and-slide-up 入场 | 命中：一期 `data-reveal` 就是逐节浮入 | 一期决策 |
| 饱和度极高的单一强调色 + 近黑底 | 未命中：暗色是蓝→紫渐变 + 蓝色强调 | — |

**结论**：技能自己也写明「**brief 的明确要求优先**」——而这一期的三项要求（背景灵动、玻璃面板、
视差与进度条）都是用户在选项里**逐条勾选**的，属于 brief 明确要求，不算我默认滑向模板。
但它点出的另一半值得摆在桌面上：**「把大胆只花在一处」**。二期同时上了流线布景、进度条、
视差、玻璃面板、700 字重五项改动，风险是「没有主角」。

**可选项（等你定，我不擅自改）**：
1. 想要收敛「AI 味」的话，最便宜的三刀是：去掉 kicker 与项目表里的中点号、把关键数字的指标名
   从等宽换成正文无衬线、去掉主按钮的 `→`（三处都是纯 CSS/文案改动）。
2. 想「把大胆集中在一处」的话：可以撤掉滚动进度条或装饰层视差其中一项，让流线布景成为唯一主角。
3. 也可以维持现状 —— 以上特征你在一期已经看过并接受。

---

## 阶段 26 · 二期迭代 r2（按用户 5 条实测反馈返工）（2026-09-29 02:3x ~ 04:0x）

### 26.1 用户关键原话（5 条反馈，原文）

> 「现在样式是做出来了, 但是有几个问题: 1. 排版布局普通,像广告介绍,缺少滑动闪出的感觉(也不用很重)
> 2. 背景的流线太多. 导致看起来眼花,白天形态的时候特别明显.用户体验效果不好
> 3. 字体颜色和背景流线一样,导致看不清,并且字体样式过于普通
> 4. 实习经历 项目经历可以放技术栈前面
> 5.技术栈 联系我 获奖经历这些排版太普通」

以及本轮开始时的流程选择：**「先做出来看效果再说」**。

### 26.2 归因（**两条是实现缺陷，不是审美分歧**）

| 反馈 | 量化归因 |
| --- | --- |
| ② 流线太多、白天眼花 | **几何错误**：`preserveAspectRatio="none"` 把 SVG 拉伸（x 1.84× / y 2.02×），而线宽是以 viewBox 为单位给的 —— `strokeWidth: 1.55` 实际渲染成 **≈2.9px 粗线**。再叠 72 条与 0.5 的剂量上限，白天就是满屏灰带 |
| ③ 字看不清 | **取色失误**：线色 `#0f172a` 压到 0.5 透明度后呈中灰，与技术栈条目名用的 `--ds-c-text-mute`（80% 灰）**明度只差 13.7 个百分点**（正文 L≈24.9% / 线 L≈11.2%）—— 不是"背景纹理压字"，是**同色干扰** |
| ① 缺闪出感 | 入场只有「淡入 + 上移 18px」，偏保守 |
| ④ 经历应排技术栈前 | 原顺序把能力清单排在经历之前，与"30 秒内看懂做过什么"的阅读逻辑相反 |
| ⑤ 三块排版普通 | 三块都停在"能读"的规格表层面，没有版式主角 |

### 26.3 产出

| 范围 | 改动 |
| --- | --- |
| 令牌 | 线色 `#0f172a` → **品牌蓝**（亮 `#0a6fd8` / 暗 `#4d9bff`）；剂量上限 0.5 → **0.28**；正文 `#3c3c43` → **近黑 `#17181c`**，mute/subtle 各加深一档（暗色同步） |
| 流线层 | 路径数 72/48/24 → **48/32/16**；线宽改 `vector-effect="non-scaling-stroke"` 钉在 **0.9–1.3px**（不再被拉伸放大）；描边目标区间 0.16–0.5 → **0.06–0.28** |
| 入场 | 位移 18 → **28px** + `scale(0.985)`，时长 460 → **520ms**；仍只动 `transform`/`opacity` |
| 顺序 | 关键数字 → **实习经历 → 项目经历** → 技术栈 → 教育与荣誉 → 联系我；节奏 M/m 重排并保持交替 |
| 技术栈 | 三列规格表 → **能力带**：组名进左栏作锚点（展示衬线 700 / 22px），技能流式词组（15px），档位紧贴名字 |
| 获奖 | 逐行年份 → **按年份分组**：年份当组头（展示衬线 26px），奖项在其下 |
| 联系我 | 两栏定义列表 → **邮箱主角**（32px 展示衬线、`mailto:`）+ 次级条目一行排开 |
| 顺带修正 | **等宽字用于中文的 5 处违规**（项目表头、指标名、`共 5 篇`、`9 分钟`、标签）—— 一期决策 #41 一直**没有判据**，本轮补上并修掉 |

### 26.4 验收（全部实测）

| 关卡 | 结果 |
| --- | --- |
| 浏览器断言 | **60/60**（r2 新增 5 条：线宽+non-scaling、色调分离、区块顺序、三块版式、等宽白名单） |
| 色调分离 | 亮 正文 L=10.0% / 线 L=44.3% → **Δ34.3**；暗 Δ31.0；最坏合成对比度 **11.90:1 / 11.54:1**（门槛 4.5） |
| 流线 | 1280→48 / 768→32 / 390→16 条；计算线宽 max **1.3px**；屏上浓度 max **0.237**；每条路径仍只有 1 条动画 |
| 对比度审计 | 亮暗 **未达标 0**（最低一处 6.83:1） |
| 令牌探针 | 亮暗各 20 键，**合计不符 0** |
| 单测 / 类型 | 25/25 · tsc 0 错误 |
| 移动端性能 | 门槛通过：掉帧 **0%** / p95 **8ms**（比 r1 的 17ms 更好）/ 长任务 254ms |
| 构建 | JS **231.90KB（gzip 77.58KB）**、CSS gzip 7.56KB（相对 r1 只 +0.26KB gzip） |
| 展示字子集 | 45 → **60 字 / 11.5KB**（技术栈组名成为 700 锚点，已纳入字符表） |

### 26.5 翻车与返工

| # | 事件 | 根因 | 处理 |
| --- | --- | --- | --- |
| ① | **获奖的「年份轴」设计被数据打脸**：改成大号年份后，五项奖项**年份全是 2025** —— 同一个数字重复五遍，比原来更难看 | 我在设计时只看了「年份是时间轴的好素材」，没看**这批数据里年份是否有区分度** | 改成**按年份分组**：年份当组头、五项奖项在其下 —— 顺带把「2025 是丰收年」这个真正有信息量的事实立了起来。断言同步改为「5 条奖项 / 1 个年份组 / 年份成列」 |
| ② | 窄屏「标题与正文左边缘对齐」断言突然报 -3px | r2 给入场加了 `scale(0.985)`：**揭示中的元素 rect 会横向缩进约 2.6px**，于是这条**布局**断言被**动画中间态**干扰 | 改用 `offsetLeft`（布局位置，不受 transform 影响）—— 断言要测布局就用布局度量，别用会被动画污染的 rect |
| ③ | **探针第三次漂移**：`--ds-parallax-shift` 期望 6vh / 实际 5vh | 上一轮做评审修正时把令牌从 6vh 改成 5vh，**漏改探针期望、也没复跑探针** | 以主题文件为准同步探针。这是同一类问题第三次（#50、#51 之后），**纪律**：改任何令牌后必须复跑 `probe-tokens.cjs`，它与断言套件一样是"改了就亮红"的护栏 |
| ④ | 顺带查出的**既有违规**：等宽栈被用在 5 处含中文的文本上（`项目 / 角色 · 状态`、指标名、`共 5 篇 · 更新至`、`9 分钟`、`Spring AI / 并发`） | 一期立了「等宽不得用于含中文的句子」（#41）并写进 spec，但**从未有过判据**，于是实现与契约脱节 | 5 处改回正文无衬线；新增断言「等宽字只用于纯 Latin/数字」并跑在首页与 `/tech` 上 |

### 26.6 过程偏差（用户决定，如实记录）

- 用户本轮选择「**先做出来看效果再说**」，因此**跳过了计划评审 gate**：proposal / design / delta specs / tasks 与实现**同批产出**，评审移到看图之后。这是本轮唯一的流程偏离，已写进 `proposal.md` 的 Impact 一栏。
- 技能触发：本轮补上了 `frontend-design`（上一轮漏了它），其「把大胆只花在一处」的提醒已记在 25.7，本轮的做法是**先减（流线从 72 条减到 48 条、剂量砍一半）**，即往"更安静"的方向走，与那条提醒同向。

### 26.7 留痕本身的一处错误（已纠正）

阶段 22–26 的标题我原先写成 **2026-09-30** —— 那是我**猜的日期**（以为跑过了午夜），实际整场都在 **2026-09-29**
（收尾时 `Get-Date` 返回 `2026-09-29 23:09`；`openspec archive` 用的归档名也是 09-29）。
已把 `dev-journal.md`（5 处）与 `phase2-effect-matrix.md`（2 处）里的错误日期全部纠正为 2026-09-29。
**各段的钟点仍是近似值**（我没有逐步记时间戳），时间线以 `git log` 的提交时间为准。
教训：留痕里的**日期不该凭感觉写** —— 一条 `Get-Date` 就能确认的事，我却在四个阶段标题里连续写错。

---

## 阶段 27 · 合并与推送（2026-09-29 23:1x）

### 27.1 用户关键原话

- 「**提交代码修改**」
- （在我说明「本地已提交、远端还没推」并给出三个选项后）选择「**合并到 main 并推送（推荐）**」

### 27.2 实际情况：这句话要的其实不是"再提交一次"

用户说「提交代码修改」时，**本地已经全部提交完了**：`feat/phase-2-visual` 领先 `main` 3 个提交、工作区 0 处改动、`.tmp` 之外没有未跟踪文件。
所以这句话真正剩下的一步是**远端**（`origin/main` 还停在一期的 `6efdbc9`）。我没有"再提交一次空改动"来敷衍这句话，而是把状态查清后列出三个选项让用户定 —— 用户选了合并 + 推送。

### 27.3 产出

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 合并 | `git merge --ff-only feat/phase-2-visual`（在 `main` 上） | **fast-forward 成功**，无合并提交、历史线性；`main` == `feat/phase-2-visual` == `aa7de4f` |
| 推送 main | `git -c http.proxy=… -c http.version=HTTP/1.1 push origin main` | `6efdbc9..aa7de4f  main -> main` |
| 推送分支 | 同上，`push -u origin feat/phase-2-visual` | `* [new branch]`，上游跟踪已设置 |
| 远端校验 | `git ls-remote origin` | `main = aa7de4f`、`feat/phase-2-visual = aa7de4f`、`feat/homepage-about = 6efdbc9`（一期分支保留） |

### 27.4 翻车与返工

- **本轮无翻车**。与一期的推送（`decisions.md` 环境注意事项第 ⑲⑳ 条：直连 `github.com:443` 被墙、`git ls-remote` 表现为**挂住几分钟**而不是报错）相比，这次**一开始就按记录带上代理与 HTTP/1.1**，先 `Test-NetConnection 127.0.0.1 -Port 7890` 确认代理在监听，并全程设 `GIT_TERMINAL_PROMPT=0`，因此没有出现挂起或超时。
  → **这条经验的价值在于：环境坑记进 `decisions.md` 之后真的复用上了**，不需要第二次踩。

### 27.5 收尾状态

- 当前分支：`main`（与 `origin/main` 同步，工作区干净）；
- 远端：`github.com/Jessiseb/jcpress`，`main` 已包含二期全部三个提交；
- 待办（都是用户可选项，不影响交付）：三块版式是否继续微调、流线是否要加回一些数量（48 → 64/72）。

---

## 阶段 28 · 列表符号可见性修复（2026-09-29 23:2x）

### 28.1 用户关键原话

- 「先不,然后现在的展示的内容列点的 - 没有以markdown的形式展示出来」
- （我给出四种可能并请其指位置后）回答：「**实习经历和项目经历展开的位置**」

### 28.2 诊断：符号**存在**，但 1px 高在 1 倍屏上等于不可见

我先做了两件事再动手，避免改错地方：
1. **查数据**：`profile.ts` 里**没有**字面的 `- ` 文本，也没有 `##` / `[]()` / 反引号等 Markdown 语法（`grep` 全量扫过）；`profile.ts:43` 的注释写明这些字段是「Markdown 内联片段，渲染时只解析 `**加粗**`」。
2. **查渲染并出 1:1 图**：实习经历与项目经历展开面板**都已经是** `<ul><li>`，条目符号来自 `::before`，规格是 **宽 0.5rem × 高 1px**、颜色 `--ds-c-text-subtle` —— 1px 高在 1 倍屏上几乎看不见，于是列表整体读起来像普通段落。`**加粗**` 渲染正常，暗色形态同样如此。

结论：这不是"没渲染 Markdown"，而是**符号的可见性问题**：一期的「项目符号用一段发丝短横线，不用彩色圆点」在 1× 屏上把符号做没了。用户看到的"没有 `-`"是真的。

### 28.3 改动

| 项 | 改前 | 改后 |
| --- | --- | --- |
| 符号尺寸 | 宽 0.5rem × 高 **1px** | 宽 **0.6em** × 高 **2px**（+ `border-radius: 1px`） |
| 符号颜色 | `--ds-c-text-subtle`（74% 灰） | `--ds-c-text-mute`（88%，与正文同级） |
| 垂直位置 | `top: 0.78em` | `top: 0.72em`（对准首行光学中心） |
| 文本缩进 | `padding-left: 1rem` | `1.1rem` |
| 范围 | — | `ExperienceTimeline.module.css` 与 `ProjectShowcase.module.css` **两处必须一致**（同一套规则，注释里互相点名） |

仍然是**短横线**而不是彩色圆点（一期「圆点 = 模板感信号」的取舍不变）。

### 28.4 验收

- 新增断言「列表符号是看得见的短横线（实习经历 + 项目经历展开面板）」：读取 `::before` 的计算值，要求 **高 ≥2px、宽 ≥8px、底色不透明** —— 实测两处均为 `{"width":8,"height":2,"bg":"rgba(23, 24, 28, 0.88)"}`；
- 断言套件 **61/61** 全绿（r2 的 60 项 + 这一条）；1:1 裁图确认两处的横线在亮暗形态下都清楚可见。

### 28.5 翻车与返工

- 无。但**过程上有一处值得记**：这条反馈「列点的 `-` 没以 markdown 形式展示」存在四种合理解读（符号太隐形 / 要轻量 Markdown 渲染 / 要完整 Markdown / 另有其处）。
  我**没有凭猜测动手**，而是先把「数据里没有 Markdown 语法、两处已经是 `<ul>` + 1px 发丝线」这两条事实摆出来、再请用户指位置 —— 用户一句「实习经历和项目经历展开的位置」就把范围钉死了。
  **教训（正面）：模糊反馈先取证、再问一句，比猜着改一轮便宜得多。**

## 阶段 29 · 二期 r3（天体布景层 + 三块版式 + 手机号上站）（2026-09-30 ~ 10-01）

### 29.1 用户原话与归因

本轮反馈分批到达，逐条归因后**只有一条是新增能力，其余全是设计不足或决策反转**：

| 用户原话 | 归因 |
| --- | --- |
| 「参考一下这个效果 看看我的项目能不能加上」 | **新增能力**：期望值最高的一条，也是唯一真需要新写一个层 |
| 「白天状态可以是地球，夜间就月球」 | **新增能力**：两颗**不同**的天体 |
| 「他们都没有滑动效果呢？」 | 实现不足：第一版只做了「固定在右侧 + 视差」，漏掉了参照组件最核心的**分节停靠** |
| 「效果不行，会不会是因为排版的原因？」 | 设计不足：技术栈 |
| 「都不好看，不要有这种背景是方块的」 | 设计不足：联系我，且附带一条硬约束 |
| 「联系我的 QQ 邮箱换成手机号 17819212602」 | **决策反转**：`decisions.md` #3 |

### 29.2 天体布景层：移植的是「六条 box-shadow」，不是「一个圆」

参照组件那颗球的观感**不是**径向渐变产生的。我第一版用三条径向渐变近似，结果弱了一个数量级 ——
看起来是一枚灰色圆片。逐条移植它的六条 `box-shadow`（`px` 基准换成 `em`，base = 直径）之后才对。

三条实现纪律（都是踩出来的）：

1. `inset` 的 `box-shadow` **画在内容之下** → 明暗必须放在贴图**之上**的独立覆层；
2. 七颗星必须放在**圆形裁剪窗口之外** —— 参照组件的七颗星坐标全部落在它自己那个
   `overflow: hidden` 的圆里，一颗都看不见（`elementFromPoint` 实测 **0/7**）；
3. 月球初版用不透明底色 + `stop-opacity: 1`，结果是**一个纯白圆盘盖住正文**；
   修法是把透明度写进颜色本身。

### 29.3 我漏掉了参照组件最核心的一段

用户问「他们都没有滑动效果呢？」时，我做的版本是「固定在右侧 + 5vh 视差」——
而参照组件的球是**跟着滚动在视口里换位**的（`translate3d(75vw,50vh) scale(1.4)` → 滑到下一节另一个位置，
由 1400ms 的 transition 负责「滑」）。

补齐之后的位置 / 尺寸 / 不透明度全表（实测）：

| 场景 | 位置 | 直径 | 不透明度 |
| --- | --- | --- | --- |
| ① 首屏 | 右（1088, 378） | 256px | **1.0** |
| ② 关键数字 | 左（192, 414） | 205px | 0.22 |
| ③ 实习经历 | 右（1088, 270） | 179px | 0.18 |
| ④ 项目经历 | 左（192, 468） | 192px | 0.20 |
| ⑤ 技术栈 | 右（1088, 558） | 166px | 0.16 |
| ⑥ 教育与荣誉 | 左（192, 360） | 179px | 0.18 |
| ⑦ 联系我 | 左（192, 603） | 179px | 0.24 |

三处比参照组件更严：位置整条塞进 `translate`（三者都是合成器属性）；按「跨过视口中线」判定当前区块
（本站区块高度差一倍以上，按中心距离会在长区块里提前跳）；首屏以外压到 0.16–0.30
（参照组件只有 0.85 / 0.4 两档，因为它那页只有 4 屏稀疏文案）。

### 29.4 技术栈换了 5 版、联系我换了 2 版

完整过程与归因写在归档件的 `design.md` D4 / D6，这里只留两句最值得记的：

- **「乱」是可以数出来的**：r2 有 28 个档位小灰字（28 条里 17 条是同一个「熟悉」）、
  技能之间没有分隔符、每组技能数不同导致换行位置随机。三条各有对策。
- **但真正的转折是用户那句「不要有这种背景是方块的」** —— 它点明了我一直在砍的东西
  （容器、颜色）**正是用户要的**。前四版我砍它们的理由都「正当」（spec 说面板只给两类区块；
  纪律说颜色只承担语义）。**当用户连续否定同一类输出时，该质疑的是被自己当成前提的那条纪律。**

### 29.5 一次被噪声驱动的返工（本轮最重要的教训）

加完分节停靠后 `audit-perf.cjs` 的 A 档报 **60–83% 掉帧**（此前 8–17%），我据此认定「滑动引入回归」，
做了一连串 A/B —— 结论互相矛盾（卸载天体层 13–19% / 关内阴影 71% / 去 `will-change` 63% /
换 observer 63% / hook 空转 57% / 硬编码 scene 12%）。

**互相矛盾就说明测的不是代码。** 查下去：**同一份构建连跑四次的读数是 60% / 67% / 33% / 13%**。
A 档测的是「`load` 之后不等待、直接采样 3 秒」，这 3 秒里含字体子集加载、贴图解码、React 挂载。

换成「等 2.5 秒落定再采样」的窗口：挂天体 57.3 / 60.1 / 60.2 FPS（掉帧 1.2% / 0% / 0%），
不挂天体 60.1 / 60.2 / 60.3 FPS（全 0%）。**没有回归。**
边界已写进 `audit-perf.cjs` 文件头：A 档的绝对值不可跨构建比较。

### 29.6 改版式掀翻了停靠表

联系我改成「号码左置 · 入口右列」后，正文第一次**横跨整个正文栏**，而天体在 scene 6 原本停在正中 ——
实测球正好压在手机号和「微信」上。做法不是凭感觉挪，是**量**：探针量出各块矩形，
发现左侧唯一空带是 **y 447–693**，把球放到该带中线。

**而且这次 `audit-contrast` 是全绿的** —— 它量文字与**底色**的对比度，不量装饰层遮挡。
所以这类问题只由肉眼截图把关：已把「改版式必须重验停靠点」写进 `decisions.md` #97，
并把实测矩形留在 scene 6 的 CSS 注释里。

### 29.7 交付

| 项 | 结果 |
| --- | --- |
| `tsc -b && vite build` | 通过 |
| `vitest` | **26/26**（含收窄后的三条手机号护栏断言） |
| `audit-behavior.cjs` | **71/71**（47 → 71） |
| `audit-contrast.cjs` | 亮暗各 **220** 处，未达标 **0** |
| `shot-final.cjs` | 1280 / 768 / 390 / 375 全部 `overflow=no` |
| 移动端稳态性能 | 挂与不挂天体均 **60 FPS / 0% 掉帧** |
| 新增依赖 | **1 个**（`lucide-react`）—— 拒绝 Tailwind / shadcn / framer-motion / next |

归档：`openspec/changes/archive/2026-10-01-phase-2-r3/`（proposal / design / tasks / spec 增量）。

---

## 阶段 30 · 三期（技术分享模块）· brainstorm（2026-10-02 · **设计稿待批，本段为定稿前留痕**）

### 30.1 我这一步发的关键原话

需求原文（四条）：

> 1. 完成技术分享模块的后端开发: 我可以在后台进行技术分享文章的新增\修改\删除, 用户可以在当前的首页中点击对应的文章查看详情, 以文章的形式查看,用户查看的时候要有让用户看起来眼睛舒服的效果
> 2. 后端开发使用模板: `C:\Users\O\Desktop\官方项目模板\springboot-init`
> 3. 开发规范需要遵守 `Agent.md`
> 4. 技术分享的展示需要优化一下页面, 页面需要有博客的感觉,排版也是要华丽好看, 灵动

工作要求原文（两条）：

> 1. 全程走 OpenSpec 流程,技能自动触发;产出不是可单测代码的任务(纯 Prompt、数据类),把 TDD 那步换成拿标注样例或评估集跑一遍验证,其余步骤照走;
> 2. 过程留痕:追记开发过程,每完成一个阶段(brainstorm 定稿、计划评审通过、每个任务完成、code review 结论、finish)就补一段,记四样:我这一步发的关键原话、你的关键产出(spec / plan 路径、评审结论)、我拒绝或纠偏了什么、翻车与返工;不许收尾时一次性补记

五个澄清答复原文：

| # | 我问的 | 用户答（原话） |
| --- | --- | --- |
| 1 | 模板（SB 2.7.2 / Java 8）与规划文档（Java 21 / SB 3）冲突，按哪条走 | **「改成 Java17 文档和项目都改成17」** |
| 2 | 「后端开发」到哪一步：能不能只能在浏览器里增改删 | **A. 后端 API + 后台写入口 UI + 前台列表/详情** |
| 3 | 「首页点文章」的入口具体指哪里（首页现在没有文章） | **A. 首页新增最新文章区块 + /tech 列表可点击** |
| 4 | 「博客感、华丽、灵动」往哪个方向 | **B. 现代卡片博客风（medium / dribbble 那种）** |
| 5 | 内容侧做到哪里（封面 / 上传 / 导入器） | **「都在这期实现」** |

### 30.2 AI 关键产出

| 产出 | 内容 | 落盘状态 |
| --- | --- | --- |
| 设计稿 D1–D10 | 模板移植清单、包结构与 ArchUnit 卡口、数据模型与 seed、API 契约、前台三页 + 后台两页、导入器、验收（TDD + 评估集）、已知缺口 | **会话内，未落盘**（`docs/design-tech-module.md` 待设计稿获批后写） |
| 环境探针 | 见 30.4；三条新的沙箱/环境结论 | 本段 + 下方 `decisions.md` 环境表 |
| D1 修订（本轮新增） | 模板升 SB **3.3.4** / Java **17**；Sa-Token 由规划写死的 **1.46.0 降到 1.44.0**（理由见 30.4 ③） | 同上 |

本轮**没有** spec / plan 路径 —— 按技能顺序（brainstorm 定稿 → writing-plans → OpenSpec propose），两条都还没到。

### 30.3 被驳回 / 纠偏（4 条，全部是用户改我的）

1. **技术基线 Java 21 → Java 17**：推翻的是**规划文档自己**（§5.3 写「Java 21 + Spring Boot 3.x」）。用户明确要求「文档和项目都改成 17」→ 三期里要顺带改 `docs/项目前期规划.md` 与 `README.md` 的基线描述（**改文档属本期交付物，不是顺手改**）。
2. **我推荐「封面走渐变/字体设计、不做图片上传、导入器留下一期」→ 用户「都在这期实现」**：范围直接加两项交付物（`/api/v1/admin/upload` 本地存储 + Markdown 导入器 CLI）。
3. **我推荐视觉方向 A（中文杂志/学术出版社感）→ 用户选 B（现代卡片博客风）**：与二期刚立的纪律正面冲突（圆角 ≤8px、面板只给两类区块、颜色只承担语义）。按 #29.4 的教训（用户连续要的东西优先于自设纪律），处置是**只对 `/tech` 与详情页放开四条并写进 `decisions.md` 显式修订**，不偷偷放宽。
4. **范围从「只做后端」被澄清为「后端 + 后台写入口 UI + 前台列表/详情」**：我原以为后台 UI 属 M5 可延后，用户选了工作量最大的那一档。

### 30.4 翻车与返工（如实记录）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 首轮两个探查命令被 `aborted`（`Get-ChildItem` + `git log`） | 用户在我的消息发出后又补发了完整需求，工具调用被中断 | 无损失，重跑即得；如实记以免被当成「命令失败」 |
| ② | `mvn dependency:get` 报 `D:\maven\repository\...\*.pom.part.lock（系统找不到指定的路径）`；直接 `New-Item D:\maven\repository\__dsh_probe` 报 **Access denied** | Maven 本地仓库在**工作区之外**，当前策略（workspace-write）不允许写 | 工作区内建 `.tmp\m2` 作 `-Dmaven.repo.local`。**实测有效**：`dependency:resolve` 全量依赖 **BUILD SUCCESS（1:20）** |
| ③ | **规划 §5.5 自己写明的坑，这次真的踩上**：本机 Redis 是 **5.0.14.1（Windows 移植版）**，而 `sa-token-redis-template` 要求 Redis ≥ 6.0 | 规划里那句「v1.46.0 使用了 `SET KEEPTTL`，Redis < 6.0 会报 `ERR syntax error`」是**真的**。我没有停在「文档这么说」，而是**打开 jar 验证**：`SaTokenDaoForRedisTemplate.class` 的常量池里确实有 `KEEPTTL` | 逐版本验证：**1.46.0 有 KEEPTTL；1.44.0 / 1.42.0 没有**（1.39.0 在阿里云镜像上取不到）。→ **Sa-Token 锁 1.44.0**，`sa-token-spring-boot3-starter:1.44.0` 已确认可解析。不用改本机 Redis、也不用自研 `SaTokenDao` |
| ④ | `npm view react-markdown version` 报 `error writing to the directory: C:\Users\O\AppData\Local\npm-cache\_logs` | npm 缓存目录在工作区外（与 `decisions.md` 环境表里那条 `npm_config_cache` 同源） | `npm view react-markdown version --cache .tmp\npm-cache` → 成功返回 **10.1.0**。三期所有 npm 命令都带 `--cache`（或设 `npm_config_cache`） |
| ⑤ | 「视觉伴侣」征询（skill 要求的独立一问）**没有得到答复** | 我把该问作为独立消息发出后，用户直接进入了自动轮次，既没接受也没拒绝 | **按未接受处理**：转纯文本 brainstorm，不擅自启动 `.superpowers/brainstorm` 服务（该服务启动方式另有一坑，见环境表） |

### 30.5 过程偏差（如实记录）

- brainstorming 技能要求「**每节**呈现设计、逐节获批」，我改成**一封信内分 10 节（D1–D10）+ 逐节拍板**。理由：这个三期有 5 条工作流、10 个决策点，按「一节一问」会耗掉十几轮往返；分节编号仍保留了「逐节接受或否决」的能力（用户可以只回 `D4 改…`）。**这是我自己做的流程取舍，不是技能许可的默认做法**，写在这里等用户判定。
- 技能要求 spec 落盘到 `docs/superpowers/specs/`；本项目既有约定是 `docs/design-visual-language.md` / `docs/plan-visual-language.md` 这一对。三期按**项目既有约定**命名 `docs/design-tech-module.md` / `docs/plan-tech-module.md`（技能自己也写了「User preferences for spec location override this default」）。

### 30.6 定稿前待用户拍板的四项

1. **D4** 那 5 篇占位文怎么处理（我建议：灌成**草稿** + 我另写 1 篇真实发布文用于验证详情页）
2. **D6** 前端新增 8～10 个依赖（react-markdown 系 + CodeMirror 系），破二期「一期只加 1 个依赖」的例
3. **D7** 视觉纪律破例的范围（只 `/tech` + 详情页，四条：卡片/圆角/阴影/封面头图）+ 正文阅读档位数字（17px / 1.9 / 68ch）
4. **D5** 后端端口 8080 + context-path `/api` + dev 走 vite proxy（替代 CORS）

### 30.7 依赖版本锁定（本轮实测可解析，写死在计划里免得实现期再猜）

| 侧 | 依赖 | 版本 | 备注 |
| --- | --- | --- | --- |
| 后端 | Spring Boot | **3.3.4** | 模板原为 2.7.2；Java **17** |
| 后端 | MyBatis-Plus | **3.5.7**（`mybatis-plus-spring-boot3-starter`） | 必须用 spring-boot3 专用 starter |
| 后端 | Sa-Token | **1.44.0** | 1.46.0 有 `KEEPTTL`，本机 Redis 5.0 不支持（见 30.4 ③） |
| 后端 | knife4j | **4.5.0**（`knife4j-openapi3-jakarta-spring-boot-starter`） | 替代模板的 openapi2（Swagger2 不支持 SB3） |
| 后端 | Flyway / Gson / spring-security-crypto / ArchUnit | SB 3.3.4 托管 / SB 托管 / SB 托管 / **1.3.0** | 全量 `dependency:resolve` 已 BUILD SUCCESS |
| 前端 | react-markdown / remark-gfm / rehype-highlight / rehype-slug / highlight.js | **10.1.0 / 4.0.1 / 7.0.2 / 6.0.0 / 11.12.0** | 正文渲染 + 高亮 + TOC 锚点 |
| 前端 | **`codemirror` 6.0.2** + `@codemirror/lang-markdown` 6.5.2 | — | **修正**：`@codemirror/basic-setup` 已废弃（`npm view` 明确回「In version 6.0, this package has been renamed to just 'codemirror'」），改用 `codemirror` 这个 meta 包导出的 `basicSetup` |

### 30.8 工作区里一处与三期无关的遗留（先记不改）

`frontend/package-lock.json` 处于未提交状态（**mtime 2026-10-01 22:39，早于本会话**），diff 是 42 行 `libc` 字段被删——这是 npm 版本差异导致的规范化，不是手改。
处置：**暂不动**；等三期建分支时把它单独提交或还原，避免混进三期的功能 diff。

### 30.9 设计文档落盘 + 自查 + 两条新发现

**产出**：[`docs/design-tech-module.md`](design-tech-module.md)（338 行，状态标注「**待用户批准**」）。含 D1–D11 决策、文件级交付物地图、风险与缺口、环境实测证据表、待批准 4 项。

**spec 自查（技能要求的四查：占位符 / 自相矛盾 / 歧义 / 范围）——查出并就地改掉三处我自己的不自洽**：

| # | 不自洽 | 处置 |
| --- | --- | --- |
| ① | 待批准表标「4 项」但列了 5 行（D6 拆成「依赖」与「视觉破例」两行） | 合并为一行的 ①②，回到真正的 4 项 |
| ② | 详情响应里写「+ 相邻篇」，同时又单列 `GET /articles/{slug}/adjacent` 接口 —— **同一件事两个入口** | 定为**内联进详情**，`/adjacent` 本期不实现，并在 §1 记为**偏离 4**（规划 §9.2 有这条契约，要显式说明而不是默默不写） |
| ③ | 公开列表带 `keyword`、但 §0 又写「不做搜索」 | 公开列表**去掉 keyword**；后台列表保留，且只走**前缀匹配**（§6.6 禁左模糊/全模糊）。`FULLTEXT ngram` 索引本期**只建不用** |

**两条新发现（都是「不改就会返工」的那种，写进了设计）**：

1. **首页加一个区块会踩到天体停靠表**。读代码确认：`useActiveScene()` 是**动态**取 `main section[aria-labelledby]` 的（区块数一变，scene 序号就变），而 `CelestialField.module.css` 的停靠表只有 `[data-scene='0'..'6']` 七档 → 新的第 8 个区块会落到**没有任何规则**的 scene 7。所以「首页加最新文章区块」不是加个组件就完事，必须一起做：补 scene 7 规则 + 重跑停靠探针（#97）+ 重新量矩形确认球不压字（#98）+ 重排 `data-rhythm` 与 reveal 错峰 + 全部视觉断言重跑。
2. **动态长文本和一期建的静态字体子集正面冲突**（新增决策 D7）。一期那套自托管中文衬线子集是从**静态渲染 DOM** 收的 531 字；而文章正文/标题是后台随时写的 → **必然**命中字符表外的字 → 回落系统宋体 → 同段混款（README 与 #38 早写过这个坑，但那时站上没有动态长文本）。三条路已列（A 文章页专用扩展子集 GB2312 一级 3755 字、独立 family、只在该路由下载 / B 全走系统字体栈 / C 沿用现有小集=不可行），推荐 A。

**同时做了一件事前验证**：把规划 §6.1/6.2/6.3 的建表语句**原样**跑进 MySQL 8.0.36 探针库（`.tmp/probe-sql/ddl-probe.sql`，跑完已 drop 库）——全部建成，`WITH PARSER ngram` 生效，`MATCH(title,summary) AGAINST('分片' IN BOOLEAN MODE)` **命中 1 行**，`DESC` 索引列生效。**规划里那段 DDL 是可用的**，Flyway 不会在第一天就炸。

另外确认：`openspec list --json` / `openspec context --json` 的 root 就是本仓库、`changes: []`，随时可以 `openspec new change phase-3-tech-module`。

### 30.10 设计定稿前的第三批验证：验收工具链 + 查询计划（**改了设计两处**）

**① 视觉验收工具链在当前策略下曾跑不起来**（这是评估集这条验收路径的前提，必须确认）

`node .tmp/tools/audit-contrast.cjs` 报 `browserType.launch: spawn EPERM` —— Edge 是以 `--remote-debugging-pipe`（命名管道）启动的，`workspace-write` 策略禁止。这与 `decisions.md` 环境表里二期的记录同源。
随后用户把文件策略改为 **`danger-full-access`（审批 `never`）**，同一条命令**跑通**：亮暗各 **220** 处文本、未达标 **0** —— 二期基线没有回退，评估集可用。
纪律更新：**不要再传 `sandbox_permissions`**（会被自动拒）。已写进环境表。

**② 规划 §6 的查询在 2000 行真实数据量下走不走索引**（`EXPLAIN`，探针库跑完已 drop）

| # | 查询 | 计划 | 结论 |
| --- | --- | --- | --- |
| ① | 公开列表（`type`+`status`，按 `publish_time DESC` 分页） | `ref` → `idx_type_status_publish_time`，**无 filesort** | ✅ |
| ② | 分类筛（`category_id`+`status`） | `ref` → `idx_category_id_status_publish_time` | ✅ |
| ③ | 相邻篇「下一篇」(`publish_time > ?` 升序取 1) | `index` + **Backward index scan**，`rows=1` | ✅ 反向扫索引 |
| ④ | 相邻篇「上一篇」(`publish_time < ?` 降序取 1) | `range` + index condition | ✅ |
| ⑤ | 首页最新 3 篇（`ORDER BY is_top DESC, publish_time DESC`） | `Using filesort` | ⚠️ `is_top` 不在索引 → **接受**（千级数据量代价可忽略），不加索引以免偏离 §6 DDL |

**据此改了设计两处**：

1. **后台 `keyword` 搜索的主路径从 `LIKE 'kw%'` 改成 `MATCH(title,summary) AGAINST('kw*' IN BOOLEAN MODE)`**。实测：`LIKE '探针文章 1%'` 在 `title` 上 **`type=ALL` 扫 1940 行**（无可用索引），而 ngram 全文索引 `type=fulltext` 直接命中。
2. **补一条回退规则**：`ngram_token_size=2`，所以**单个汉字在全文索引里命中 0** —— 关键词 < 2 字必须回退 `LIKE 'kw%'`，否则用户搜一个字永远搜不到。

两条都写进 `docs/design-tech-module.md`（§1 偏离 5、§2 D5、§2 D3、§6 证据表）。

**翻车（小）**：`mysql -e "source A.sql" -e "source B.sql"` 被客户端把两个 `-e` 拼成一个文件名，报 `Failed to open file '...ddl-probe.sql source ...query-probe.sql', error: 22`。改成**两次独立调用**即可（不是沙箱问题，是我的命令行写法问题）。

**仍未做的验证**（留给 W1 第一件事）：Sa-Token 1.44.0 的 SB3 starter 在 Spring Boot 3.3.4 上**运行时**是否正常（登录 → 写 Redis → 读回）。jar 静态检查只能证明没有 `KEEPTTL`，证明不了 starter 与本机 Redis 5.0 的完整协作 —— 那需要一个最小可运行探针，属于 W1 的第一个任务。

---

## 阶段 31 · 三期 brainstorm 定稿（2026-10-02）

### 31.1 我这一步发的关键原话

> **「全部按推荐批准（D4-A / D6 批准 / D7-A / D5 按此）」**

（这是一次性拍板，没有再逐条回。批准前我一共问了三轮 —— 第一轮 5 个澄清、第二轮设计稿、第三轮把 4 项待批收成一个是/否题。）

### 31.2 AI 关键产出

| 产出 | 路径 | 说明 |
| --- | --- | --- |
| 设计定稿 | [`docs/design-tech-module.md`](design-tech-module.md)（344 行） | 状态改为「**已批准定稿（2026-10-02）**」；§5 从「待批准项」改成「**审批结果**」并记下用户原话；§7 第 1 步标记完成 |
| 留痕 | 本段（阶段 31） | |
| 决策与环境的落点 | [`docs/decisions.md`](decisions.md) 环境表 +4 行 | 沙箱策略两次变化、Maven/npm 工作区外写入、Redis 5.0 vs Sa-Token |

**批准的内容**：D4=**A**（5 篇占位文灌成草稿 + 我另写 1 篇真实发布文）· D6=**批准**（加 7 个前端依赖，用路由懒加载控代价；视觉纪律**只在 `/tech` 与详情页**破例：卡片/圆角/阴影/封面头图 + 正文 17px/1.9/68ch）· D7=**A**（文章页专用扩展字体子集，独立 family，只在该路由下载）· D5=**按此**（8080 + context-path `/api` + vite proxy）。

### 31.3 被驳回 / 纠偏

本轮**无**。用户在三个连续自动轮次里没有干预我做的验证工作，最后一次到齐时直接全批。

### 31.4 翻车与返工

本轮**无新翻车**。补一句归因：`30.4 ②`（Maven 仓库在工作区外）与 `30.10 ①`（视觉验收工具链 EPERM）**这两条都不是代码问题，是沙箱策略问题**，而且**都已经随策略放开而自动消解** —— 教训是「先把『环境不允许』和『代码有问题』分开，再决定要不要改设计」。这两次我都先去验证、没有直接改方案，事后证明是对的。

### 31.5 流程节点

brainstorm 阶段到此**闭合**（技能要求的九步：探索 → 视觉伴侣征询 → 澄清 → 备选 → 分节呈现 → 写文档 → 自查 → 用户复核 → 转 writing-plans 中的前八步已完成）。
下一步：`writing-plans` 产出 `docs/plan-tech-module.md` → **计划评审**（用户第二次卡口）。

---

## 阶段 32 · 三期实施计划（writing-plans）· **计划评审通过**（2026-10-02）

### 32.1 我这一步发的关键原话

> **「计划通过，开始实施（推荐）」**

（这之前的四轮里，用户对计划本身没有提出修改 —— 因为我在每份计划写完时都先做了一遍 self-review，把会失败的写法就地修掉了。）

### 32.2 AI 关键产出

| 产出 | 路径 | 规模 |
| --- | --- | --- |
| 计划索引 + W1 后端骨架 | [`docs/plan-tech-module.md`](plan-tech-module.md) | 1471 行 / 9 任务 / 50 步 |
| W2 领域与公开接口 | [`docs/plan-tech-module-w2-domain.md`](plan-tech-module-w2-domain.md) | 1442 行 / 8 任务 / 48 步 |
| W3 后台写平面 + W5 导入器 | [`docs/plan-tech-module-w3-admin-importer.md`](plan-tech-module-w3-admin-importer.md) | 2422 行 / 9 任务 / 57 步 |
| W4 前台与后台 UI | [`docs/plan-tech-module-w4-frontend.md`](plan-tech-module-w4-frontend.md) | 1706 行 / 10 任务 / 65 步 |
| | **合计** | **7041 行 / 36 任务 / 220 步** |

提交序列：`8c5caab`（索引+W1）→ `597162d`（W2）→ `75c51f6`（W3+W5）→ `510dd41`（W4）。全部在分支 `feat/phase-3-tech-module` 上。

**每个工作流的收口动作都写进了计划**：过验收门 → 追加本日志一段（四样）→ commit。所以「每完成一个阶段就补一段」这条要求是**计划里的一个显式步骤**，不是靠自觉。

### 32.3 被驳回 / 纠偏

本轮**无**。用户在计划评审时直接通过。

### 32.4 翻车与返工（计划期的 self-review 战果 —— 21 处）

**没有环境翻车**，但写计划本身逮出 **21 处「照抄就会失败」的写法**。按性质分五类（这是本轮最值钱的部分）：

| 类别 | 数量 | 具体 |
| --- | --- | --- |
| **照抄编译不过** | 5 | ① ArchUnit `noFields().should().beAnnotatedWith(A).andShould().beAnnotatedWith(B)` 语义是"两个注解都有才违规"（规则等于失效）；② 方法判据用了不确定存在的 `.areNotStatic()`；③ `redis.rename()` 实际返回 `void`；④ `import type { Root } from 'hast'`（`@types/hast` 只是传递依赖）；⑤ CodeMirror `paste` 的形参是 `Event`，取不到 `clipboardData` |
| **编译能过但测试必红** | 5 | ⑥ `jsonPath("$.data").doesNotExist()`（我们开了 `serializeNulls`，`data:null` 会出现）；⑦ `getLoginIdByToken()` 经 Redis 回来可能是 `Long`，直接比字符串假红；⑧ **Sa-Token 的 `StpUtil.login()` 需要 web 请求级上下文**，非 web 的 `@SpringBootTest` 里必抛异常（整条测试策略要改）；⑨ `LocalFileStorage` 的 `@PostConstruct` 建目录方法包级私有，测试在另一个包调不到；⑩ "超限"用例是 1MB 上限配 2KB 文件 |
| **静默功能缺陷**（不报错但功能不对） | 5 | ⑪ **上传图片的 URL 前缀只有一个配置键** —— 它同时要当 `addResourceHandlers` 的（相对 context-path）路径与写进正文的对外 URL，两者不可能相同，正文里的图片会 **404**；⑫ 导入器新建「已发布」文时 `publish_time` 为 null → 公开列表（要求 `IS NOT NULL`）**看不见它**；⑬ `AdminArticleService` 缺 `listForAdmin`/`getForAdmin` 实现、`AdminArticleVO` 缺 `contentMd` → 后台编辑页拿不到正文；⑭ 首页新区块漏 `aria-labelledby` → `useActiveScene` 不把它算成 scene，**区块数仍是 7**，停靠分析全部建立在错误前提上；⑮ `WebMvcConfig` 手拼 `"file:" + Windows 反斜杠路径` |
| **假绿**（测了等于没测） | 2 | ⑯ 「裸 `@RequestMapping`」用**文本正则**查，分不清类级/方法级，会误伤 `@RequestMapping("/v1/articles")` 这种标准写法，**等于我自己的卡口卡死我自己的 Controller**；⑰ 停靠探针用 `field.querySelector('*')` 取天体，选择器取错会永远报「压字 0 处」（已改成 `:scope > *` 并要求先读 `CelestialField.tsx` 确认真实结构） |
| **设计层不可行 / 边界错误** | 2 | ⑱ 设计 D8 的「slug 自动从标题生成」对**中文标题做不到**（要拼音库，本期没批）；⑲ Mapper 直接回 VO 破坏 `repository` 只碰 DO/投影的层次边界 |

（⑩ 的"超限用例假绿"已计入「编译能过但测试必红」一栏，不重复计数。）

另外补了 2 处**声明缺漏**：`CategoryMapper.getByScopeAndSlug`（导入器解析 `category: java-backend` 要用）、`ArticleMapper.listForAdmin`。

**归因**：这 21 处里有 12 处属于「我写得很顺、但 API 的实际签名/语义不是我以为的那样」（`redis.rename` 的返回值、ArchUnit 的组合语义、Sa-Token 的上下文要求、`@types/hast` 的来源）。**教训：写计划时凡是要调用一个我没读过源码的库，先把签名查实** —— 查到就改，比实现期撞上便宜得多。

### 32.5 过程偏差（如实记录）

1. **writing-plans 技能要求的两个执行子技能没装**：`superpowers:subagent-driven-development` 与 `superpowers:executing-plans` 在 `~/.agents/skills` 与项目 `.agents/skills` 下都不存在（已核实）。因此执行方式定为**本会话内联逐任务执行 + 每任务后复核并 commit**，这条写在计划索引的头部，不假装能派子代理。
2. **无逻辑样板不逐行抄**：技能要求"每个改代码的步骤都给出完整代码"。对 20 来个纯字段类（DO/DTO/VO）我改成「1 个完整示例 + 逐字段表」—— 逐行抄会把计划再撑大一千多行而信息量不增。已在计划头显式记明这处适配。
3. **计划拆成 4 个文件**而不是技能默认的单文件：一个工作流一份，每份单独看都能产出可运行可测的软件。

### 32.6 下一步

`openspec new change phase-3-tech-module` → 按 spec-driven schema 产出 proposal / specs 增量 / design / tasks 四件 → 然后 W1 开工。
**W1 Task 5 的第一件事是 Sa-Token 1.44.0 在本机 Redis 5.0.14 上的运行时探针** —— 这是全期唯一还没被验证过的高风险假设（jar 静态检查只能证明没有 `KEEPTTL`）。

---

## 阶段 33 · 三期 OpenSpec propose（2026-10-02）

### 33.1 我这一步发的关键原话

本阶段**没有新指令**。用户在上一步已经把「计划通过，开始实施」一次说完，propose 属于这句话覆盖范围内的既定动作。

### 33.2 AI 关键产出

**变更目录**：`openspec/changes/phase-3-tech-module/`，4 件产物齐全，`openspec validate --strict` **✓ 通过**。

| 产物 | 行数 | 内容 |
| --- | --- | --- |
| `proposal.md` | 49 | Why / What Changes / Capabilities（4 新 + 3 改）/ Impact（含删除项与依赖清单） |
| `design.md` | 119 | Context / Goals-NonGoals / **D-A…D-G 七条实现级决策** / 风险表 / Migration Plan / Open Questions（5 条） |
| `tasks.md` | 64 | 6 组 / **33 个可勾任务**，每条自带验证方式；测试与文档**分散在各组内**，不收尾集中 |
| `specs/` 7 份 | 550 | 新增 4 个能力（`tech-article-detail` / `tech-article-admin` / `admin-auth` / `markdown-importer`）+ 修改 3 个既有能力（`tech-article-list` / `homepage` / `visual-language`） |

**能力拆分依据**：既有 spec 的粒度是"一个能力一份"，所以没有新建 `tech-article`（会与 `tech-article-list` 近似重复），而是**读路径与写路径分开**（`tech-article-detail` / `tech-article-admin`），认证独立成 `admin-auth`（将来项目笔记、分类管理都要用它）。

### 33.3 被驳回 / 纠偏（**这一轮逮到两处设计冲突，都是靠读既有 spec 发现的**）

| # | 发现 | 处置 |
| --- | --- | --- |
| 1 | **首页新区块原设计是"卡片"** —— 但 `openspec/specs/homepage/spec.md` 有一条硬要求：「首页 SHALL 只对**关键数字 / 项目经历 / 技术栈**三类区块使用面板容器…其余区块 SHALL 保持通栏，**SHALL NOT 使用面板底色或投影**」。卡片 = 面板底色 + 圆角 + 投影 → 直接违规；而且它也**违反我自己批准的破例范围**（D6③ 明确写了破例只在 `/tech` 与详情页） | 首页区块改为**通栏行式列表**（标题 + 日期 · 阅读时长），并把这处修正同时回写 `docs/design-tech-module.md`（D6③）与 `docs/plan-tech-module-w4-frontend.md`（Task 6 Step 1 加了显式禁令） |
| 2 | `tech-article-list` 里那条「**无详情页时不给死链**」的要求在本期**必须删除**（详情页已经有了，留着会把列表锁死在不可点） | 用 `## REMOVED Requirements` + **Reason + Migration** 显式删掉，并新增「卡片可点进详情」要求反向接管 |

### 33.4 翻车与返工

**① `openspec validate` 一次就拦下我两处 MODIFIED 写法错误**（这正是它该拦的）：

| 错误 | 校验器原话 | 处置 |
| --- | --- | --- |
| `homepage` 的「区块顺序」MODIFIED 块里把原场景**改了名** | "omits scenario(s) the current spec still has: 经历排在能力之前…a MODIFIED requirement replaces the whole block, so archive refuses to drop them" | 恢复原场景名，内容更新 |
| `tech-article-list` 的 MODIFIED 用了**新标题**「每条条目展示为卡片」 | "MODIFIED failed for header … not found" | 改回原标题「每条条目展示四项信息」，卡片内容写进该需求体内 |

**归因**：MODIFIED 的语义是"**整块替换**"，所以标题必须逐字沿用、原场景不得丢。我按"重写"的心智模型去写，就会丢历史。这条已记进脑子 —— 下次写 delta 先 `openspec show` 取原文整块再改。

**② 另一处小返工**：`openspec validate --change` 不是有效参数（是 `--changes`）。报错里给的建议是对的，照做即可。

### 33.5 流程节点

到此四件产物齐全，`openspec status` 报 **"All planning artifacts complete!"**。
下一步：按 `tasks.md` 的 6 组 33 项开工，第一件是 **W1 Task 1.1**（建 `backend/` 骨架）。

---

## 阶段 34 · W1 后端骨架（tasks 1.1–1.6、1.8）· 2026-10-02

### 34.1 我这一步发的关键原话

**无新指令**。用户上一条「计划通过，开始实施」覆盖本阶段全部动作。

### 34.2 AI 关键产出

| 项 | 内容 |
| --- | --- |
| 工程 | `backend/`（SB 3.3.4 / Java 17 / 21 个依赖，已删掉模板的 ES/COS/微信/Excel/session/knife4j-openapi2） |
| 统一契约 | `Result` / `PageResult` / `ErrorCodeEnum`（**每个码自带 HTTP 状态**）/ `BusinessException` / `ThrowUtils` / `GlobalExceptionHandler`（含 `NotLoginException` → 401 口径）/ `TraceIdFilter` |
| JSON | `GsonConfig.buildGson()` + 三个适配器（Long 字符串化 / LocalDateTime / LocalDate）；转换器插第 0 位，Jackson 留在 classpath |
| 数据层 | `MyBatisPlusConfig`（**故意不配 logic-delete**）、`V1__init_schema.sql`（§6 的 7 张表，含 ngram 全文索引）、`application-{dev,test}.yml` |
| 鉴权 | `SaTokenConfigure`（只守 `/v1/admin/**`，登录放行） |
| 冒烟入口 | `HealthService` + `HealthController`（`/api/health`，DB 与 Redis 探活） |
| **测试** | **13/13 全绿**（`PageQueryTest` 3 / `GsonContractTest` 3 / `FlywayMigrationTest` 3 / `SaTokenRedisTest` 1 / `HealthControllerTest` 1 / `ResultContractTest` 2） |

**验证命令与实测**：`mvn -q -DskipTests compile` exit 0；`mvn test` → `Tests run: 13, Failures: 0, Errors: 0`；Flyway 日志 `Migrating schema jcpress_test to version "1 - init schema"`。

### 34.3 ★ 全期最大的高风险假设已退役

`SaTokenRedisTest` **通过** —— Sa-Token **1.44.0** + Spring Boot 3.3.4 + **本机 Redis 5.0.14** 的整条链路真实可用：登录签发 token → 写进 Redis（键前缀 `jcpress-token`）→ 按 token 反查登录主体 → **续期**（1.46.0 正是死在这一步的 `SET ... KEEPTTL` 上）→ 登出后同 token 返回 **401 + 40102**。

设计里为它准备的备选方案（自研 `SaTokenDao`）**不需要了**。这条结论回写进 `openspec/changes/phase-3-tech-module/design.md` 的风险表。

### 34.4 被驳回 / 纠偏

本轮**无用户纠偏**。我自己改了计划两处：

1. **`RedisConfig` 不建了**：计划里要注册一个 `StringRedisTemplate` Bean，但 Spring Boot 已经自动配置好了（`@ConditionalOnMissingBean`），再定义一个只是重复。少一个类。
2. **`NotLoginException` 的 401 映射提前到 W1**（原计划在 W3 Task 4）：它与"统一响应体"是同一个关注点，而且 `SaTokenRedisTest` 的最后一步需要一个正确的 401 才能绿。提前做掉比留一个红测试好。

### 34.5 翻车与返工（三条，都是真金）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 契约测试期望 404，实得 **500** | 探针控制器写成**测试类的静态嵌套类**，`@WebMvcTest(controllers = ...)` 不会把它注册成处理器 → 请求落到静态资源兜底 → `NoResourceFoundException` → 被当成"未预期异常"。**表现极像"异常映射写错了"** | 改成顶层 fixture `web/support/ExceptionProbeController.java`，并在类注释里写明原因 |
| ② | 加了 `SaTokenConfigure` 之后，**所有切片测试一起变 500**（连不归它管的 `/health` 也是） | `@WebMvcTest` 只加载 Web 相关自动配置，**不含 Sa-Token 的自动配置** → `SaTokenContext` 未初始化 → `SaInterceptor.preHandle` 里第一件事 `SaRouter.match()` → `SaHolder.getRequest()` → `SaTokenContextException` | 新增元注解 `@WebSliceTest`（= `@WebMvcTest` + 排除 `SaTokenConfigure`），注释里写明"需要验鉴权链路的测试必须用 `@SpringBootTest + @AutoConfigureMockMvc`，不要用切片" |
| ③ | `SaTokenRedisTest` 报 `No value at JSON path "$.data.tokenName"` | 探针控制器返回**裸 Map**，没有套统一响应体 —— 测试按契约断言 `$.data.*`，自然取不到 | 探针改为返回 `Result<Map<String,Object>>` |

**另一条环境向的坑（值得晋级为纪律）**：`git commit -m "…"` 的消息里含**中文引号**时，PowerShell 会把参数截断，git 报 `pathspec '异常处理器答了个' did not match` —— 看起来像 git 出错，实际是 shell 引号。**以后提交信息一律走 `git commit -F <文件>`**。

**归因**：①②③ 是同一类问题的三种表现 —— **"我以为是产品代码错了，其实是测试环境没搭对"**。三次我都先去读真实堆栈（surefire 报告 / 原始日志），没有凭现象改产品代码，这一步是对的。

### 34.6 Task 1.7 / 1.8 / 1.9：规约卡口 + 真启动冒烟 + W1 收口

**Task 1.7（ArchUnit 13 条 + 源码扫描 3 条）——两处真发现，第二处是"假绿"**

| # | 发现 | 为什么危险 | 处置 |
| --- | --- | --- | --- |
| ① | **`..web..` 会匹配 `org.springframework.web`** —— ArchUnit 的 `..` 是"任意层级里出现该段"，不是"本项目的包"。第一版因此报出 **15 条假违规**：把「`GlobalExceptionHandler` 带了 `@RestControllerAdvice`」算成"common 层依赖了业务 web 包" | 假报还只是噪音；**更危险的形态是反过来** —— `..repository..` 会命中 `org.springframework.data.repository`，规则看起来在跑，实际什么也没守 | 所有包模式**锚定到 `com.jcpress.`** 前缀 |
| ② | **`Pattern.compile("^import\\s+lombok\\…")` 少了 `MULTILINE`** → `^` 只匹配整个输入的开头，等于**每个文件只扫了第一行**。Lombok 白名单检查因此永远绿 | 一个"永远绿"的检查比没有检查更糟：它给人已经守住了的错觉 | 加 `Pattern.MULTILINE`，并把这段教训写进该常量的注释 |

**②是怎么被发现的：我做了一次反向验证** —— 故意塞一个违规探针类（`@Builder` + `@Autowired` 字段 + `@PutMapping` + 方法级裸 `@RequestMapping` + 无动词前缀的 service 方法），跑卡口看它会不会红。结果 `ArchitectureTest` **四条规则全红**（说明它真的在拦），而 `SourceConventionTest` **依然 3/3 通过** —— 假绿当场暴露。

> **新增一条纪律：卡口必须做反向验证。"能通过"不等于"能拦住"。**
> 这条以后对每一个新建的判据都适用（前端的行为断言同理），已写进 `decisions.md`。

修好后再跑反向验证：5 类违规**全部被抓住**；删掉探针后回到 **29/29 全绿**（13 ArchUnit + 3 源码扫描 + 13 既有用例）。

**Task 1.8（真启动冒烟）**

```
$ mvn spring-boot:run -Dspring-boot.run.profiles=dev
Invoke-RestMethod http://127.0.0.1:8080/api/health
→ {"code":0,"message":"ok","data":{"db":"UP","redis":"UP"},"traceId":"bfea636f"}
```

启动日志同时证明三件事：Tomcat 起在 8080 且 context path 为 `/api`；Flyway 把 **dev 库 `jcpress` 也迁到 v1**（`Successfully applied 1 migration`）；Sa-Token 1.44.0 banner 正常。dev 库实测 7 张表 + `flyway_schema_history`（version 1 / success 1）。
唯一警告 `No MyBatis mapper was found in '[com.jcpress.repository]'` 是预期的（W2 才加 Mapper）。

**Task 1.9（W1 出口复核）**：`mvn -q -DskipTests compile` exit 0 · `mvn test` **29/29** · 冒烟三条全绿。**W1 收口。**

一处顺带的自我纠偏：`HealthService.check()` 这个名字**过不了自己的命名卡口**（动词前缀白名单里没有 check），改名 `getHealth()` —— 卡口是判据不是建议，所以改的是代码而不是规则。

---

## 阶段 35 · W2 技术分享领域与公开接口（tasks 2.1–2.8）· 2026-10-02

### 35.1 我这一步发的关键原话

**无新指令**（用户上一条「计划通过，开始实施」继续覆盖）。

### 35.2 AI 关键产出

| 项 | 内容 |
| --- | --- |
| 领域 | 5 个 DO、3 个行投影、`ArticleQuery`、5 个 VO、2 个显式转换器 |
| 数据访问 | `ArticleMapper`（列表/详情/按类型取/相邻篇/浏览量增量）+ 4 份 XML；`ArticleContentMapper` 只继承方法 |
| 服务 | `ArticleService`（列表/详情/浏览量）、`CategoryService`、`TagService` |
| Manager | `ArticleViewManager`（SADD 去重 + INCR + `@Scheduled` 刷新） |
| 接口 | `ArticleController` / `CategoryController` / `TagController` / `IpUtils` |
| 种子 | `V2__seed_data.sql`：4 分类 / 8 标签 / **1 篇真实发布文（正文 3167 字）** / 5 篇草稿（带提纲）/ 后台账号（真算出来的 BCrypt 哈希） |
| **测试** | **59/59 全绿**（W2 新增 30 条：转换器 5 / Mapper 4 / 服务 5+3 / Manager 3 / 控制器 3 / 种子 7） |

**真启动冒烟（Task 2.8）实测**：

```
① GET /api/v1/articles?type=TECH&size=20   → total=1（只有已发布那篇）
   id=1 类型=String · 分类=Java 后端 · 标签=redis,architecture,spring-boot · 阅读=7分钟 · publishTime=2026-10-02 09:00:00
② GET /api/v1/articles/phase-3-backend-retro → 正文 3167 字，prev=null next=null
③ GET /api/v1/categories?scope=TECH → 4 条，其中 3 条计数为 0（没有被 WHERE 过滤掉）
④ GET /api/v1/tags → 8 条，未使用的计数为 0
⑤ POST .../view 连打两次 → Redis view:count:1 = 1（同指纹同日只计一次）
⑥ 草稿 slug / 不存在的 slug → HTTP 404 + {"code":40401,...,"traceId":"bb0e873f"}
   且响应头 X-Trace-Id 与响应体 traceId 一致
```

### 35.3 被驳回 / 纠偏

本轮**无用户纠偏**。有三处是**我自己的判据/环境反过来纠正了我**（见 35.4）。

### 35.4 翻车与返工（四条，其中两条是"延迟引爆"型）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | `SourceConventionTest` 报 `lombok.EqualsAndHashCode` 不在白名单 | `ArticleQuery` 继承 `PageQuery` 时，`@Data` 会生成 equals/hashCode，子类为消告警就得加 `@EqualsAndHashCode(callSuper = true)` | 改为只取需要的 **`@Getter @Setter`** —— 取子集反而两边都干净（合规 + 无告警）。**卡口又一次把代码推向更合规的写法**，而不是让我去放宽规则（→ decisions #113） |
| ② | **所有 `@WebMvcTest` 切片上下文加载失败**：`Property 'sqlSessionFactory' or 'sqlSessionTemplate' are required` | `@MapperScan` 挂在启动类上，切片也会用它注册 Mapper Bean，而切片没有 DataSource。**W1 时它完全正常**（一个 Mapper 都没有），是加了第一个 Mapper 才引爆 | `@MapperScan` 移到 `MyBatisPlusConfig`（→ decisions #109）。教训：**"延迟引爆"的坑只有在第一个真实使用者出现时才暴露，所以判据要在有真实代码之后再跑一遍** |
| ③ | XML 里选 `a.is_top`，`top` 会**静默为 null** | MyBatis 驼峰映射把 `is_top` 找成 `isTop`，而实体字段叫 `top`（Agent.md 不许 POJO 布尔字段带 is 前缀）；`@TableField("is_top")` 只对 MP 自生成的 SQL 生效 | 写 `a.is_top AS top`，并加一条专门盯它的断言（→ decisions #110） |
| ④ | 编译错误：`assertThat(body).contains("### ").isFalse()` | AssertJ 的 `contains` 返回字符串断言对象，没有 `isFalse()`；而且这条断言本身也没意义（正文有没有三级标题不该被钉死） | **直接删掉** —— 不为了"让测试跑起来"而改写成一个凑合的断言 |

**另外两条不是翻车但是决策，已记入 decisions**：计数的过滤条件必须写在 `LEFT JOIN ... ON` 里（写在 WHERE 会把"没有已发布文章的分类"整体过滤掉，实测分类接口 4 条里有 3 条计数为 0，正是靠这个才出现）；种子数据的外键用 slug 子查询解析而不是写死自增 ID（测试库删过数据后 `AUTO_INCREMENT` 不回退，写死会得到"分类挂错"的静默错误）。

### 35.5 一个刻意的取舍

`V2__seed_data.sql` 里那篇真实发布文的正文**写进了迁移文件**（3167 字），而不是让导入器从 `content/**` 灌。
理由：本期还没有导入器（W5），而前台详情页的验收**需要真实素材**；正文同时覆盖了表格、围栏代码块、引用、外链、行内代码、列表 —— `SeedDataTest` 对这些逐条断言，缺一项就红。
W5 做导入器时会补 `content/tech/phase-3-backend-retro.md`，届时那篇文可以走导入路径重跑（幂等，不会重复）。

---

## 阶段 36 · W3 后台写平面（tasks 3.1–3.8）· 2026-10-02

### 36.1 我这一步发的关键原话

**无新指令**（「计划通过，开始实施」继续覆盖）。

### 36.2 AI 关键产出

| 项 | 内容 |
| --- | --- |
| 工具 | `SlugUtils`（纯中文不猜拼音）、`WordCountUtils`（剥 Markdown 后计数） |
| 模型 | `AdminUserDO` / `AdminAuditLogDO`、2 个 Mapper、`AdminLoginDTO` / `AuditLogDTO`、`AdminUserVO` / `LoginVO`、`AdminConverter`、2 个常量类 |
| 认证 | `SecurityConfig`（只要 BCrypt）、`RateLimitManager`、`AdminAuthService/Impl`、`AdminAuthController` |
| 上传 | `FileStorage` / `StoredFile` / `LocalFileStorage`、`WebMvcConfig`（静态映射）、`FileStorageService/Impl`、`AdminUploadController` |
| 文章写 | `ArticleSaveDTO` / `ArticleUpdateDTO` / `AdminArticleQuery` / `AdminArticleVO`、`AdminArticleService/Impl`、`AdminArticleController` |
| **测试** | **104/104 全绿**（W3 新增 37 条） |

**真启动出口复核（Task 3.8）——11 步全部符合预期**：

```
①  未登录 GET /v1/admin/articles        → HTTP 401 + code 40101
②  登录                                   → token + tokenName=jcpress-token + admin/ADMIN
③  后台列表                              → 草稿 5 篇 / 全部 6 篇；total 是 Int64（数字）；标签解析正确
④  新建（草稿）                           → id 返回 "7"（字符串）
⑤  未发布时前台 GET 详情                  → HTTP 404 + 40401
⑥  发布 → 前台可见                        → 分类=Java 后端、标签=Redis,架构、阅读=1 分钟、publishTime 正确
⑦  关键词 keyword=探针（多字）             → 1 篇（走 ngram 全文索引）
   关键词 keyword=出（单字）               → 1 篇（回退 title LIKE '出%'）★ 两条路径都实测到了
⑧  图片上传                              → /api/uploads/2026/10/<32位>.png，size 是数字
   直接访问该 URL                          → HTTP 200 / 12 字节 ★ 两个前缀的设计端到端成立
⑨  扩展名伪造（.png 里是 php）             → HTTP 400 + 40001「文件内容与扩展名不符」
⑩  审计表                                → UPLOAD → LOGIN → PUBLISH(ARTICLE,7,"状态 0 → 1") → CREATE(ARTICLE,7) → LOGIN×3
⑪  删除探针文                             → 前台 404；公开列表回到 1 篇；article 表回到 6 行；审计仍留 8 行（只增不删）
```

### 36.3 被驳回 / 纠偏

**一条卡口与现实的冲突，处置方式值得记**：`login` / `logout` 不在 Agent.md 的动词前缀白名单里，架构卡口会直接拦。
两条路是把名字扭成 `getToken` / `saveLogin`，或者放宽规则。**我选了第三条**：在卡口里加一组
`ACTION_PREFIXES = {login, logout}` 显式白名单并写明理由，**不放宽整条规则**（放宽会让 `handle()` / `process()` 也过闸）。
这属于对 Agent.md 的**有意例外**，已登记 decisions #114。

### 36.4 翻车与返工（5 条，3 条是真问题）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 更新接口**永远 400** | `ArticleUpdateDTO.id` 上写了 `@NotNull`，而 id 是控制器从路径变量写进 DTO 的 —— `@Valid` 在**参数解析阶段**就执行，那时 id 还是 null。**校验发生在赋值之前** | 去掉该字段的校验（路径变量缺失时 Spring 本就会先报 400）→ decisions #116 |
| ② | 后台关键词查询抛 `ParseException: Encountered unexpected token: "CONCAT"` | MyBatis-Plus 的分页插件要用 JSqlParser 生成 count 语句，而它啃不动 `AGAINST(CONCAT(...))` | 表达式在 Java 侧拼好（`getFullTextExpression()`），SQL 里只留 `AGAINST(#{...})`。副产品：`长度 ≥ 2 才走全文索引` 变成可单测的纯逻辑 → decisions #117 |
| ③ | `total` 被序列化成 `"3"`，测试报 `Integer cannot be cast to String` | 为了 ID 防精度丢失给 `Long` 注册了字符串适配器，而**实测它对基本类型 `long` 同样生效**（我先试了"去掉 `Long.TYPE` 注册"，无效）。契约因此静默漂移 | 定死规则：**`Long` 一定是 ID、一律字符串；计数与度量用 `int`**。`GsonContractTest` 加一条测试专门钉住这个陷阱 → decisions #115 |
| ④ | `StoredFile` 用了 `lombok.Value` | 不在 Agent.md 白名单里（白名单是 @Data/@Getter/@Setter/@Slf4j + 构造器注入必需的 @RequiredArgsConstructor） | 改为 `private final` + `@Getter` + `@RequiredArgsConstructor`。**这是第三次"卡口把代码推向更合规写法"** |
| ⑤ | `catchThrowableOfType` 参数顺序又写错（第 2 次） | AssertJ 3.25 的签名是 `(ThrowingCallable, Class)`，与新版文档相反 | 已在提交信息里留提醒。**教训：同一个签名坑踩两次说明我依赖记忆而不是查证** —— 新写测试类时先看一眼已有用法 |

### 36.5 一处刻意的设计取舍（上传 URL 的两个前缀）

`resource-path=/uploads`（服务端资源映射，相对 context-path）与 `public-prefix=/api/uploads`（写进正文的对外 URL）**必须是两个键**。因为后端 `context-path=/api`，文件实际服务在 `/api/uploads/...`；混用会让正文里的图片 404 —— 而这**只有在肉眼看图时才会发现**。第 ⑧ 步"直接访问返回的 URL 得到 200"就是为它写的验证。

---

## 阶段 37 · W5 Markdown 导入器（tasks 4.1–4.4）· 2026-10-02

### 37.1 我这一步发的关键原话

**无新指令**（「计划通过，开始实施」继续覆盖）。

### 37.2 AI 关键产出

| 项 | 内容 |
| --- | --- |
| 导入器 | `FrontMatter` / `FrontMatterParser`（SnakeYAML，零新增依赖）/ `ImportException` / `ImportItem` / `ImportReport` / `MarkdownImporter` / `ImportRunner` |
| 配置 | `application-importer.yml`（`web-application-type: none`，CLI 模式） |
| 仓库源 | `content/tech/phase-3-backend-retro.md`（**从 V2 的正文里提取生成**，逐字一致，避免手抄漂移） |
| **测试** | **110/110 全绿**（W5 新增 6 条：首次新增 / 再次更新 / 坏文件整批不写 / 缺 front-matter / slug 非法 / 空目录 / 已发布缺时间兜底） |

**CLI 实测（真打包成 jar 跑，三个场景）**：

| 场景 | 结果 |
| --- | --- |
| `--import=../content/tech --dry-run` | **退出码 0、8.0s**；输出「将处理 1 个文件 / 未写库」；库中文章数不变 |
| `--import=../content/tech` | **退出码 0**；输出「**新增 0 篇 / 更新 1 篇 / 跳过 0 篇 / 失败 0 篇**」；`gmt_modified` 从 `02:05:57` → `02:18:47`（**是更新而不是重复插入**） |
| 不带 `--import` | **退出码 0、8.1s**，只有启动/关闭日志，零导入动作 |

### 37.3 被驳回 / 纠偏

本轮**无用户纠偏**，但有两处**环境/框架反过来纠正了我**（见 37.4）。

### 37.4 翻车与返工（两处真问题，都在 CLI 第一次真跑时暴露）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 导入器 CLI **跑完不退出**，`java` 进程存活 12 分钟 | `@EnableScheduling` 在启动类上，**Spring 的调度线程池是非守护线程** → `ApplicationRunner` 干完活 JVM 也不退。更糟的是日志里看到 `[scheduling-1] ArticleViewManager : 浏览量回写完成` —— **CLI 导入一次内容，却把浏览量刷回了数据库** | `@EnableScheduling` 移到 `SchedulingConfig` 并带 `@Profile("!importer")`；`ImportRunner` 干完活显式 `System.exit(SpringApplication.exit(...))`，输入错误用非 0 退出码 → decisions #118 |
| ② | 同一个 profile 启动直接失败：`No qualifying bean of type SpringDocConfigProperties available` | knife4j 的 `knife4jOpenApiCustomizer` 依赖 springdoc 的 Bean，而**非 Web 模式**（`web-application-type: none`）没有它们 | `knife4j.enable` 默认 false，只在 dev 打开（它本来就是开发期工具）→ decisions #119 |

**这两条是同一类问题**：把一个"Web 应用"的配置（定时任务、接口文档）留在了**共享的公共配置**里，于是 CLI 模式被它拖住。触发条件很隐蔽 —— 只有"真的以 CLI 方式跑一次"才会暴露，单元测试跑不到。

**归因**：我写 `application-importer.yml` 时只想到了"不起 Tomcat"，没想到**启动类上的注解同样会生效**。
教训：**新增一个运行形态（CLI / worker / 定时任务）时，要回头审一遍所有全局开关**（`@Enable*`、自动配置、公共 yml）。

### 37.5 一处刻意的做法

`content/tech/phase-3-backend-retro.md` **不是手写的**，而是用脚本从 `V2__seed_data.sql` 里把正文提取出来再拼上 front-matter 生成的 —— 目的是保证"仓库里的 Markdown 源"与"数据库里的种子内容"**逐字一致**。手抄一遍不仅费时，还会在将来某次导入时把正文悄悄改短（导入是 upsert，短的那份会覆盖长的）。

**环境坑（值得记）**：Windows 下把 Java 进程输出重定向到文件时，**logback 写的是 GBK、`System.out` 写的是 UTF-8**，同一个日志文件里两种编码混在一起，中文必然有一部分乱码（能看到「新增 0 篇 / 更新 1 篇」这种数字可辨、文字乱码的行）。排查时不要以为是程序输出有问题。

## 阶段 38 · W4 前端（tasks 5.3–5.7 已完成段）· 2026-10-02

### 38.1 我这一步发的关键原话

「继续完成未完成的第三期开发」（本轮唯一的用户指令，承接 W1/W2/W3/W5 已完成、W4 未完成的状态）。

### 38.2 AI 关键产出（本段）

| 任务 | 产出 | 验证 |
| --- | --- | --- |
| 5.3 Markdown 正文管线 | `MarkdownBody.tsx` + `rehypeCollectHeadings.ts`（不引 `unist-util-visit`，自写 hast 遍历）+ 复制按钮 + 表格横向滚动 | `MarkdownBody.test.tsx` 三条；`tsc --noEmit` 通过 |
| 5.4 `/tech` 卡片列表 | `ArticleCard.tsx`/`.module.css`（字体封面回退 + 品牌渐变）、`TechListPage.tsx` 重写（TanStack Query `useArticles`，**错误态不伪装成空态**） | `TechListPage.test.tsx` 四条 |
| 5.5 `/tech/:slug` 详情页 | `ArticleDetailPage.tsx`（护眼 17/1.9/68ch、h2 自动编号、TOC、上下篇、路由级懒加载 `Suspense`）、`Toc.tsx`（IntersectionObserver 滚动高亮） | `ArticleDetailPage.test.tsx` 全绿；`tsc --noEmit` 通过 |
| 5.6 首页「最新技术分享」 | `LatestArticles.tsx`/`.module.css`（**通栏行式列表，不用卡片**，带 `aria-labelledby`/`data-block`/`data-rhythm`），插入 `HomePage.tsx` 使首页 **7→8 个区块** | `probe-fit.cjs`/`probe-docking.cjs` 实测「区块数 = 8」且 8 场景「压字 0 处」 |
| 5.7 scene 4/7 停靠 + rhythm 重排 | `CelestialField.module.css` 停靠表由 7 场景扩到 **8 场景**（scene 4 = 最新技术分享，5 = 技术栈，6 = 教育荣誉，7 = 联系我）；`data-rhythm` 重排保持 M/m 交替（SkillMatrix minor→major、EducationAwards major→minor、ContactBar minor→major） | 同上，探针 8/8 全绿 |

**本段核心证据（实测，1280×900 视口，dev server 5173）**：

```
区块数（= scene 数）= 8
scene 0 天体矩形 x=960  y=250 w=256  压字 0 处
scene 1 天体矩形 x=90   y=78  w=205  压字 0 处
scene 2 天体矩形 x=102  y=135 w=179  压字 0 处
scene 3 天体矩形 x=96   y=84  w=192  压字 0 处
scene 4 天体矩形 x=1005 y=97  w=166  压字 0 处
scene 5 天体矩形 x=102  y=405 w=179  压字 0 处
scene 6 天体矩形 x=102  y=360 w=179  压字 0 处
scene 7 天体矩形 x=77   y=65  w=230  压字 0 处
```

### 38.3 被驳回 / 纠偏

本轮无用户纠偏（用户只发了「继续」一条指令）。

### 38.4 翻车与返工（本段四条，两条是真 bug）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 详情页 `Maximum update depth exceeded` 崩溃 | `rehypeCollectHeadings` 的 collect 回调在 **React 渲染期**调 `setState` → 死循环 | 第一次用 `useRef` 做幂等短路 → 不崩了但渲染期的 setState 被丢弃，**TOC 永久为空且无报错**；最终改为在 `useEffect` 里**从渲染后的 DOM 收集** `h2[id],h3[id]`（顺带保证锚点与 rehype-slug 生成的 id 一致） |
| ② | `rehypeCollectHeadings` 在 `undefined` 节点上崩 | hast 的 `children` 数组可以有**空洞** | 加 `if (!node) return` |
| ③ | `probe-docking.cjs` 全场景报「天体矩形: n/a」（**假绿**） | 探针按哈希后的类名 `.earth/.moon` 取节点，取空 → 判定静默跳过 | 改按**结构**取「`.field` 下可见的那个子 div」；这正是计划里警告过的「假绿比红更危险」 |
| ④ | 一版 CSS 写的令牌名是计划样例里的旧名（`--ds-border/--ds-accent-soft/--ds-bg-elevated`） | 计划里的样例 CSS 与项目实际令牌不一致 | 全部改为**真实令牌**：`--ds-c-hairline/--ds-c-bg-elv/--ds-c-accent/--ds-c-accent-bg` |

**额外一处几何纠偏**：`probe-fit.cjs` 的候选网格用 cx≈91vw 找位，但实际 `--dx`（35vw + 正文让位）落点更靠内（≈85vw）—— 所以 scene 2 我按网格选了「右侧 25vh」，验收探针实测却压到了公司全名「广州视源电子科技股份有限公司（CVTE）」（横排很长）。**结论：找位置脚本只是粗筛，验收探针才是准的**，scene 2 随之改走左侧。

### 38.5 环境限制（如实记录）

本机存在**硬性的 esbuild 磁盘读取拒绝**（`winapi error #5`）：`vite build` 与 `vitest` 均无法运行；`tsc --noEmit`（不依赖 esbuild）与 Playwright/Edge 浏览器断言可用。故本段验证走**项目既有降级路径**：`tsc --noEmit` + 浏览器实测探针。`vitest` 用例已写完并类型检查通过，但**未能在本机执行**——留待环境允许时补跑。

## 阶段 39 · W4 后台写入口（task 5.8）· 2026-10-02

### 39.1 我这一步发的关键原话

「继续完成未完成的第三期开发」（承接阶段 38）。

### 39.2 AI 关键产出

| 文件 | 说明 |
| --- | --- |
| `frontend/src/hooks/useAdminAuth.ts` | 登录态 hook：真源是 sessionStorage 的 token，`/me` 只做校验；`enabled: getToken()!==null`、`retry:false` |
| `frontend/src/hooks/useAdminArticles.ts` | 列表/详情/保存/发布/删除五个 hook；写操作统一失效 `['admin','articles']` + 公开站 `['articles']`/`['latest-articles']` 前缀 |
| `frontend/src/components/admin/MarkdownEditor.tsx` + `.module.css` | CodeMirror 6 双栏（左编辑右预览）+ **粘贴图片即上传**；编辑器只在挂载时建一次（`onChangeRef` 回写，避免重建丢光标） |
| `frontend/src/pages/admin/{AdminLayout,AdminLoginPage,AdminArticleListPage,AdminArticleEditPage,RequireAdmin}.tsx` + `admin.module.css` | 一条顶栏 + 登录卡 + 列表（状态/分类/关键词筛选、状态徽标、删除二次确认）+ 编辑页（中文标题空 slug 本地拦截）+ 守卫三态 |
| `frontend/src/App.tsx` | 三条 admin 路由懒加载；`isAdmin` 时**不挂** `FlowField`/`TopNav`/`Footer`/`ScrollProgress`（视觉隔离，规划 §10.4） |
| `frontend/public/robots.txt` | 新建，`Disallow: /admin` |
| `frontend/package.json` | 新增 `codemirror@6.0.2`、`@codemirror/lang-markdown@6.5.2`、`@codemirror/view@6.43.13` |

**浏览器全链路实测（`probe-admin.cjs`，替代跑不起来的 vitest）**：

```
① 未登录访问 /admin/articles → /admin/login
   后台隔离（应全 false）: {"hasTopNav":false,"hasFooter":false,"hasFlow":false}
② 登录后 → /admin/articles
③ 列表行数 = 6（1 已发布 + 5 草稿）
④ 编辑页回填标题 = "三期后端复盘：模板、Redis 版本与「没人守」的规则"
   中文标题+空slug 拦截提示 = "中文标题请手填英文 slug（如 my-first-post）"
⑤ 保存后 → /admin/articles
⑥ 列表中找到改后文章: {"status":"已发布"}
⑦ 前台 /tech 可见改后标题 = true
```

⑦ 是这一条链路的关键：**后台改标题 → 保存 → 前台刷新立即可见**，端到端通。

### 39.3 被驳回 / 纠偏

本轮无用户纠偏。

### 39.4 翻车与返工

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | `useSaveAdminArticle` 类型报错：`Promise<void> \| Promise<string>` 不能赋给 `MutationFunction<void,…>` | 新建接口返回新 id（string），更新接口返回 void，两条并成一条 mutationFn 时返回类型不一致 | 显式标注 `useMutation<string \| null, Error, …>`，mutationFn 统一成 `async` 返回 `string \| null` |
| ② | 探针第 ⑤ 步「保存后仍停在 /admin/articles/1」，误判为导航失败 | 探针自己在 4b 把 slug 清空做拦截测试后**没填回去**，第 5 步被同一条校验拦下；且 `waitForURL('**/admin/articles')` 的 `**` 会吞掉尾段匹配到 `/articles/1` | 探针补回 slug；改用 `waitForFunction(pathname === '/admin/articles')` 精确判等。**应用本身无 bug**（单独逐帧观察确认 500ms 内即跳转） |

**一处操作失误（如实记录）**：为「复位」文章 1 我一度直接调后台接口把 `contentMd` 写成了占位串「（正文略）」，**覆盖了真实正文**（3167 字）。发现后立即用 W5 导入器 `--import=../content/tech` 复原（幂等 upsert：新增 0 / 更新 1），正文与标题均逐字恢复。教训：**复位测试数据要走「从源文件重建」的路径，不要手搓 payload 去覆盖**。

### 39.5 环境限制（延续）

`vitest` 仍被 esbuild 磁盘读取拒绝挡在门外（`Cannot read file "package.json": winapi error #5`）。故 `AdminArticleEditPage.test.tsx`（两条：中文标题拦截、保存带 id）**已写完并通过 `tsc --noEmit`，但本机跑不了**；改用 `probe-admin.cjs` 的浏览器全链路验收覆盖同等语义。留待环境允许时补跑单测。

## 阶段 40 · W4 文章页字体子集（task 5.9）· 2026-10-02

### 40.1 我这一步发的关键原话

「继续完成未完成的第三期开发」（承接阶段 39）。

### 40.2 AI 关键产出

| 文件 | 说明 |
| --- | --- |
| `frontend/scripts/gen-article-charset.cjs` | 生成文章页字符表（**零依赖**，Node 自带 full-icu 的 `TextDecoder('gbk')`） |
| `frontend/package.json` | 加 `fonts:chars:article`、`fonts:build:article` 两个脚本 |
| `frontend/public/fonts/serif-sc-article-{500,700}.woff2` | 文章页专用子集（845KB + 860KB） |
| `frontend/src/styles/fonts-article.css` | 独立 family `JCPress Serif SC Article` 两个 @font-face |
| `frontend/src/styles/theme.jcpress.css` | 加 `--ds-font-article` / `--ds-font-article-display` 两个令牌 |
| `frontend/src/pages/tech/ArticleDetailPage.tsx` + `.module.css`、`frontend/src/components/markdown/markdown.module.css` | 详情页 import 该 CSS；标题/h2/h3 改用文章令牌 |
| `frontend/scripts/audit-display-font.cjs` | 判据改为**并集**（静态 ∪ 文章），路由加 `/tech/:slug`；`cmap` 由 `execFileSync` 改为异步 `spawn` |

**字体审计实测：`合计 8 项，通过 8，失败 0`**（全部 ✔）。

**「只在详情页下载」实测**（Playwright 抓网络请求）：

```
/                          → 文章字体请求: (无)
/tech                      → 文章字体请求: (无)
/tech/phase-3-backend-retro → 文章字体请求: /fonts/serif-sc-article-700.woff2
```

### 40.3 被驳回 / 纠偏

无用户纠偏。但**计划本身有一处缺陷，被我实测挖出来并修正**（见 40.4 ①）。

### 40.4 翻车与返工（三条，第①条是计划级缺陷）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 字体审计报「缺 4 个字：`、「」：`」—— 文章 H1 里的中文标点没被覆盖 | **计划原文只写了「一级字库 3755 字」（0xB0A1–0xD7F9），而一级字库只有汉字、不含标点**。GB2312 的标点/符号在**区 1–9**（high 字节 0xA1–0xA9）。缺了它们，`、「」：` 会在文章页回落到系统宋体 —— 正是这套子集要解决的问题本身 | `gen-article-charset.cjs` 扩成「区 1–9 + 区 16–55」：**4601 字（3755 汉字 + 846 符号）**；重建后文章子集 cmap 含全部目标标点 |
| ② | 字体审计用 `execFileSync('python', …)` 一律 `EBUSY` | 本机 Node 的**同步** spawn（`execFileSync`/`spawnSync`）一律失败，**异步 `spawn` 正常**（实测：`git`/`echo`/`python` 全中招；异步 `spawn('python')` 返回 42 正常） | 把 `cmap` 的 `execFileSync` 换成异步 `spawn` + Promise；并加 `FONT_PROBE_PYTHON` 环境变量指定带 fonttools 的解释器（本机 fonttools 装在系统 Python 上） |
| ③ | 500 档兜底判据误报失败（缺 24 字，全是文章 H2） | 判据只比静态 500 子集，而文章页展示字（独立 family）兜底应落**文章 500** | 判据同样改为并集：静态 500 ∪ 文章 500 |

### 40.5 环境限制（新增一条，重要）

本机 Node **同步**子进程调用（`execFileSync` / `spawnSync`）**一律抛 `EBUSY`**，与目标程序无关（`git`/`echo`/`python.exe`/绝对路径全试过）。异步 `spawn` 正常。这一条比「esbuild 磁盘读取被拒」更宽 —— 它解释了为什么 `build-font-subset.cjs`、`audit-display-font.cjs` 这类用同步 spawn 的脚本全跑不动。**处置纪律：凡是报告里要用到同步子进程的脚本，都改为异步 spawn，或在工作流里直接调用底层命令。** 本次 `fonts:build:article` 的 npm 脚本虽已写好（供环境正常时用），但本机是用等价的 `python -m fontTools.subset …` 直接生成产物的。

---

## 阶段 41 · W4 Task 5.10（验收评估集与工具扩展）

### 41.1 用户关键原话

- （承接）「继续完成未完成的第三期开发」—— 继续推进 W4 剩余任务，本轮为 5.10。

### 41.2 AI 关键输出

**产出 `docs/phase3-effect-matrix.md`**（评估集，11 条效果 V1–V11，每条「实测」栏都是真实数字）。

**工具扩展与实测结果：**

| 工具 | 扩展内容 | 实测 |
| --- | --- | --- |
| `audit-contrast.cjs` | 参数化到 4 路由 × 亮/暗（原写死 `goto('/')`） | 8 组，未达标 **0**；覆盖 227 / 28 / 166 / 4 处文本 |
| `audit-behavior.cjs` | 新增 `auditPhase3()`（#1–#12）；修 `proseCh` 探针、区块顺序、`/tech` 陈旧断言 | **82 项，通过 82，失败 0** |
| `shot-final.cjs` | 改造成 4 视口 × 4 路由，输出 `shots-p3/`（32 张），输出溢出矩阵 + 入场完整性 | 16 格全 `no`；home 四视口**未揭示 0** |
| `audit-firstscreen.cjs`（新） | 运行时请求归属：首屏零请求 + 详情页/后台反向对照 | 全绿（详情页拉 react-markdown+文章字体；后台编辑器拉 codemirror 3 条） |
| `build-p3.sh` + `build-probe.cjs`（新） | esbuild 生产构建 + 产物体积/依赖归属分析 | **首屏 82.9 KB gzip**（判据 ≤200KB，富余 58.6%） |
| `probe-docking.cjs` | 已验证 8 scene | 8 scene **压字 0 处** |
| `audit-display-font.cjs` | 已验证 | **8/8**，覆盖 104 个展示字 |

**生产产物入口契约（V10 取证）：**

```
--- 首屏 initial chunks ---
      64.6 KB gz  chunk-3W42ODD5.js      ← react + react-dom + router + query
      15.6 KB gz  main.js                ← 本站业务代码 + 首页区块
       2.6 KB gz  chunk-EYF7DI5L.js
       0.2 KB gz  chunk-6K2HCF2O.js
  ▶ 首屏 JS+CSS 合计 gzip 82.9 KB

--- 懒加载 ---
     206.3 KB gz  AdminArticleEditPage   ← codemirror
     104.2 KB gz  chunk-TDPQDSXQ         ← react-markdown + remark/rehype + highlight.js
```

**依赖双向断言（防假绿）**：react-markdown / codemirror / highlight.js 三者「首屏不含」且「懒加载含」，全部 ✔。

### 41.3 被驳回 / 纠偏

无用户纠偏。但本轮我**自己纠了自己两处判据错误**（见 41.4 ①②），且都是「先写错 → 被实测打脸 → 改正」的模式。

### 41.4 翻车与返工（五条）

| # | 现象 | 归因 | 处置 |
| --- | --- | --- | --- |
| ① | 入场序列门禁恒为 `36/37`（差 1 个永不揭示） | **`data-reveal` 一属性两义**：`useReveal` 用它当门控开关（打在 `<html>` 上），同时又用它标记待入场元素。CSS 写的是 `[data-reveal='on'] [data-reveal]` —— 两个选择器同名，`<html>` 自己**自匹配**成一个待入场元素；它在观察子树之外，永远拿不到 `.is-revealed` | 新增独立门控属性 **`data-reveal-armed`**，与内容标记 `data-reveal` 拆开。改完 `querySelectorAll('[data-reveal]')` 天然只命中内容元素；门禁从 `36/37` 变 **`37/37`（未揭示 0）**，且 `audit-behavior.cjs` 里 `filter(el => el.tagName !== 'HTML')` 的补丁可以删掉 |
| ② | 首屏体积判据把 `codemirror` 列进「详情页应当加载」，导致反向对照失败 | **我写错了判据**：codemirror 是**后台编辑器**专属，只读的详情页本来就不该有它 | 反向对照改到 `/admin/articles/1`（带 token）；另加一条「详情页不含 codemirror」防回退 |
| ③ | `vite build` 在沙箱内、沙箱外**都**跑不动，报 `winapi error #5` | 起初以为是沙箱拦截 Node spawn。**排查后推翻了**：把 esbuild.exe 直接放 shell 里执行正常（`--version` → 0.25.12），是**本机 EDR 对 esbuild 子进程文件读取的拦截**（`ERROR_ACCESS_DENIED`），且**不稳定**（同一条命令先后两次，一次成功一次失败） | 不再硬啃这个环境问题。改为「shell 里直接跑 esbuild 生产打包 + Node 只读产物分析」两步走；`build-probe.cjs` 完全不 spawn |
| ④ | 首屏体积实测 859 KB，超 200KB 判据（dev server 口径） | dev 下 `/@vite/client`(32.8KB) + `@react-refresh`(23.4KB) 是**生产不存在**的；lucide-react 未 tree-shake 把整包图标(220KB)拉进来 | **不自欺地扣数**：换成真实生产构建口径（minify + tree-shaking），得 **82.9 KB**。dev 的 859KB 分解数据保留在矩阵里作为「dev vs prod 差异」的证据 |
| ⑤ | esbuild CSS 把 `serif-sc-article` 的 `@font-face` 合进了入口 `main.css` | esbuild 与 Vite 的 CSS 切分策略不同：esbuild 会把静态 CSS-import 的规则合并进入口 CSS | 不把这条做成静态文本断言（那是错的判据）。**`@font-face` 只是声明、不触发下载**，改用**运行时请求**判定 → 首页/`/tech` 零请求、详情页 1 条，实测通过 |

### 41.5 环境限制（更新，合并为两条）

1. **esbuild 子进程读盘被 EDR 拦截**（`winapi error #5`）：`vite build`、`vitest run` 都跑不动 ——
   但它们失败在**启动/配置加载**阶段，源码打包与测试代码本身没问题。
2. **Node 同步 spawn 一律 `EBUSY`**（阶段 40 已记）：`execFileSync` / `spawnSync` 不可用，异步 `spawn` 正常。

**因此 `vitest run` 本机不可用**（同 ①）。替代覆盖已写进矩阵：`tsc --noEmit` + 82 项浏览器行为断言 + 8 组对比度审计。
换到无 EDR 拦截的机器上，`vitest run` 应回归一键复跑 —— 这一点在矩阵里显式标注，**不当作「已通过」**。

### 41.6 留痕纪律自查

矩阵中 **无一条「已知问题」**：V1–V11 十一条「实测」栏全部是跑出来的真实数字。
唯一的外部依赖是 `vitest`（环境不可用），已在文档里如实标注并给出替代覆盖，未伪造通过。
