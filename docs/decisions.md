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

## 2026-09-28 · 一期视觉语言修订（实施期补充）

> 设计文档：`docs/design-visual-language.md`；实施计划：`docs/plan-visual-language.md`。
> 以下每条都是**执行时才发现**的约束，不是设计阶段能预判的。

| # | 决策 / 偏差 | 说明 |
| --- | --- | --- |
| 27 | **环装置的第三层（135° 面差渐变）不用作叠加层** | 参照站那一层是元素自身的底；作为叠加层会得到一块不透明背景，把正文与 body 氛围层全遮住。「底面差」由既有的 `--ds-atmosphere-*` 承担（设计文档 §2.1 注记） |
| 28 | **`RingField` 内部禁止写 `transform`，居中一律用 `margin`** | 入场序列 `[data-reveal]` 会写 `transform: translateY(18px)`，`.is-revealed` 又写 `transform: none`；环若用 `translateX(-50%)` 居中会被整个覆盖，环会瞬间跳到右边 |
| 29 | **项目表格去掉「年份」列** | 现有 `ProjectVO` 没有年份字段，凭空编年份就是假数据。改为 `ID / 项目 / 角色 · 状态`；等后端补 `period` 再加列 |
| 30 | **展开面板用 `hidden` 属性 + `.panel[hidden] { display: none }` 兜底** | `.panel` 是 `display: flex`，作者样式会盖掉浏览器默认的 `[hidden] { display: none }`，面板会永远展开。必须显式兜住 |
| 31 | **页脚环层不能加 `data-reveal`** | `useReveal` 只观察 `HomePage` 那棵子树（它拿的是 HomePage 的 ref），页脚在它之外 —— 带 `data-reveal` 的元素会被全局隐藏态规则压成 `opacity: 0` 且**永不揭示**，等于页脚环根本看不见。这个 bug 截图看不出来（截图脚本会先摘掉 `data-reveal`），是行为断言「入场序列 43/44」抓到的。**规则**：`data-reveal` 只能用在 HomePage 子树内 |
| 32 | **环 badge 单开一档 `--ds-ring-badge`（亮 22% 蓝 / 暗 32% 蓝）** | 54px 的区块标记照抄大环的不透明度（亮 6%/暗 8%）会看不见（截图确认）。大环是布景、badge 是路标，两档剂量本来就该分开 |

| 33 | **数字区改为四列数字块（推翻 #20 的一半）** | 用户原话「不要取舍，现在一点都没有气场」。编辑式行列表太平，改成参照站的四列数字块（衬线 30px + 强调色 + 等宽指标名）。**仍然不做 count-up、仍然不做卡片**（不着色 / 不描边 / 不投影），`<dl>` 语义保留（4 个 `dt` 的断言口径不变） |
| 34 | **顶栏改为悬浮玻璃胶囊 + 实心 CTA** | 用户要求按 mock 补齐；推翻执行时「通栏结构不动」的取舍。外层 sticky 壳加 `data-scrim` 顶部渐隐（功能性遮罩），断言套件的渐变护栏据此把它与「模板感渐变」区分开 |
| 35 | **按钮语言改为「实心胶囊 + 描边胶囊」** | 参照站的按钮是白底黑字 / 黑底白字的实心胶囊，**不用品牌色填充**；品牌蓝只留给数据、链接与状态。新增 `--ds-c-btn-solid-bg/fg`（亮 `#0f1115`+白 18.4:1 ✔；暗 白+`#050505` 20.1:1 ✔） |
| 36 | **新增整页晕影 `--ds-vignette`，并整体加强环与聚光** | 晕影是参照站「内容从暗处浮出」的主要手法（亮 82% 白 / 暗 92% 近黑，作为 body 背景最上一层，不新增元素）。环与聚光同步加强：亮 13% / 14%、暗 10% / 26%；`RingField` 聚光射程 34% → 46%、遮罩收到 10% → 64%（原来摊太开，看着像脏而不是像环） |

> **这一轮的性质**：用户看到实现后指出「没有 mock 的气场」。根因不是技术问题，是我在实现时做了四处
> 「比 mock 保守」的取舍（通栏导航、品牌色按钮、环不透明度砍半、字号收敛），而这些取舍**削弱了用户当时选中的那个东西**。
> 教训：mock 被选中之后，它就不再是「示意」，而是验收标准；实现阶段要偏离，必须显式提出并得到确认，不能默默收敛。

| 37 | **「零字体下载」作废：改为自托管中文衬线子集（92.7KB）** | 用户原话「字体没有达到那个效果」。探针查明根因：原字体栈把 `STSong`（华文宋体）排在思源宋体之前，而 STSong 没有 500/700 字重 → 浏览器**合成伪粗体** → 84px 中文发糊。改为：Latin 走 **Georgia**（参照站的展示字本来就是 Georgia），CJK 走自托管 **Noto Serif SC wght=500 子集**（531 字 / 92.7KB / `unicode-range` 只声明 CJK / `font-display: swap`）。推翻 #10；体量不占 JS 预算，重跑命令 `npm run fonts:build` |
| 38 | **字符表从「扫源码」改为「扫真实渲染的 DOM」** | 扫源码得 962 字（含上千行中文注释），子集体积翻倍；扫 5 个路由的可见文本 + aria/title/alt + 交互态文案得 **531 字**。纪律：加新内容后若出现字符表外的汉字，必须重跑子集流水线，否则那个字会回落到系统字体、与相邻字不同款 |

| 39 | **首屏字体统一：一个视野内只允许一套字形** | 用户原话「映入眼帘的位置的字体还是得优化一些」。查明问题不是字号，而是混了三套字形：① kicker 上轮被改成等宽，而**等宽栈无 CJK 字形** → `广州` 回落雅黑、`AI` 是 Consolas；② 一句话定位用正文无衬线，而里面的 `Agent`/`Java` 是 Georgia 斜体 → 两种气质打架；③ 姓名 84px 偏小且暗底上渐变发虚。改法：kicker 回无衬线（12px/0.18em）；姓名 96px；定位行与一句话都改用**展示衬线**；自述留无衬线；按钮 15px/min-height 48px；首屏 gap 12→16px |
| 40 | **暗色姓名渐变提亮，与亮色分开取色** | 基线 `#0756ab` 是为白底选的；近黑底 + 96px 下整块字「虚」。暗色改用 `linear-gradient(120deg, #7cc0ff, #4d9bff 38%, #b48cff)`（10.6:1 / 7.0:1），保留蓝→紫签名。**这是全站唯一一处按主题分别取色的渐变** |
| 41 | **等宽字白名单追加中文禁区** | `--ds-font-mono` 的栈（Consolas/Monaco…）没有任何 CJK 字形；用它排中文文案会**逐字回落**到无衬线，与相邻 Latin 字形不搭。白名单明确为：只用于纯 Latin/数字（表头、年份、档位、单位、计数），**不得用于含中文的句子**（kicker 曾因此踩坑） |

| 42 | **按钮收敛为全局按钮系统** | 原来 Hero / 顶栏 / 项目展开 / 复制 / 页脚 / 返回 各写一份按钮 CSS，圆角、内边距、hover 不一致。收敛为 `global.css` 的 `.btn` + `.btnSolid` / `.btnOutline` / `.btnGhost` / `.btnSm` / `.btnStart`；**组件 CSS Module 只保留布局**（对齐、定位），不再重复颜色与形状 |
| 43 | **指针聚光移植为 `useSpotlight`，拒绝 Tailwind + shadcn** | 外部组件要求 shadcn 结构 + Tailwind + `/components/ui`，本项目三条都不满足，且选型在规划里定死（#7 D4=A）。**不装 Tailwind / shadcn / lucide-react**，只移植效果：`useSpotlight` 写 `--spot-x/--spot-y`，表格行用 `.host`（伪元素两层：底光 + 边框高光，`z-index:-1` + `isolation`），按钮用 `.btnSpot`（背景图叠加，因为实心底色会盖住 `-1` 的伪元素）。四处与原始实现的差异：监听元素自身而非 `document`、元素相对坐标而非视口坐标 + `background-attachment: fixed`、只在 `(hover: hover)` 且非 reduced-motion 时绑定、进入/离开只切一个属性 |
| 44 | **中文排版细则与区块节奏** | `font-synthesis: none`（**禁止合成字重**——这是阶段 11「中文姓名发糊」的根因，从机制上杜绝复发）、`line-break: strict`（避头尾）、`text-spacing-trim: trim-start`、正文行高 1.7 → 1.8、标题 `text-wrap: balance` / 段落 `pretty`、区块纵向节奏 48 → 64px、区块导语 16 → 17px（导语要比正文大一档，不是小一号） |

## 环境注意事项（Windows + WorkBuddy 沙箱）

| 坑 | 现象 | 绕过方式 |
| --- | --- | --- |
| esbuild / rollup postinstall 失败 | `npm install` 报 spawn EPERM，`@esbuild/*` 平台包缺失 | `npm install --ignore-scripts`，缺失的平台包用 `--no-save` 显式补装（`@rollup/rollup-win32-x64-msvc` 需与 rollup 版本一致） |
| vitest 缓存写入 EPERM | 经 `npm.cmd` 运行 vitest 时随机丢测试文件（`EPERM ... AppData/Local/Temp/.../web/...`） | 把 `TMP`/`TEMP`/`TMPDIR` 指向项目内 `.tmp/` 再跑，两个测试文件都会被发现 |
| **esbuild 子进程被拒读磁盘**（2026-09-28 22:20 起复现，**同日 23:3x 随沙箱策略放宽而解除**） | `vite build` 与 `vitest` 均报 `Cannot read file "...": winapi error #5`；最小复现证明 `esbuild.transform()`（纯内存）正常、任何磁盘读取都失败，而 Node 自己的 `fs.readFileSync` 读同一文件正常。项目内外路径均失败，`dangerouslyDisableSandbox` 无效；vitest 内嵌的 esbuild 0.21.5 另报 `winmm.dll not found` | 限制期间的替代验证：`tsc --noEmit` + 浏览器断言 + 对比度审计（这套已经跑通 24 项，比 jsdom 覆盖面更广，**保留为常规手段**）。解除后补跑：`vitest` 5 文件 / 25 用例全绿；`vite build` 通过（JS 227.82KB / **gzip 76.06KB**、CSS 30.84KB / gzip 6.21KB，首屏预算 200KB ✔）。补跑当场抓到 `withLatinEmphasis` 多包一层 `<span>` 的实现问题 |
| React Router future flag 警告 | v6.28 提示 v7 变更 | 无害；升级 v7 时统一处理 |
| **Playwright 无法启动浏览器**（2026-09-28 22:36 起复现） | `chromium.launch({ channel: 'msedge' })` 报 `spawn EPERM`（浏览器以 `--remote-debugging-pipe` 命名管道启动，受限模式禁止）。直接用 Edge 自带 headless 截图（`--headless=new --screenshot=`）同样无产物（连 example.com 也拍不出） | 本会话内一次性提权到 `danger-full-access` 后可正常运行。**每次新会话首次跑截图脚本都需要提权一次** |
| **brainstorming 视觉陪跑服务启动方式** | skill 自带的是 `scripts/start-server.sh`（bash），Windows 下不可直接用 | 直接跑 node：`BRAINSTORM_DIR=<项目>/.superpowers/brainstorm/s1` + `BRAINSTORM_PORT=52341` + `node ~/.agents/skills/brainstorming/scripts/server.cjs`，以后台任务方式常驻。`.superpowers/` 已加入 `.gitignore` |
| **npm 缓存写入被拒** | `npx` 报 `EPERM ... AppData\Local\npm-cache\_cacache\tmp\...` | 把 `npm_config_cache` 指向项目内目录（如 `.npm-cache`）再执行；用完删除该目录 |
| **自己起 dev server 会失败** | `npm run dev` 报 `spawn EPERM`（vite 加载配置时 esbuild 起子进程被拒），但 5173 上仍有一个可用的 dev server | 该服务是另一个会话留下的；Vite 的 HMR 会吃磁盘上的改动，直接用它即可。若它挂了，再用 `danger-full-access` 起一个 |
| **编辑源文件偶发 `ReplaceFileW EIO (Win32 1175)`** | 写入被 Vite 的文件监听占用 | 重试同一次编辑即可（同一命令重试第二次都成功） |
