# Tasks

> 每个任务完成后**立即**：跑该项的验证 → 在 `docs/dev-journal.md` 追加留痕（关键原话 / 关键产出 / 纠偏 / 翻车与返工）→ commit。留痕不集中到最后补。
> 详细到「步」的实现说明在 `docs/plan-tech-module*.md` 四份计划里，本清单是可按勾的骨架。

## 1. W1 后端骨架与规约卡口

- [x] 1.1 建立 `backend/` 工程骨架（pom 升到 Spring Boot 3.3.4 / Java 17、删 ES/COS/微信/Excel/session/knife4j-openapi2、启动类不 exclude Redis、复制 mvnw），验证 `JAVA_HOME=<jdk-17> mvn -q -DskipTests compile` 退出码为 0
- [x] 1.2 实现统一响应体与全局异常映射（`Result{code,message,data,traceId}`、`ErrorCodeEnum` 自带 HTTP 状态、`TraceIdFilter`），验证 `ResultContractTest` 全绿且「HTTP 状态码与业务码同时正确」
- [x] 1.3 用 Gson 取代 Jackson（`LongToStringAdapter` / `LocalDateTimeAdapter` / `LocalDateAdapter`、`serializeNulls`、转换器插到第 0 位、Jackson 保留在 classpath），验证 `GsonContractTest` 三条断言（Long 字符串化 / 时间格式 / null 字段）全绿
- [x] 1.4 接入数据源 + MyBatis-Plus + Flyway 并落规划 §6 的 7 张表（**不配置** `logic-delete-field`），验证 `FlywayMigrationTest` 全绿且 ngram 全文索引可被 `MATCH ... AGAINST` 查询
- [x] 1.5 接入 Redis 与 Sa-Token 1.44.0，并**先跑运行时探针**（登录 → 写 Redis → 读回 → 续期 → 登出），验证 `SaTokenRedisTest` 全绿；若失败则按 design D-D 的备选改自研 `SaTokenDao` 并把结论回写 `docs/decisions.md` —— **实测通过，备选不需要**（见 decisions #106）
- [x] 1.6 实现分页查询对象（`size` 服务端限幅 50）与 `HealthService` 分层骨架（接口 + impl、构造器注入），验证 `PageQueryTest` 全绿
- [x] 1.7 把 `Agent.md` 与规划 §11.4 的规则落成卡口：ArchUnit 12 条（分层方向、portal/admin 互斥、禁字段注入、动词前缀、禁 `QueryWrapper`、只用 GET/POST、方法级 `@RequestMapping` 须声明 method）+ 源码文本扫描（Lombok 白名单、`RequestMethod.PUT/PATCH/DELETE`），验证 `mvn -q test -Dtest='ArchitectureTest,SourceConventionTest'` 全绿，并**做一次反向验证**证明卡口真的会红（见 decisions #101）
- [x] 1.8 实现 `/api/health` 探活接口（含 DB 与 Redis），验证 MockMvc 契约测试全绿，且真启动一次后 `curl /api/health` 返回 `code=0` 与 `db=UP`、`redis=UP`
- [x] 1.9 W1 出口复核：验证 `compile` + `mvn test`（全量）+ 冒烟三条全绿，并在 `docs/dev-journal.md` 追加 W1 留痕后提交

## 2. W2 技术分享领域与公开接口

- [x] 2.1 建立领域模型（DO / 行投影 / `ArticleQuery` / VO / 显式转换器），验证 `ArticleConverterTest` 全绿且 `ArticleCardVO` 上不存在 `status`、`gmtModified`、`contentMd` 字段
- [x] 2.2 写 Mapper 与 XML 自写 SQL（公开列表含分类联表、按 slug 取已发布、相邻篇两条、浏览量增量回写、标签批量取），验证 `ArticleMapperTest` 五条全绿（草稿不可见、倒序、相邻篇方向正确、增量可累加）
- [x] 2.3 实现 `ArticleService` 公开读路径（列表含批量标签避免 N+1、详情内联相邻篇、找不到抛 40401、`size` 限幅），验证 `ArticleServiceTest` 全绿
- [x] 2.4 实现分类与标签服务（含已发布计数、空 scope 回退 TECH），验证 `CategoryServiceTest` 全绿且无已发布文章的分类仍以计数 0 出现
- [x] 2.5 实现浏览量 Manager（Redis `SADD` 去重 + `INCR` 计数 + `SCAN` + `RENAME` 定时回写，**禁用 GETDEL**），验证 `ArticleViewManagerTest` 三条全绿（同指纹只计一次 / 不同指纹累加 / 回写落库并清键）
- [x] 2.6 实现公开接口（`GET /v1/articles`、`GET /v1/articles/{slug}`、`POST /v1/articles/{slug}/view`、`GET /v1/categories`、`GET /v1/tags`），验证 `ArticleControllerTest` 全绿且响应体为统一形状与分页结构
- [x] 2.7 写 `V2__seed_data.sql`（4 分类 / 6 标签 / 1 篇真实已发布文 / 5 篇草稿含提纲正文 / 后台账号 BCrypt）并补写那篇真实正文（覆盖标题、列表、表格、行内代码、围栏代码块、引用），验证 `SeedDataTest` 全绿（已发布恰好 1 篇、草稿 5 篇、哈希以 `$2a$` 开头）
- [x] 2.8 W2 出口复核：逐个手测五个公开接口（列表只 1 条、id 为字符串、时间为 `yyyy-MM-dd HH:mm:ss`），在 `docs/dev-journal.md` 追加 W2 留痕后提交

## 3. W3 后台写平面

- [x] 3.1 实现纯工具 `SlugUtils` 与 `WordCountUtils`（中文标题返回 null 不猜拼音、格式校验、剥离 Markdown 语法后计数、400 字/分钟），验证 `SlugUtilsTest` 与 `WordCountUtilsTest` 全绿
- [x] 3.2 建立后台账号与审计的模型层（DO / Mapper + XML / DTO / VO / 常量），验证 `mvn -q -DskipTests compile` 通过且 `AdminUserVO` 不含口令哈希字段
- [x] 3.3 实现登录服务（BCrypt 校验、失败 5 次 / 15 分钟锁定、登录按 IP 限流、成功后清计数、审计同事务）与 `RateLimitManager`，验证 `AdminAuthServiceTest` 三条**失败路径**全绿（成功路径改由 MockMvc 覆盖，见 design D-E）
- [x] 3.4 实现后台认证接口并把 Sa-Token 未登录异常翻译成 401（40101 / 40102 两个口径、HTTP 401），验证 `AdminAuthControllerTest` 四条全绿（无 token 40101 / 伪造 token 40102 / 登录后 me 正常 / 成功登录清空失败计数）
- [x] 3.5 实现图片上传（本地存储 + 扩展名白名单 + magic bytes + 大小上限 + 重命名 + 路径穿越防护 + **对外 URL 与资源映射路径分开配置**），验证 `LocalFileStorageTest` 五条全绿，且上传后访问返回的 URL 能取到图片
- [x] 3.6 实现后台文章写服务（列表含草稿、新建 / 更新 / 发布撤回 / 删除、标签解析或创建、字数重算、审计同事务、slug 冲突 40901），验证 `AdminArticleServiceTest` 五条全绿（含删除不留孤立正文与标签关系）
- [x] 3.7 实现后台文章接口（列表含草稿且关键词走全文索引、不足 2 字回退前缀匹配、详情含正文、新建 / 更新 / 发布 / 删除全走 POST），验证 `AdminArticleControllerTest` 三条全绿（未登录 401 / 列表含草稿 / 新建→发布→公开列表可见）
- [x] 3.8 W3 出口复核：手工走一遍「登录 → 看草稿 → 改标题 → 发布 → 前台可见」并用 SQL 核对 `admin_audit_log` 里有 LOGIN/CREATE/UPDATE 记录，在 `docs/dev-journal.md` 追加 W3 留痕后提交

## 4. W5 Markdown 导入器

- [x] 4.1 实现 front-matter 解析与校验（SnakeYAML，无新增依赖；title/slug/category 必填、slug 格式、status 枚举），验证「缺 front-matter」「分类不存在」「空目录」三种失败都带文件名或明确原因
- [x] 4.2 实现导入器主流程（两段式：先全量解析校验、再单事务落库；按「类型 + slug」幂等；永不删除已发布内容；已发布但缺时间时兜底为导入时刻），验证 `MarkdownImporterTest` 四条全绿（首次新增 / 再次更新 / 坏文件整批不写 / 空目录报错）
- [x] 4.3 实现 CLI 入口与 `application-importer.yml`（非 web 模式、无 HTTP 端点、无参数则静默退出）、写 `content/tech/*.md` 仓库源，验证 `--dry-run` 打印将处理清单且库不变、真导入报告「新增 0 / 更新 1」
- [x] 4.4 W5 出口复核：在 `docs/dev-journal.md` 追加 W5 留痕（含导入器实测输出）后提交

## 5. W4 前台与后台 UI

- [x] 5.1 实现 API 客户端与类型（统一拆信封、`ApiError` 携带业务码与 HTTP 状态、token 走 sessionStorage、401 自动清 token、无 token 的鉴权请求直接拒），验证 `client.test.ts` 五条全绿
- [x] 5.2 数据接入替换 mock（`useArticles` 等四个 hook 走真接口、删除 `data/articles.ts`、加 vite `/api` proxy），验证 `npx tsc --noEmit` 在 W4 后续任务完成后通过
- [x] 5.3 实现 Markdown 正文管线（GFM + 锚点 + 高亮 + 复制按钮 + 表格横向滚动、TOC 收集插件不引 `unist-util-visit`），验证 `MarkdownBody.test.tsx` 三条全绿（含「TOC 锚点与渲染出的 id 一一对应」）
- [x] 5.4 实现 `/tech` 卡片列表（头版通栏、字体封面、三态齐全、加载失败显示错误而非空态），验证 `TechListPage.test.tsx` 三条全绿且肉眼可见卡片可点进详情
- [x] 5.5 实现 `/tech/:slug` 详情页（护眼档位 17px/1.9/68ch、章节自动编号、代码复制、右侧目录 + 窄屏折叠、上下篇、路由级懒加载），验证 `ArticleDetailPage.test.tsx` 全绿且 `npx tsc --noEmit` 通过
- [x] 5.6 实现首页「最新技术分享」区块（**通栏行式列表，不用卡片**；带 `aria-labelledby` 与 `data-block`），把首页从 7 个区块改为 8 个，验证行为断言中「区块数 = 8」与「3 个条目都指向详情」通过
- [x] 5.7 补 `CelestialField` 的 scene 4 与 scene 7 停靠规则并重排 `data-rhythm`（保持 M/m 交替），验证 `probe-docking.cjs` 在 8 个 scene 上全部报「压字 0 处」，且实测矩形已写进 CSS 注释
- [x] 5.8 实现后台写入口（登录页 + 文章列表 + 编辑页 + `RequireAdmin` 守卫 + CodeMirror 6 编辑器与粘贴上传，与公开站视觉隔离，`robots.txt` 禁收录 `/admin`），验证 `AdminArticleEditPage.test.tsx` 全绿且手工走通「改标题 → 保存 → 发布 → 前台刷新可见」
- [x] 5.9 生成文章页专用字体子集（GB2312 一级字 3755、两档、独立 `font-family`、只在详情页 chunk 被引用），验证 `audit-display-font.cjs` 在含 `/tech/:slug` 的路由集合上全绿，且首屏构建产物中不含该字体文件
- [x] 5.10 建立验收评估集 `docs/phase3-effect-matrix.md` 并扩展工具（对比度审计参数化到四条路由、行为断言加三期 section、截图加三条路由），验证矩阵中每条「实测」列都填了真实数字且无「已知问题」遗留
- [x] 5.11 W4 出口复核：跑通评估集的一键复跑六条命令，完成 9 项手工验收清单，在 `docs/dev-journal.md` 追加 W4 留痕后提交

## 6. 集成收尾

- [x] 6.1 全链路集成验收：按 `docs/phase3-effect-matrix.md` 从零复跑（前端测试 + 后端测试 + 四条路由的对比度与截图 + 停靠探针 + 构建产物体积核对），确认首屏 chunk 不含编辑器/Markdown/文章字体且首屏 gzip ≤200KB
- [ ] 6.2 文档同步：把 Java 21→17、Sa-Token 1.44.0 与 Redis 约束、上传 URL 双前缀、slug 不支持中文生成、详情页预渲染回退这五处口径回写 `docs/项目前期规划.md` 与 `README.md`，验证两处文档中不再出现「Java 21」且 README 的验收章节含后端命令
