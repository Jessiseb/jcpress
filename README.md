# jcpress

> 个人网站 —— 展示个人经历与技术栈，沉淀技术分享与项目笔记。
> 当前状态：**一期前端已完结**（首页 / 频道外壳 / 视觉语言，见 `docs/dev-journal.md` 阶段 1–14）；
> **二期视觉修订已完结并归档**（`openspec/changes/archive/2026-10-01-phase-2-r3/`）；
> **三期（技术分享模块）后端 + 前台/后台 UI 已完结**（分支 `feat/phase-3-tech-module`）：
> Spring Boot 后端（公开读接口 + 后台写平面 + Markdown 导入器）、`/tech` 列表与详情页、
> `/admin` 登录与写入口、文章专用字体子集。
> 效果与验收见 [`docs/phase3-effect-matrix.md`](docs/phase3-effect-matrix.md)。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite 6 + React Router 6 + TanStack Query 5；**构建期预渲染**（SEO）；**移动端优先适配** |
| 后端 | **Java 17** + Spring Boot 3.3.4 + MyBatis-Plus + **Gson** + **Sa-Token 1.44.0**（仅后台登录用） |
| 存储 | MySQL 8（内容 + 后台账号） · Redis 7（Sa-Token 会话 / 缓存 / 限流 / 浏览量去重） |
| 部署 | Docker Compose（Nginx + Backend + MySQL + Redis） |

> ⚠️ **JDK 基线是 17**。本机 `JAVA_HOME` 常指向其它版本，跑后端命令前先
> `export JAVA_HOME=<jdk-17>`，否则 `./mvnw` 会以错误版本启动。

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

## 验收怎么跑

**权威清单**：[`docs/phase3-effect-matrix.md`](docs/phase3-effect-matrix.md)（三期，**当前**）
与 [`docs/phase2-effect-matrix.md`](docs/phase2-effect-matrix.md)（二期，视觉修订）。
两者都是「评估集」：每条效果的判据 + 复核命令 + 实测结果。

### 后端

```bash
# 前置：JDK 17（本机 JAVA_HOME 常指向 8/21，必须显式指定）
export JAVA_HOME="<path-to-jdk-17>"

cd backend
./mvnw -q -B test                          # 全量测试：111 run / 0 fail / 0 error
./mvnw -q -DskipTests compile              # 只编译
./mvnw -q spring-boot:run                  # 起服务（默认 8080）
curl -s http://127.0.0.1:8080/api/health   # 期望 code=0 且 db=UP、redis=UP

# Markdown 导入器（CLI，非 web 模式；--dry-run 只打印将处理的清单）
./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer -Dspring-boot.run.arguments="--dry-run"
```

需要 MySQL 8 与 Redis ≥6.0 在跑（Sa-Token 会话依赖 Redis）。

### 前端

```bash
# 前置：dev server 必须在 5173 上跑着（截图与浏览器断言里的 URL 是硬编码的）
cd frontend && npm run dev

# 类型检查（本机可用）
cd frontend && npx tsc --noEmit

# 浏览器行为断言：二期 71 项 + 三期专项 12 项 = 82 项
node .tmp/tools/audit-behavior.cjs

# 对比度审计（4 条路由 × 亮/暗 = 8 组合，未达标必须为 0）
node .tmp/tools/audit-contrast.cjs

# 天体分节停靠（8 scene，每场「压字 0 处」）
node .tmp/tools/probe-docking.cjs

# 首屏资源归属 + 体积（三期 V10）
node .tmp/tools/audit-firstscreen.cjs        # 首屏不含编辑器/Markdown/文章字体
node .tmp/tools/audit-firstscreen-prod.cjs   # 首屏 gzip 生产口径（判据 ≤200KB）

# 四视口截图 + 横向溢出（1280 / 768 / 390 / 375）
node .tmp/tools/shot-final.cjs .tmp/shots-p3
```

> ⚠️ **`vitest run` 与 `vite build` 在本机跑不动**：EDR 拦截 esbuild 子进程读文件
> （`winapi error #5`）。两者都失败在**启动/配置加载阶段**，测试代码与业务代码本身没问题。
> 替代覆盖：`tsc --noEmit` + `audit-behavior.cjs` 的浏览器实测 + 对比度审计 +
> `audit-firstscreen-prod.cjs`（零子进程，用 `esbuild-wasm` 直接算生产体积）。
> **换到没有 EDR 拦截的机器上，`vitest run` / `vite build` 应回归。**
> 详情见 `docs/phase3-effect-matrix.md` 的「构建口子的说明」。

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
| 500·article | `frontend/public/fonts/serif-sc-article-500.woff2` | GB2312 一级字（`.tmp/fonts/chars-article.txt`） | 825KB / 4601 字 | **三期新增**：技术文章正文，独立 family `JCPress Serif SC Article` |
| 700·article | `frontend/public/fonts/serif-sc-article-700.woff2` | 同上 | 840KB / 4601 字 | **三期新增**：文章内标题 |

> **文章字体只在详情页下载**：`fonts-article.css` 由 `/tech/:slug` 路由的懒加载 chunk 引用，
> 首页与 `/tech` 列表**不请求**这两个文件（`audit-firstscreen.cjs` 有反向断言守住这条）。
> `@font-face` 只是声明、不触发下载，所以判据看的是**运行时请求**而非 CSS 文本归属。

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

## 仓库结构

```text
jcpress/
├── docs/                # 前期规划、决策记录、效果矩阵、开发留痕
├── design-system/       # 设计 token、提取产物与溯源说明
├── content/             # Markdown 源文件（技术文章 / 项目笔记），供导入器灌库
├── frontend/            # React SPA，含 /admin 后台路由（三期已实现写入口）
├── backend/             # Spring Boot 应用（三期已实现公开读 + 后台写 + 导入器）
├── openspec/            # OpenSpec 变更与归档（每个变更一份 tasks/specs）
└── deploy/              # docker-compose、nginx、Dockerfile（待创建）
```

## 下一步

1. 确认 [`docs/项目前期规划.md` §15](docs/项目前期规划.md#15-待确认决策) 剩下的 **D1、D4–D7、D11、D12** 决策
   （已定：D2 生活经验暂不做 · D3 SPA+构建期预渲染 · D8 后台分三步 · D9 前台免登录 + 后台 Sa-Token ·
   D10 单仓多模块 · D13 品牌主色青碧 Teal）
2. **三期收尾**：归档 `openspec/changes/phase-3-tech-module/`（6.1 集成验收与 6.2 文档同步已完成）
3. 规划中尚未启动的部分：算法笔记 `/algo`、项目笔记 `/projects`、搜索、
   Docker 部署与预渲染流水线（见规划文档里程碑 M4/M6）

## 说明

- 设计基线提取自 `https://golangstar.cn/`（VuePress + VuePress Theme Hope，均为 MIT 许可），
  仅复用 token 结构与数值体系，品牌色与视觉签名将自行设计；详见规划文档 §2.7。
- **移动端是硬要求**：断点、触摸目标（≥44px）、代码块与表格的横向滚动、性能预算见规划文档 §2.8；
  所有页面按 375 / 390 / 768 / 1280 四档宽度验收。
- 仓库中不提交任何密钥；数据库口令、对象存储 AK、后台账号口令一律通过环境变量注入。
- 后端工程规范遵循《Java开发手册（黄山版）》：包结构按 **portal / admin 隔离**，
  并用 **P3C-PMD + ArchUnit** 在 CI 卡口（见规划文档 §11.4 分包架构、§11.5 符合性清单）。
