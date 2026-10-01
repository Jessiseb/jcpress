# Design

## Context

**当前状态**：一期（首页 + 频道外壳 + 视觉语言）与二期（三轮视觉修订）已完结并归档，站上**只有前端**，数据全是 `frontend/src/data/*.ts` 里的常量；`/tech` 是一个"故意不给链接"的列表壳。后端工程**不存在**。

**约束**（都已在仓库里写死，本设计不重新论证）：

- `Agent.md`：Controller→Service→DAO 分层；Service 禁 `QueryWrapper`；只用 GET/POST；禁 `@Autowired` 字段注入；Lombok 仅 `@Data/@Getter/@Setter/@Slf4j`；方法名动词前缀；异常不得吞没、不得向前端吐堆栈。
- `docs/项目前期规划.md`：§6 的 DDL 是数据库唯一源；§9 的 API 契约与错误码分段；§11.4 的包结构与依赖方向；§10.5 的后台安全清单。
- `openspec/specs/`：`homepage`（含"面板只给三类区块"与区块顺序）、`visual-language`（含字体真字重、对比度、首屏预算、天体停靠）、`tech-article-list`、`site-shell`。
- **本机环境（实测，不是推测）**：Java 17（`C:\Program Files\Java\jdk-17`）· Maven 3.6.3（默认挂 Java 8，需显式 `JAVA_HOME`）· MySQL 8.0.36（root/123456）· **Redis 5.0.14.1**（无密码）· **Docker Desktop 未运行**（Testcontainers 不可用）· 后端 dev server 需自建（`127.0.0.1:8080`），前端 dev server 在 `5173` 常驻。

**长版决策记录**：[`docs/design-tech-module.md`](../../../docs/design-tech-module.md)（D1–D11，含每条决策的备选与实测证据）。本文件只写**实现级**的架构决定与取舍，不重复那份文档的内容。

## Goals / Non-Goals

**Goals:**

- 「技术分享」端到端可用：后台能增/改/删/发布，前台能从首页与 `/tech` 点进详情并以护眼版式阅读。
- 把 `Agent.md` 与规划 §11.4 的架构规则**变成可执行判据**（ArchUnit + 源码扫描），使"文档写了但没人守"这条遗留（`decisions.md` #100）在本期关闭。
- 后端工程成为后续频道（算法笔记、项目笔记）的**可复制骨架**：新增一个 `type` 不需要动分层与卡口。

**Non-Goals（设计层面的边界，不是范围复述）:**

- 不做多实例部署下的强一致（浏览量回写用 Redis 计数 + 定时刷库，多实例需换 Lua；本期单实例）。
- 不做读写分离、不做二级缓存（公开列表直接查库；本期数据量在千级）。
- 不为后台引入前端框架/组件库（后台 UI 用原生 + 现有 token，与公开站**视觉隔离**但不引第二套设计系统）。
- 不做 SEO 的构建期预渲染（详情页内容在库里，构建期取不到；见 Open Questions）。

## Decisions

### D-A 分层与依赖方向：包边界画在未来的模块边界上

单 Maven 模块 + `com.jcpress` 包隔离（`common / infrastructure / domain / repository / manager / service / web.portal / web.admin / importer`），依赖单向：`web.* → service → manager → repository → domain.dataobject`。

**为什么不用多模块**：单人开发、单进程部署，多模块的构建复杂度换不来收益；但包边界**刻意画在模块边界上**，将来拆分是"平移目录"。**替代方案**（已否）：按功能分包（`article/` 下自带 controller+service+mapper）—— 它会让 portal 与 admin 混在同一功能包里，`Agent.md` 与 §11.4 的隔离要求就无法用 ArchUnit 表达。

### D-B 数据访问约定：主键走继承方法，条件查询一律 XML

- 主键读写用 MyBatis-Plus 继承方法（`selectById` / `insert` / `updateById` / `deleteById`）。
- **任何带条件、联表、排序、分页的查询写在 Mapper XML**。

**为什么**：`Agent.md` 禁止 Service 层出现 `QueryWrapper`，而本期的列表/详情/相邻篇/计数/后台筛选全是条件查询。把 `QueryWrapper` 放进 Mapper 的 default 方法里也能过卡口，但会让 SQL 藏在 Java 里、且动态条件（`<if>`）表达力更差。XML 还有一个副产品：`EXPLAIN` 验证过的计划能原样对照（见 `docs/design-tech-module.md` §6）。

**替代方案**（已否）：Service 里用 `LambdaQueryWrapper`（直接违反 `Agent.md`）；全部用注解 `@Select`（动态条件要写 `<script>`，比 XML 更难读）。

### D-C JSON：Gson 放 `converters[0]`，Jackson 留在 classpath

`GsonHttpMessageConverter` 注册在转换器链第 0 位覆盖 Spring 默认 Jackson；但**不把 Jackson 从 classpath 摘掉** —— Sa-Token 的 starter 自带 `sa-token-jackson` 只服务它自己的会话序列化。

三个必须自建适配器：`Long` → 字符串（JS 大整数精度）、`LocalDateTime` → `yyyy-MM-dd HH:mm:ss`、`LocalDate` → `yyyy-MM-dd`；并开启 `serializeNulls`（前端类型稳定性）。

**代价**：Jackson 注解（`@JsonProperty`/`@JsonFormat`）在本项目**全部失效**，DTO 需要非默认命名时用 `@SerializedName`。这条写进 design 以免后来者踩。

### D-D Sa-Token 版本锁 1.44.0（由本机 Redis 决定）

`sa-token-redis-template` 1.46.0 使用 `SET ... KEEPTTL`（Redis ≥ 6.0），本机是 5.0.14.1。**逐版本打开 jar 验证**：1.46.0 常量池里有 `KEEPTTL`，1.44.0 / 1.42.0 没有 → 锁 1.44.0。

**替代方案**（已否）：升级本机 Redis（Windows 侧要引入第三方移植版或 Docker，而 Docker 当前不可用）；自研 `SaTokenDao`（多写 60 行基础设施代码去绕一个版本问题）。

**同类约束**：实现中**不得使用 `GETDEL`**（Redis 6.2+）。浏览量待回写键的取值用 `RENAME` + 读 + 删（`RENAME` 自 Redis 1.0 起就有且原子）。

### D-E 测试策略：本地库 + 不测非 web 上下文

Docker 未运行 → **不用 Testcontainers**，改用本机专用库 `jcpress_test` + Redis `db 15`（独立 `application-test.yml`，Flyway 建表）。Testcontainers 仅作为将来 CI 的占位说明，不实现。

**关键约束**：Sa-Token 的 `StpUtil.login()` 需要 **web 请求级上下文**，在非 web 的 `@SpringBootTest` 里会抛 `SaTokenContextException`。因此：

- 失败/锁定/限流等**发生在 `StpUtil.login` 之前**的分支 → 用 `@SpringBootTest` 直接测 Service（真 Redis）。
- 登录成功、发 token、`/me` 回显、401 口径 → 一律走 **MockMvc 真实链路**。

**架构规则用两种手段**：ArchUnit 查注解与类型（分层、字段注入、`QueryWrapper` 依赖、HTTP 方法注解）；**源码文本扫描**查 ArchUnit 看不到的两类 —— Lombok 注解（`SOURCE` 保留级，不进字节码）与 `RequestMethod.PUT/PATCH/DELETE` 字符串。方法级 "裸 `@RequestMapping`" 由 ArchUnit 查（**不能用正则**：正则分不清类级/方法级，会误伤 `@RequestMapping("/v1/articles")` 这种标准写法）。

### D-F 验收：可单测的照走 TDD，视觉的走评估集

用户要求"产出不是可单测代码的任务，把 TDD 那步换成拿标注样例或评估集跑一遍验证"：

- 可单测（先写测试）：slug 唯一与生成、发布撤回状态机、浏览量去重幂等、草稿不出现在公开接口、删除级联、导入器幂等与整批回滚、BCrypt 登录与失败锁定、错误码映射、字数与阅读时长估算。
- 接口层：MockMvc（401/400/404/409 + 统一响应体形状 + 分页结构）。
- **不可单测的视觉/页面**：`docs/phase3-effect-matrix.md` 作评估集（每条 = 判据 + 复核命令 + 实测结果），复用并扩展二期的 `.tmp/tools`：多路由对比度审计、行为断言、四视口截图，并**新增停靠探针**（首页从 7 个区块变 8 个，`CelestialField` 的 `[data-scene]` 表必须同步）。

### D-G 前端：同源 `/api` + 路由级懒加载 + 两套字体

- dev 走 **vite proxy `/api` → `127.0.0.1:8080`**，与生产的 Nginx 同源策略一致 —— CORS 从根上不存在。
- 详情页、`/admin` 三条路由**全部懒加载**；Markdown 渲染管线与 CodeMirror 只进各自 chunk。首屏预算（`visual-language`：≤200KB gzip）不变。
- **字体按页面分两套 `font-family`**：静态页沿用 531 字子集；文章页用 GB2312 一级字（3755 字）扩展子集、独立 family 名、只在该路由被引用。**为什么必须两套**：文章正文是动态内容，静态收集的字符表不可能覆盖；用一套就会在同段内混款。独立 family 名同时避开了"同 family 两个 face 争抢同一字符"的坑。
- 卡片形态（圆角/阴影/封面）**只允许出现在 `/tech` 与详情页**；首页新区块保持通栏（`homepage` spec 的"面板只给三类区块"未放宽）。

## Risks / Trade-offs

| 风险 | 处置 |
| --- | --- |
| **Sa-Token 1.44 + Spring Boot 3.3.4 + Redis 5.0 的运行时协作**是全期唯一未被验证的高风险假设（jar 静态检查只证明没有 `KEEPTTL`） | W1 Task 5 的第一个动作就是**运行时探针**（登录 → 写 Redis → 读回 → 续期 → 登出）。探针失败即按 D-D 的备选改自研 `SaTokenDao`，并把结论回写 `decisions.md` |
| 首页多一个区块会同时动到**天体停靠表**、`data-rhythm` 交替、reveal 错峰、四视口截图与对比度基线 | 停靠探针先量再写 CSS，并把实测矩形留在 `[data-scene]` 注释里（沿用二期 #97/#98 的做法）；**不允许"只加区块不重验"** |
| 详情页**失去构建期预渲染**（内容在库里）→ SEO 回退 | 明确记为能力回退并写进 README；SSR/预渲染留下一期。**不允许**用"对爬虫返回静态壳"这类半成品掩盖 |
| 上传接口是新攻击面 | 扩展名白名单 + magic bytes + 大小上限 + 重命名落盘 + 路径穿越防护 + 只允许 POST；逐条写进 `tech-article-admin` 的 spec 与测试 |
| 新增 8 个前端依赖（二期刚立过"一期只加 1 个"的例） | 全部路由级懒加载 + 构建产物核对（首屏 chunk 不得含编辑器/Markdown/文章字体）；理由与代价记入 `decisions.md` |
| Maven 本地仓库在沙箱外不可写 / npm 缓存同理（策略可能再次变化） | 优先用工作区内 `-Dmaven.repo.local=.tmp/m2` 与 `--cache .tmp/npm-cache`；不为此改项目配置 |
| 中文标题**无法**自动生成 slug（需拼音库，未批准新增） | 改为"手填 + 拉丁字符自动 slugify + 全中文不猜、报参数错误"；已回写规划文档口径 |

## Migration Plan

本期**没有线上部署**（无生产环境、无用户数据），因此不需要"灰度 / 双写 / 回滚脚本"。落地步骤与回滚如下：

1. **建库**：`CREATE DATABASE jcpress`（dev）与 `jcpress_test`（测试），字符集 `utf8mb4` / `utf8mb4_0900_ai_ci`。Flyway 在应用启动时执行 `V1__init_schema.sql`（7 张表）与 `V2__seed_data.sql`。
2. **回滚**（本地）：`git checkout main`（或删除 `feat/phase-3-tech-module` 分支）即可回到纯前端状态；数据库侧 `DROP DATABASE jcpress` / `jcpress_test` 即可。**因为 `article` 等表在前端 mock 时代根本不存在，回滚不会丢任何真实内容。**
3. **前端切换点**：删除 `frontend/src/data/articles.ts` 后，`/tech` 必须能从接口取到数据才可用 —— 因此**后端先于前端切换**（W1→W3 完成后才做 W4）。若只回滚前端而后端留着，页面会退化成错误态（这是设计选择：**不做假数据降级**）。
4. **内容迁移**：`.tmp/probe-sql/` 下的两次探针（DDL 与查询计划）不进版本库；仓库内的 Markdown 源放在 `content/tech/*.md`，由导入器灌库，可 diff、可重跑。

## Open Questions

以下问题**不影响**本期的 spec、方案与任务拆分，因此延后决定：

1. **详情页 SEO**：是否需要 SSR / 预渲染 / 动态渲染？若需要，是引入 Node 侧渲染还是用部署层（Nginx + 预渲染服务）解决？
2. **多实例下的浏览量原子性**：当前"GET + RENAME"在单实例可接受；上多实例时是否换 Lua 脚本或直接把计数交回数据库？
3. **`/api/v1/search`**：全文索引（ngram）已建好且实测可用，何时开放公开搜索？是否需要搜索页 UI？
4. **对象存储**：`FileStorage` 接口已抽象，何时换成 OSS/COS 实现？是否需要图库与引用计数清理？
5. **分类与标签的筛选 UI**：接口已支持 `categoryId` / `tagSlug`，页面何时暴露筛选与分页控件？
