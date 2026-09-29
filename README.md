# jcpress

> 个人网站 —— 展示个人经历与技术栈，沉淀技术分享与项目笔记。
> 当前状态：**一期前端已完结**（首页 / 频道外壳 / 视觉语言，见 `docs/dev-journal.md` 阶段 1–14）；
> 二期视觉修订进行中（`openspec/changes/phase-2-visual/`）。后端与部署尚未开始。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + React Router + TanStack Query；**构建期预渲染**（SEO）；**移动端优先适配** |
| 后端 | Java 21 + Spring Boot 3 + MyBatis-Plus + **Gson** + **Sa-Token**（仅后台登录用） |
| 存储 | MySQL 8（内容 + 后台账号） · Redis 7（Sa-Token 会话 / 缓存 / 限流） |
| 部署 | Docker Compose（Nginx + Backend + MySQL + Redis） |

## 规划文档

| 文档 | 内容 |
| --- | --- |
| [`docs/项目前期规划.md`](docs/项目前期规划.md) | **唯一源**：设计基线、信息架构、系统架构、数据库设计、Redis 设计、访问控制与后台认证（Sa-Token）、API 契约、后台管理系统、工程规范、部署、里程碑、风险、决策表 |
| [`design-system/README.md`](design-system/README.md) | 设计 token 的提取溯源、许可说明与已知缺口 |
| [`design-system/tokens.curated.css`](design-system/tokens.curated.css) | 从参照站提取的 light + dark 双主题 token（**证据基线，保持原样**） |
| [`design-system/theme.jcpress.css`](design-system/theme.jcpress.css) | **本站品牌主题层**：青碧 Teal 主色、语义色调校、移动端 token 覆盖（在基线之后引入） |
| [`design-system/palette-options.html`](design-system/palette-options.html) | 品牌主色候选预览（亮 / 暗两套 + 语义色撞色判定） |

## 已确定的内容结构

导航：**关于我** · **技术分享**（按分类）· **算法笔记**（按专题 + 难度）· **项目笔记**

- `/` 关于我：Hero、技术栈矩阵、实习经历时间线、项目经历卡片、数据统计、联系方式
- `/tech` 技术分享：分类总览 → 分类列表 → 文章详情（Markdown + 代码高亮 + TOC）
- `/algo` 算法笔记：专题总览（数据结构 / 算法思想）→ 题目列表（难度筛选）→ 题解详情（题号 / 复杂度 / 多解法），
  复用 `article` 管线 + `algo_problem` 扩展表
- `/projects` 项目笔记：项目卡片墙 → 项目详情 → 关联笔记
- `/admin` 后台写入口：**需要账号登录**（Sa-Token），不出现在公开导航里
- 前台**无需登录**：全站公开可读，没有注册入口、没有内容可见性分级
- 生活经验频道**暂不实现**（决策 D2；可见性备选方案见规划文档[附录 C](docs/项目前期规划.md#附录-c生活经验可见性备选方案)）

## 内容维护方式（一期）

| 内容 | 怎么维护 |
| --- | --- |
| 技术分享 / 算法笔记 / 项目笔记 | 仓库写 `content/**/*.md` + front-matter（算法笔记另带题号 / 难度 / 复杂度），M1 的 **Markdown 导入器**灌库（可 diff、可回滚）；也可用后台写入口 |
| 后台写入口 | `/admin` 登录后写，M5 实现（**Sa-Token 账号登录**） |
| 简历数据 | Flyway seed / 直接 SQL |
| 后台账号 | 数据库手工维护，**不开放注册** |
| 完整管理后台 | **放在 M7，按需启动** —— 见规划文档 [§10](docs/项目前期规划.md#10-后台管理系统)（决策 D8） |

## 验收怎么跑（前端）

**权威清单在 [`docs/phase2-effect-matrix.md`](docs/phase2-effect-matrix.md)**（二期把它当作「评估集」：每条视觉效果的判据 + 复核命令 + 实测结果）。常用命令：

```bash
# 前置：dev server 必须在 5173 上跑着（截图与浏览器断言里的 URL 是硬编码的）
cd frontend && npm run dev

# 1) 类型检查与单测
cd frontend && npx tsc --noEmit
cd frontend && node node_modules/vitest/vitest.mjs run      # 25/25

# 2) 浏览器行为断言（47 项：结构、渐变护栏、触摸目标、入场、流线层、滚动联动、排版与面板）
node .tmp/tools/audit-behavior.cjs

# 3) 对比度审计（亮暗各约 240 处文本，未达标必须为 0）
node .tmp/tools/audit-contrast.cjs

# 4) 四视口截图 + 横向溢出（1280 / 768 / 390 / 375）
node .tmp/tools/shot-final.cjs .tmp/shots-p2

# 5) 移动端性能归因（帧率 / 掉帧 / 长任务，含「隐藏流线层 / 只关动画」对照）
node .tmp/tools/audit-perf.cjs

# 6) 生产构建 + Lighthouse 移动端（**必须对生产构建测**）
cd frontend && npm run build && npx vite preview --port 4173
npx --yes lighthouse@12 http://127.0.0.1:4173/ --only-categories=performance \
  --form-factor=mobile --chrome-flags="--headless=new --no-sandbox"
```

两条会误导人的经验（都写进了 `docs/decisions.md`）：

- **性能数字必须标明测的是 dev 还是生产构建**：同一份代码对 dev server 跑 Lighthouse 只有 30 分，对生产构建是 98 分。
- **截图工具必须先「冻结一帧」再拍**：页面上有常驻无限动画时，Chromium 会拍到空白/陈旧帧；
  而 `animations: 'disabled'` 会把无限动画重置到初始态（流线相位归零，图案退化成挤在左边缘）。
  正确做法见 `shot-final.cjs` 的 `freezeFlowFrame()`。

## 字体流水线（自托管中文衬线子集）

展示字是**两档真字重**的 Noto Serif SC 子集（Latin 仍走系统 Georgia，中文走自托管子集，
`unicode-range` 只认 CJK）：

| 档位 | 文件 | 字符表 | 体积 | 用在哪 |
| --- | --- | --- | --- | --- |
| 500 | `frontend/public/fonts/serif-sc-500.woff2` | 全站字符表（`.tmp/fonts/chars.txt`） | 92.7KB / 531 字 | 定位行、一句话定位、区块导语以外的衬线层 |
| 700 | `frontend/public/fonts/serif-sc-700.woff2` | **只含展示字**（`.tmp/fonts/chars-display.txt`） | 9.0KB / 45 字 | `h1` / `h2` / 关键数字 |

```bash
cd frontend
npm run dev                  # 前置：dev server 必须在 5173 上跑着（收集字符要开浏览器）
npm run fonts:build          # 500 档
npm run fonts:build:display  # 700 档（自动跑「只收展示字」的字符表收集）
```

只重收字符表、不重切子集：`npm run fonts:chars`（全站）/ `npm run fonts:chars:display`（展示字）。

- 前置依赖：Python 3 + `fonttools` + `brotli`；源字体（Noto Serif SC 变量字体，约 24MB，OFL 许可）
  首次自动下载并缓存在 `frontend/.tmp/fonts/`。
- 字符表是从**真实渲染的 DOM** 收集的，不扫源码 —— 扫源码会把上千行中文注释也算进去、子集翻倍。
- **新增汉字后必须重跑**：出现字符表外的字时，那个字会回落到系统宋体、与相邻字不同款。
- **700 档漏字更隐蔽也更难看**：同一行标题里会混用两档字重（观感就是"发糊"）。
  用 `node frontend/scripts/audit-display-font.cjs` 断言「展示字字符集 ⊆ 700 子集」——
  它读的是**字体文件的真实 cmap**（`document.fonts.check()` 做不到这件事：两个 face 的
  `unicode-range` 相同，check() 只回答"该用哪个 face"，不回答"字形存不存在"）。
- 两个 `@font-face` 的 `unicode-range` 必须**逐字一致**，否则会出现同一个字一半走 Georgia、
  一半走子集的分裂。

## 仓库结构（规划）

```text
jcpress/
├── docs/                # 前期规划与决策记录
├── design-system/       # 设计 token、提取产物与溯源说明
├── content/             # Markdown 源文件（技术文章 / 项目笔记，待创建）
├── frontend/            # React SPA，含 /admin 后台路由（待创建）
├── backend/             # Spring Boot 应用（待创建）
└── deploy/              # docker-compose、nginx、Dockerfile（待创建）
```

## 下一步

1. 确认 [`docs/项目前期规划.md` §15](docs/项目前期规划.md#15-待确认决策) 剩下的 **D1、D4–D7、D11、D12** 决策
   （已定：D2 生活经验暂不做 · D3 SPA+构建期预渲染 · D8 后台分三步 · D9 前台免登录 + 后台 Sa-Token ·
   D10 单仓多模块 · D13 品牌主色青碧 Teal）
2. ~~确定品牌主色~~ **已定青碧 Teal**：M1 把 `theme.jcpress.css` 接进前端入口
3. 启动 **M1 工程骨架**：前后端最小可运行工程 + Docker 依赖 + 统一响应/异常 + Gson 转换器 +
   Markdown 导入器 + 主题层接入 + 移动端抽屉骨架

## 说明

- 设计基线提取自 `https://golangstar.cn/`（VuePress + VuePress Theme Hope，均为 MIT 许可），
  仅复用 token 结构与数值体系，品牌色与视觉签名将自行设计；详见规划文档 §2.7。
- **移动端是硬要求**：断点、触摸目标（≥44px）、代码块与表格的横向滚动、性能预算见规划文档 §2.8；
  所有页面按 375 / 390 / 768 / 1280 四档宽度验收。
- 仓库中不提交任何密钥；数据库口令、对象存储 AK、后台账号口令一律通过环境变量注入。
- 后端工程规范遵循《Java开发手册（黄山版）》：包结构按 **portal / admin 隔离**，
  并用 **P3C-PMD + ArchUnit** 在 CI 卡口（见规划文档 §11.4 分包架构、§11.5 符合性清单）。
