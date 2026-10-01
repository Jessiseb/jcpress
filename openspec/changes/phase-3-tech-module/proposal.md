# Proposal

## Why

技术分享目前是**只有壳、没有内容**的：`/tech` 列表读的是前端常量（5 篇占位文案），列表项**故意不给链接**（因为没有详情页，给了就是死链），后台**完全不存在** —— 也就是说站主现在没有任何办法把一篇真文章发上站。

三期把这条链路打通：文章进数据库、后台能写、前台能点开读。它同时是后端工程（模板移植、分层、卡口）的**第一次落地** —— 规划文档 §11.4 与 `Agent.md` 里的编码约定到目前为止**没有任何东西守**（`decisions.md` #100 自己承认了这一点）。

## What Changes

- **后端工程从零建立**：以官方模板 `springboot-init` 为骨架，升级到 **Spring Boot 3.3.4 / Java 17**，改造成规划 §11.4 的 `com.jcpress` 分层（`common / infrastructure / domain / repository / manager / service / web.portal / web.admin / importer`）；Jackson 换 **Gson**；接入 **Sa-Token 1.44.0**（本机 Redis 5.0.14 不支持 1.46.0 的 `SET ... KEEPTTL`，逐版本开 jar 验证后锁版）；Flyway 落 §6 的 DDL。
- **技术分享读路径**：公开列表（只含已发布、不含正文、分页）、详情（Markdown 原文 + 元信息 + **内联相邻篇**）、浏览量（Redis 按 ip+ua 按天去重，定时回写）、分类与标签（含已发布计数）。
  - **BREAKING（对现有前端契约）**：列表数据源由前端常量改为 `/api/v1/articles`；`ArticleVO` 形状改为后端 VO（**ID 变为字符串**、分类变为 `categoryName/categorySlug`、新增封面与浏览量）。
  - 规划 §9.2 的 `GET /articles/{slug}/adjacent` **本期不实现**（相邻篇内联进详情响应，少一次往返）；公开列表**不做 keyword 搜索**。
- **后台写平面**（`/api/v1/admin/**`，Sa-Token 拦截）：登录/登出/当前账号、文章列表（**含草稿**、可筛状态/分类/关键词）、新建、更新、发布与撤回（状态迁移用路径后缀）、删除、**图片上传**（本地存储 + 扩展名白名单 + magic bytes + 路径穿越防护）。所有写操作在**同一事务**内写 `admin_audit_log`；登录带失败锁定（5 次 / 15 分钟）与限流。
- **Markdown 导入器 CLI**（不暴露 HTTP）：`--import=<dir> [--dry-run]`，按 `(type, slug)` 幂等 upsert、**不删除已发布内容**、front-matter 校验失败**整批回滚**。
- **前台三处页面**：`/tech` 列表改版为**卡片博客风**（头版通栏 + 字体封面：无图时用品牌渐变 + 衬线首字）、新增 `/tech/:slug` **护眼阅读详情页**（正文 17px / 行高 1.9 / 栏宽 68ch / 章节自动编号 / 代码块复制 / 右侧目录 / 上下篇）、首页新增「最新技术分享」区块。
- **后台写入口 UI**（`/admin/login`、`/admin/articles`、`/admin/articles/:id`）：CodeMirror 6 编辑器 + 实时预览 + 粘贴上传；**与公开站视觉隔离**，不进 sitemap、`robots.txt` 禁收录。
- **架构规则变成可执行判据**：ArchUnit + 源码扫描把 `Agent.md` 的规则（分层方向、portal/admin 隔离、禁字段注入、Lombok 白名单、方法动词前缀、禁 `QueryWrapper`、只用 GET/POST、方法级 `@RequestMapping` 必须声明 `method`）落成测试，CI 违规即失败。
- **文档基线修正**：`docs/项目前期规划.md` 与 `README.md` 的 Java 21 → **17**；Sa-Token 版本与 Redis 约束、上传 URL 前缀、`slug` 不能从中文标题生成 —— 这几处实现期发现的口径偏差回写规划文档与 `decisions.md`。

## Capabilities

### New Capabilities

- `tech-article-detail`: 文章详情页 —— 详情数据契约（Markdown 原文 + 元信息 + 内联相邻篇）、只暴露已发布、**护眼阅读版式**（字号/行高/栏宽/段距的可判定档位）、章节自动编号与标题锚点、代码块可复制与横向滚动、右侧目录与滚动联动、窄屏目录折叠。
- `tech-article-admin`: 后台文章写平面 —— 列表含草稿、新建/更新/发布撤回/删除的状态机与约束（slug 唯一、发布写 `publish_time`、撤回不改 `publish_time`、删除级联清正文与标签关系）、标签按名字解析或创建、`admin_audit_log` 审计、图片上传的安全约束（白名单 + magic bytes + 大小上限 + 重命名 + 防路径穿越）。
- `admin-auth`: 后台认证 —— 账号口令用 BCrypt 存哈希、登录签发 token（`jcpress-token`）、失败 5 次 / 15 分钟锁定、登录接口按 IP 限流、未登录与 token 失效分别返回 40101 / 40102 且 HTTP 状态码同为 401、登出与当前账号接口、会话落 Redis（**不得把业务实体塞进 SaSession**）。
- `markdown-importer`: Markdown 导入器 —— front-matter 约定与必填校验、按 `(type, slug)` 幂等、**永不删除**已发布内容、`--dry-run` 不写库、**校验失败整批回滚**（先全量解析校验再单事务落库）、失败信息带文件名。

### Modified Capabilities

- `tech-article-list`: 列表数据源由前端常量改为公开接口；**删除「无详情页时不给死链」这条**（详情页已实现，列表项现在**必须**可点进详情）；列表项由「日期/标题/分类/阅读」四列行改为**卡片**（封面、分类胶囊、标题、摘要、档案行）并给出三态（加载 / 错误 / 空）；空态不再说「内容尚未接通」；`size` 上限 20 与「还有 N 篇」提示。
- `homepage`: 区块顺序新增「最新技术分享」（排在项目经历之后、技术栈之前），并把「面板只给三类区块」这条的判定**显式写清新区块不在此列**（新区块保持通栏、不使用面板底色或投影 —— 与 `visual-language` 的克制一致，「卡片博客风」的破例范围只在 `/tech` 与详情页）。
- `visual-language`: 中文展示字由「一套字体文件」改为「**按页面两套**」—— 静态页沿用从渲染 DOM 收集的子集（531 字），文章页（`/tech/:slug`）使用**独立的扩展子集**（GB2312 一级字 3755 字，独立 `font-family`，只在该路由下载）；相应地把「展示字字符集 SHALL 被 700 档文件完整覆盖」限定为**被该页面所使用的那一套 700 档覆盖**，并保持「同一行标题不得混用两档字重」。

## Impact

**新增代码**：`backend/`（全新 Spring Boot 工程，约 60 个类 + 4 个 XML + 2 个 Flyway 迁移）、`frontend/src/api/`、`frontend/src/components/markdown/`、`frontend/src/pages/tech/ArticleDetailPage.tsx`、`frontend/src/pages/admin/*`、`frontend/src/components/home/LatestArticles.tsx`、`content/tech/*.md`。

**改动的现有代码**：`frontend/src/pages/tech/TechListPage.tsx`（重写）、`frontend/src/hooks/useArticles.ts`（改真接口）、`frontend/src/App.tsx`（三条新路由 + 懒加载）、`frontend/src/pages/home/HomePage.tsx`（插入区块）、`frontend/src/components/visual/CelestialField.module.css`（**补 scene 4/7 停靠** —— 首页从 7 个区块变 8 个）、各首页区块的 `data-rhythm`（保持 M/m 交替）、`frontend/vite.config.ts`（`/api` proxy）、`frontend/src/styles/theme.jcpress.css`（文章字体 family + 5 个语法色 token）、`frontend/package.json`（字体子集脚本）。

**删除**：`frontend/src/data/articles.ts` 与其测试（mock 数据源）。

**依赖**：后端新增 Sa-Token、MyBatis-Plus(SB3)、Flyway、Gson、knife4j-openapi3、spring-security-crypto、ArchUnit；前端新增 `react-markdown` / `remark-gfm` / `rehype-highlight` / `rehype-slug` / `highlight.js` / `codemirror` / `@codemirror/lang-markdown` / `@codemirror/view`（**全部路由级懒加载**，首屏预算 200KB 不变）。

**数据库**：新增 7 张表（`article` / `article_content` / `category` / `tag` / `article_tag` / `admin_user` / `admin_audit_log`）；seed 为 4 个分类、6 个标签、1 篇真实已发布文、5 篇草稿（原占位文案不直接发布）、1 个后台账号。

**不在本期范围**：`/api/v1/search` 全文搜索接口、分类与标签的**筛选 UI**、对象存储与 CDN、构建期预渲染（详情页 SEO 降级为客户端渲染，留下一期）、部署（docker-compose）、算法笔记与项目笔记频道、生活经验频道。
