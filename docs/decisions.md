# 实现期决策记录（decisions）

> 依据 `docs/项目前期规划.md` 附录 B：实现阶段的偏差记录在这里，**不回改**规划文档结论。

## 2026-09-28 · 首页（关于我）实现

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 1 | **新增三个首页区块**：关键数字、教育背景、荣誉奖项 | 规划 §4.1 面向有工作经验者；本站作者是应届生，竞赛奖项与专业排名是可信度最强信号。数据层影响：M2 需新增 `education` 与 `award` 表（或并入 profile seed），当前由前端常量承载 |
| 2 | **首页数据先走前端常量** `src/data/profile.ts` | 后端未起。常量结构对齐 `/api/v1/profile` VO，后端就绪后只换 `useProfile()` 实现，组件零改动 |
| 3 | **手机号默认不上站** | 公网个人站防骚扰；需要时在 `profileData.contacts` 加一项即可 |
| 4 | **实习经历排序规则：按结束时间倒序（至今优先）** | CVTE（2025-04 起，至今）与用友（2025-07 ~ 2025-10）时间重叠，按开始时间排序会把用友排前面，不符合「当前主线」语义。已用测试固化（`profile.test.ts`） |
| 5 | **简历 PDF 入仓** `frontend/public/resume.pdf` | 供「下载简历」CTA；441KB，可接受 |
| 6 | **规划评审发现 5 处硬伤**（详见 2026-09-28 对话记录，待用户确认后落改）：① §8.4「公开接口无写方法」与 §9.2 `POST /articles/{slug}/view` 矛盾；② Sa-Token 分库未真正落地（需自定义 SaTokenDao）；③ 全文索引只覆盖 title+summary，正文不可搜，且 MySQL 需启动参数 `ngram_token_size=2`；④ 浏览量三处真相、回写语义未定义；⑤ M1 DoD 过重建议拆 M1a/b/c |
| 7 | 未决决策建议值：D1=C · D4=A（CSS 变量 + CSS Modules）· D5=A · D6=A（DB 存相对路径，VO 层拼完整 URL）· D7=A · D11=A · D12=A | 待用户最终确认后更新规划 §15 |

## 2026-09-28 · 首页视觉返工（去 AI 味）

> 触发：用户「我现在这个项目的页面太AI了，第一期不符合！」并提供参照站 https://golangstar.cn/。
> 完整实测数据见 `docs/style-ref-golangstar.md`。

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 8 | **品牌主色由青碧 Teal 改回蓝**（推翻 `design-system` 原定的 D3 品牌色） | 用户原话：「不要有绿色，不好看，蓝色就好」。实现上不是新造颜色，而是**撤掉 `theme.jcpress.css` 的 Teal 覆盖层**，回到 `tokens.curated.css` 里已实测过的蓝色三档（`#0756ab` / `#096fdc` / `#0a7bf5`）。`design-system/palette-options.html` 的选色记录因此失效 |
| 9 | **全站渐变收敛到 Hero 标题一处** | 参照站规则：装饰性渐变只出现在 H1。据此把导航品牌标记从渐变改成实色填充 `--ds-c-accent-bg`（顺带修掉白字压在渐变最亮档只有 4.07:1 的问题） |
| 10 | **新增展示字体 `--ds-font-display`（中文衬线栈，零下载）** | 正文继续用系统无衬线栈。栈序：`Songti SC → STSong → Source Han Serif SC → Noto Serif CJK SC → Noto Serif SC → SimSun → Georgia → serif`。选零下载是因为全量思源宋体 10MB+，会直接破掉规划 §2.8「首屏 gzip ≤200KB」预算。实测在 Windows 上命中 SimSun/serif |
| 11 | **新增发丝线令牌 `--ds-c-hairline`** | 基线的 `--ds-c-border-soft` 在暗色下是纯黑 `#000`（参照站靠面差分区，不需要可见的线）。本站用发丝线做分块，暗色下必须有能看清的线，故单开一条语义令牌（亮 `#e2e2e3` / 暗 `#2e3238`） |
| 12 | **文本灰阶整体上提一档（对比度校正）** | 基线实测 `text-subtle` 亮色 3.12:1、暗色 3.18:1，均低于 AA 4.5:1。本站在出处、档位、元信息这类真实内容上大量使用该档，不能按「装饰文字」豁免，故：亮色 mute 78%→80%（6.01:1）、subtle 56%→72%（4.78:1）；暗色 mute 60%→72%（8.01:1）、subtle 38%→60%（5.95:1）。层级感改由字号与位置承担 |
| 13 | **暗色强调色提亮 `#2388f6` → `#4d9bff`** | 基线值压在 `accent-soft` 药丸底上只有 4.28:1，暗色激活态导航项不达标；提亮后 5.38:1 ✔（纯底 6.10:1 ✔）。暗色主题本就需要更亮的强调色 |
| 14 | **新增正文行宽令牌 `--ds-measure-prose: 36rem`** | 通栏长段落原本一行到 920px（中文约 65 字），超出 frontend-design 基准「中文正文 28–40 字/行」。36rem = 576px ≈ 41 字。双栏区块本身即在该宽度内，不受影响 |
| 15 | **入场序列用 JS 门控，隐藏态不写死在 CSS** | 参照站无任何入场动效；frontend-design 基准要求「一次编排好的入场序列」。折中做法：隐藏态由 `<html data-reveal="on">` 门控，`useReveal` 在第一帧前补上该属性。JS 未执行（爬虫 / 将来的构建期预渲染产物）时正文永远可见 —— 不拿 SEO 换动效 |
| 16 | **删除 `hooks/useCountUp.ts`（含 `useInView`）及其测试** | 关键数字区去掉数字滚动后，两个钩子不再有任何引用。保留即为死代码，与 QA 清单第 9 条冲突。测试数因此由 11 降到 12（新增 5 条「反 AI 味」回归护栏，净增 1） |

### 反 AI 味的具体改动（逐项）

| 原元素 | 处理 | 去向 |
| --- | --- | --- |
| 240px 青碧渐变头像方块 | **删除**，Hero 改居中单列 | 用户选择「去掉头像区」 |
| 超大数字 + 滚动计数（85% / 65→90 / 1200→50） | 改为编辑式定义列表，数值与正文同级字号 | `HighlightStats` |
| 点阵熟练度条 `●●●●○` | 改为纯文字档位（熟悉 / 掌握 / 了解）右对齐 | `SkillMatrix` |
| 「已上线」彩色状态胶囊 | 改为纯文字：`开发负责人 · 已上线` | `ProjectShowcase` |
| 技术标签胶囊组 | 改为 `·` 分隔的纯文本行 | 实习 / 项目 |
| 卡片内嵌套卡片 | 实习经历改单层两栏（左时间 / 右正文） | `ExperienceTimeline` |
| Hero 两个按钮 + 三个标签胶囊 | 收敛为一个实心胶囊 CTA + 一个文字链接；标签删除 | `Hero` |
| 页脚四张数字卡 | 改为一行文字式统计 | `Footer` |
| 每个区块都包一层卡片 | 全部改为「顶部发丝线 + 通栏」分块 | 全站 |

## 2026-09-28 · 一期视觉语言修订（环装置 + 双主题）

> 触发：用户「页面的效果是好了一点，没有很浓的AI味了。但是少了点味道……在原来的页面补一些小图案」，
> 并给出参照站 `https://21st-aura-svelte-preview-jdpo1k26v-larsen3.vercel.app/`。
> 设计文档：`docs/design-visual-language.md`；参照实测：`docs/style-ref-aura.md`。

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 17 | **图案改为「环」母题**：同心圆环（1px / 7px 周期）+ 中心聚光 + 遮罩渐隐，固定出现在 顶栏 logo、首屏、项目经历 badge、页脚 四处 | 参照站的图案是「光场」而非底纹（源值 `.hero-field`：聚光 20% 白 + `#ffffff1f` 1px 环 + 135° 面差 + `mask-image` 5%→72%）。本次把它系统化成母题，避免退化为随机点缀。环**静止**，不做漂移/旋转（用户否决了整页漂移方案 R3） |
| 18 | **双主题共用一套装置**：暗色＝剧场版（近黑 `#08090c` + 8% 白环 + 20% 蓝聚光），亮色＝装置版（白底 + 4% 蓝环 + 10% 蓝聚光） | 用户原话：「暗色的时候就A 亮色就C」。两套结构完全相同，只换 token；**不改成暗色单主题** |
| 19 | **「不加噪点颗粒」这条作废** | `theme.jcpress.css` 原注释写「只用径向渐变网格这一种技法，不加噪点颗粒」。用户明确要求补图案，该条作废；改写为「图案统一走环装置，不得引入第二种纹理（噪点 / 网格 / 斜纹）」，防止变成叠纹理 |
| 20 | **大数字统计区的折中** | `style-ref-golangstar.md` §7 把「大数字 count-up 统计条」列为反模式，上一轮据此删掉了仪表盘式数字区（#16）。本次**保留编辑式行结构**，只把数值换成蓝色衬线 + 22px；不恢复四格大数字卡片、不恢复 count-up |
| 21 | **环周期按真实渲染校准：最终取 46px，不照抄参照站的 7px** | 参照站源值是 `repeating-radial-gradient(… #ffffff1f 0 1px, #0000 1px 7px)`，但 7px 在 1:1 渲染下与像素网格打架，产生**间距不均的摩尔纹**（暗色下最明显）。用 `.tmp/tools/probe-ring.cjs` 对 9 / 24 / 46px 各拍 1:1 裁图对比后取 **46px**（两个主题一致）：均匀、可辨、最接近用户在参照站看到并认可的观感。亮色环不透明度同步 4% → 6%（4% 在白底上几乎不可见）。结论回写 `docs/design-visual-language.md` §2.1 |
| 22 | **提前落地 M3 的「技术分享」列表页外壳** | 规划 §13 的 M3 还含接口 / 详情 / Markdown 渲染 / 浏览量。本次只做**前端外壳 + 前端常量数据**（`src/data/articles.ts`），列表项不设链接（详情页未建，避免死链）。属范围扩大，用户已确认 |
| 23 | **斜体只给 Latin 词** | 中文没有真斜体，浏览器机械倾斜在中文字形上廉价。仅 Hero 第二行与项目名的 Latin 词可斜体，且同时降到 `--ds-c-text-mute`（参照站手法：斜体与降灰同时出现） |
| 24 | **hover 不作任何信息的唯一入口** | 项目经历改为编辑式表格后，「展开看亮点」用 `<button aria-expanded>` 点击 / 回车触发；hover 只做视觉强调。沿用上一轮 code review 立的规矩（`dev-journal.md` 阶段 5 检查表：「hover 不作唯一入口」） |
| 25 | **发丝线改为半透明**（亮 `#e2e2e3` → `rgb(20 22 26 / 12%)`，暗 `#2e3238` → `rgb(255 255 255 / 13%)`） | 环会铺在区块之下，实色线会把图案「切断」。半透明线让环透过线继续可读。属对上一轮已定值的修订，需复测可见性 |
| 26 | **文档位置沿用仓库约定**（`docs/*.md`），不引入 `docs/superpowers/specs/` | brainstorming skill 的默认路径与本仓库既有约定（`design-homepage.md` / `style-ref-*.md` / `decisions.md`）不一致；用户偏好优先，取 `docs/design-visual-language.md` |

## 环境注意事项（Windows + WorkBuddy 沙箱）

| 坑 | 现象 | 绕过方式 |
| --- | --- | --- |
| esbuild / rollup postinstall 失败 | `npm install` 报 spawn EPERM，`@esbuild/*` 平台包缺失 | `npm install --ignore-scripts`，缺失的平台包用 `--no-save` 显式补装（`@rollup/rollup-win32-x64-msvc` 需与 rollup 版本一致） |
| vitest 缓存写入 EPERM | 经 `npm.cmd` 运行 vitest 时随机丢测试文件（`EPERM ... AppData/Local/Temp/.../web/...`） | 把 `TMP`/`TEMP`/`TMPDIR` 指向项目内 `.tmp/` 再跑，两个测试文件都会被发现 |
| **esbuild 子进程被拒读磁盘**（2026-09-28 22:20 起复现，未解决） | `vite build` 与 `vitest` 均报 `Cannot read file "...": winapi error #5`；最小复现证明 `esbuild.transform()`（纯内存）正常、任何磁盘读取都失败，而 Node 自己的 `fs.readFileSync` 读同一文件正常。项目内外路径均失败，`dangerouslyDisableSandbox` 无效；vitest 内嵌的 esbuild 0.21.5 另报 `winmm.dll not found` | 暂时无解。替代验证手段：`tsc --noEmit`（不依赖 esbuild）+ 已启动的 dev server 上跑 Playwright 浏览器断言。**生产构建在限制出现前已成功过一次**（JS gzip 73.59KB / CSS gzip 4.96KB） |
| React Router future flag 警告 | v6.28 提示 v7 变更 | 无害；升级 v7 时统一处理 |
| **Playwright 无法启动浏览器**（2026-09-28 22:36 起复现） | `chromium.launch({ channel: 'msedge' })` 报 `spawn EPERM`（浏览器以 `--remote-debugging-pipe` 命名管道启动，受限模式禁止）。直接用 Edge 自带 headless 截图（`--headless=new --screenshot=`）同样无产物（连 example.com 也拍不出） | 本会话内一次性提权到 `danger-full-access` 后可正常运行。**每次新会话首次跑截图脚本都需要提权一次** |
| **brainstorming 视觉陪跑服务启动方式** | skill 自带的是 `scripts/start-server.sh`（bash），Windows 下不可直接用 | 直接跑 node：`BRAINSTORM_DIR=<项目>/.superpowers/brainstorm/s1` + `BRAINSTORM_PORT=52341` + `node ~/.agents/skills/brainstorming/scripts/server.cjs`，以后台任务方式常驻。`.superpowers/` 已加入 `.gitignore` |
| **npm 缓存写入被拒** | `npx` 报 `EPERM ... AppData\Local\npm-cache\_cacache\tmp\...` | 把 `npm_config_cache` 指向项目内目录（如 `.npm-cache`）再执行；用完删除该目录 |
