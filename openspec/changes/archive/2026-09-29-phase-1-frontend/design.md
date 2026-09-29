# Design: phase-1-frontend

> 本文件是对**已交付实现**的设计回溯：记录当时的技术决策与理由，供后续 change 参考。
> 动机见 `proposal.md`；行为契约见 `specs/`。详细的视觉与排版推导在 `docs/design-visual-language.md`，
> 参照站实测指纹在 `docs/style-ref-golangstar.md` 与 `docs/style-ref-aura.md`。

## Context

- 技术栈（规划定死，本 change 未改动）：React 18 + TypeScript(strict) + Vite 6 + React Router 6 + **CSS 变量 + CSS Modules**（`design-system` 派生令牌：`tokens.curated.css` 为溯源基线、`theme.jcpress.css` 为本站覆盖层）。
- 后端未开始（M1），首页数据先走前端类型化常量（`src/data/profile.ts`、`src/data/articles.ts`），结构对齐未来 VO，切换时只换 hook 实现。
- 约束：首屏 JS gzip ≤ 200KB；零图片素材；图案不得产生网络请求；`prefers-reduced-motion` 必须降级；正文对比度 ≥ 4.5:1。
- 既有工程纪律：可访问性红线（触摸目标 ≥44px、hover 不作唯一入口）与「每处改动实测对比度并写进注释」。

## Goals / Non-Goals

**Goals**

- 一套可复用的视觉语言装置（不是一次性皮肤），后续页面能直接继承。
- 主页信息在 30 秒内可被陌生访客读懂，且移动端单列可读。
- 每个视觉决策都能回指到实测证据或明确的禁用清单。

**Non-Goals（设计层面）**

- 不做动效库（GSAP / Lenis）——手写 CSS + `IntersectionObserver` 足够，且预算里没有动效库。
- 不做暗色单主题：亮暗两套都要成立（用户明确要求「暗色 A / 亮色 C」两种气质）。
- 不为视觉引入第二套样式系统（Tailwind / shadcn / 原子类）——见 Decisions。

## Decisions

**D1 图案用「环装置」而不是底纹。（alternatives: 方格纸 / 点阵 / 噪点颗粒 / 全页漂移环）**

参照站的图案本质是**空间光场**（同心环 + 中心聚光 + 遮罩渐隐），不是纹理。故提炼为母题，固定出现在顶栏 logo、首屏、项目 badge、页脚四处；环**静止**（全页漂移方案被用户否决，理由：读久了晕）。全站只允许这一种图案语言。

**D2 环的周期按真实渲染校准为 46px，而不是照抄参照站的 7px。**

参照站源值 7px 在 1:1 渲染下与像素网格产生**间距不均的摩尔纹**（暗色下最明显）。用 `.tmp/tools/probe-ring.cjs` 对 9 / 24 / 46px 各拍 1:1 裁图对比后取 46px：均匀、可辨，最接近用户在参照站上认可的观感。

**D3 双主题共用一套结构，只换令牌。（alternatives: 暗色单主题 / 两套独立样式）**

暗＝剧场版（近黑底 + 8–10% 白环 + 20–26% 蓝聚光），亮＝装置版（白底 + 蓝环 + 更低剂量聚光）。结构完全相同；剂量按主题各调一档，避免「亮底上环太糊 / 暗底上看不见」。

**D4 展示字：Latin 走 Georgia，中文走自托管子集（92.7KB）。（alternatives: 纯系统栈零下载 / 全量思源宋体 / Google Fonts）**

纯系统栈在 Windows 上落到 STSong/SimSun —— **没有 500/700 字重，浏览器合成伪粗体**，84–96px 中文字面发糊，这是「字体达不到参照站效果」的真正原因。全量思源宋体 10MB+ 破预算；Google Fonts 在目标网络环境下不可用且不可控。
故：变量字体实例化到 **wght=500**，字符表**从真实渲染的 DOM 收集**（531 字，5 个路由的可见文本 + aria/title/alt + 交互态文案），`pyftsubset` 出 **woff2 92.7KB**；`unicode-range` 只声明 CJK，Latin 交给 Georgia。变量子集 176.8KB 被否（全站展示字只需一档）。

**D5 中文排版用系统能力兜底，而不是靠调字号。（alternatives: 逐处手调 letter-spacing）**

`font-synthesis: none`（从机制上杜绝合成字重，防止 D4 的问题复发）、`line-break: strict`（避头尾）、`text-spacing-trim: trim-start`、正文行高 1.8、标题 `text-wrap: balance`、段落 `pretty`。

**D6 按钮收敛为全局系统。（alternatives: 各组件自带按钮样式）**

原来六处按钮各写一份，圆角与 hover 不一致。收敛为 `.btn` + `.btnSolid` / `.btnOutline` / `.btnGhost` / `.btnSm` / `.btnStart`；**组件 CSS Module 只保留布局**（对齐、定位）。

**D7 指针聚光移植为 `useSpotlight`，不引入 Tailwind / shadcn。（alternatives: 按外部组件说明装 Tailwind + shadcn）**

外部组件说明要求 shadcn 结构 + Tailwind + `/components/ui`，与本项目定死的选型（CSS 变量 + CSS Modules）冲突：会引入第二套样式系统、令牌重复、多一份运行时 CSS 破预算，且其工具类 `className` 在 CSS Modules 中无法解析。故只移植效果：指针相对坐标写入 CSS 变量，表格行用伪元素两层（底光 + 边框高光），按钮用背景图叠加（按钮有实心底色，`z-index:-1` 的伪元素会被自身底色盖住）。
与原始实现的差异（均为工程必需）：监听元素自身而非 `document`、元素相对坐标而非视口坐标 + `background-attachment: fixed`、只在 `(hover: hover)` 且非 reduced-motion 时绑定、进入/离开只切一个属性。

**D8 项目经历用编辑式表格承载，且「展开」用 `<button aria-expanded>`。（alternatives: 卡片墙 / hover 揭示详情）**

卡片墙模板感强；hover 揭示在触摸设备上不可用，且违反项目既有红线（hover 不作唯一入口）。表格去掉「年份」列：现有数据模型没有该字段，凭空编年份即假数据。

**D9 数据层先走类型化常量。（alternatives: 先起后端 / 直接读 JSON）**

`src/data/profile.ts`、`src/data/articles.ts` + `use*()` hook 作为唯一读取入口，结构对齐未来 VO；后端就绪后只换 hook 实现，组件零改动。`/tech` 列表项的计数取 `articles.length`，不写死数字。

**D10 图表与统计维持「编辑式」而非仪表盘。（alternatives: 四格大数字卡片 + count-up）**

count-up 与仪表盘式统计条被明确列为「生成感」信号（上一轮已删除），本 change 不恢复；数字区改为四列**数字块**（衬线 + 强调色 + 等宽指标名），靠字号与留白分栏，不着色不描边不投影。

## Risks / Trade-offs

- [中文字体子集需要随内容更新] → 加内容（尤其 M3 详情页）后若出现字符表外的汉字，该字会回落到系统字体、与相邻字不同款；已提供 `npm run fonts:build` 并在 `docs/decisions.md` 记录重跑时机。
- [环与聚光会抬高局部背景亮度，可能压低正文对比度] → 对比度按 WCAG 实测并写进注释；审计脚本覆盖亮暗各 227 处文本，未达标 0。
- [指针聚光在低端设备上有额外绘制成本] → 只在 `(hover: hover)` 且非 reduced-motion 时绑定；每行只有一个监听器；不改变布局（不触发 reflow）。
- [装饰性渐变容易失控（模板感的主因）] → 断言套件设有「渐变白名单」护栏：只允许环装置、姓名、顶栏功能性遮罩、聚光宿主四类，其他元素一律亮红。
- [一期未验的两项 DoD] → Lighthouse 移动端评分与真机验证未做，已如实登记，不因归档而消失。

## Migration Plan

无迁移：本 change 是回溯记录，`main` 上的代码早已生效。归档动作只新增 `openspec/specs/` 四份主干 spec，并把 change 目录移入 `openspec/changes/archive/2026-09-29-phase-1-frontend/`。回滚方式：删除新增的主干 spec 与归档目录即可（不影响任何运行时代码）。

## Open Questions

- 中文展示字是否需要在 M3 引入第二档字重（如小标题 600）？届时取决于详情页层级需要；重跑子集流水线即可，不影响现有 spec。
- `/tech` 列表在接入真实数据后是否保留「无详情页时不给链接」的策略？属 M3 范围，届时按详情页可用性决定。
