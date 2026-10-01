# 三期设计 · 技术分享模块（后端 + 后台写入口 + 前台展示）

> 状态：**已批准定稿（2026-10-02）** —— 用户原话：「**全部按推荐批准（D4-A / D6 批准 / D7-A / D5 按此）**」。
> 下一步：`writing-plans` 产出实施计划 → OpenSpec propose → 开分支实现。
> 日期：2026-10-02 · 归属：`phase-3-tech-module`
> 输入源：[Agent.md](../Agent.md)、[项目前期规划.md](项目前期规划.md)、[decisions.md](decisions.md)、[dev-journal.md](dev-journal.md) 阶段 30

---

## 0. 一页速览

| 项 | 内容 |
| --- | --- |
| 目标 | 「技术分享」端到端可用：后台能增/改/删/发布文章，前台能从首页与 `/tech` 点进文章详情，以**护眼的文章排版**阅读 |
| 技术基线 | **Java 17 + Spring Boot 3.3.4**（模板 `springboot-init` 作骨架，升级 + 删无关件）· MyBatis-Plus · **Gson** · **Sa-Token 1.44.0** · Flyway · MySQL 8 · Redis |
| 五条工作流 | **W1** 后端骨架与规约卡口 → **W2** 技术分享领域与公开接口 → **W3** 后台写平面（登录/增改删/发布/上传/审计）→ **W5** Markdown 导入器 → **W4** 前台三页 + 后台写入口 UI |
| 交付面 | 后端 1 个新工程 · 前端 5 个新页面/区块（详情页 / 首页最新文章区块 / 后台登录 / 后台文章列表 / 后台编辑页）+ 2 处改版（`/tech` 列表页、路由与首页装配）· 1 个 CLI 导入器 · 1 套 ArchUnit 卡口 · 1 份评估集 |
| 明确不做 | `/search` 全文搜索接口 · 分类/标签**筛选 UI** · 对象存储 · SSR/预渲染 · 部署（docker-compose） · 生活经验频道 |

---

## 1. 输入与约束

**用户需求原文**（四条，见 [dev-journal.md 阶段 30](dev-journal.md)）：后台增改删 · 首页点进详情 · 文章形式 + 眼睛舒服 · 用 `springboot-init` 模板 · 遵守 `Agent.md` · 技术分享页要「博客感、华丽好看、灵动」。

**硬约束**

1. `Agent.md`：Controller→Service→DAO 分层；Service 层**禁** `QueryWrapper`（复杂查询走 Mapper 自写 SQL）；**只用 GET/POST**；**禁 `@Autowired` 字段注入**（`private final` + `@RequiredArgsConstructor`）；Lombok 仅 `@Data/@Getter/@Setter/@Slf4j`；命名前缀 `get/list/count/save/remove/update`；大括号强制；异常不得吞没。
2. 规划文档 §11.4：`com.jcpress` 分包（common / infrastructure / domain / repository / manager / service / web.portal / web.admin / importer），依赖单向，portal 与 admin 互不可见。
3. 规划文档 §6：数据库 DDL 是**唯一源**（本期原样落库，除下列已注明的 5 处偏离）。
4. 一期/二期的视觉与测量纪律：文档腐坏要顺手修、**改版式必须重跑停靠探针**（#97）、装饰层遮挡不在对比度审计覆盖面内（#98）。

**与规划的偏离（本期新增，需批准）**

| # | 偏离 | 理由 |
| --- | --- | --- |
| 1 | Java 21 → **Java 17** | **用户裁定**（原话「改成 Java17 文档和项目都改成17」）；`docs/项目前期规划.md` 与 `README.md` 同步改 |
| 2 | Sa-Token 1.46.0 → **1.44.0** | 实测 1.46.0 用 `SET ... KEEPTTL`，本机 Redis 是 5.0.14.1（< 6.0）。逐版本打开 jar 验证：1.44.0 / 1.42.0 无 `KEEPTTL` |
| 3 | 文档里 `/tech` 视觉纪律「圆角 ≤8px / 面板只给两类区块」**在技术分享页破例** | 用户明确要「现代卡片博客风」。范围**仅限 `/tech` 列表页与文章详情页**，写成 decisions 显式修订，首页其它区块与全站 token 不动 |
| 4 | 相邻篇**内联进详情响应**，规划 §9.2 的 `GET /articles/{slug}/adjacent` **本期不实现**；公开列表**不做 `keyword` 搜索**（后台列表的 `keyword` 只走**前缀匹配**，遵守 §6.6「严禁左模糊/全模糊」） | 少一次往返、少一套接口；`FULLTEXT ngram` 索引本期**只建不用**（它的存在是为了让 §6 的 DDL 能原样落库，实测已生效） |
| 5 | 后台 `keyword` 搜索的**主路径改用 `MATCH(title,summary) AGAINST('kw*' IN BOOLEAN MODE)`**；仅当关键词 **< 2 字**时回退 `LIKE 'kw%'` | 实测（§6）：`LIKE 'kw%'` 在 `title` 上**无索引可用** → `type=ALL` 扫描 1940 行；ngram 全文索引走 `fulltext`。另外 `ngram_token_size=2` → **单个汉字在全文索引里命中 0**，所以必须有回退。尾随 `*` 不是左模糊/全模糊，符合 §6.6 本意 |

---

## 2. 决策 D1–D11

### D1 · 后端骨架：模板移植策略（留契约、换骨架）

模板 `springboot-init` 是 Spring Boot 2.7.2 / Java 8 的「用户中心」工程，与规划冲突。做法是**逐件处置**，不是整体照搬也不是从零重写：

| 模板件 | 处置 | 说明 |
| --- | --- | --- |
| parent `spring-boot-starter-parent` 2.7.2 / Java 8 | → **3.3.4 / 17** | |
| SB 默认 Jackson | → **Gson**（`GsonHttpMessageConverter` 放 `converters[0]`） | Jackson **保留在 classpath**：Sa-Token starter 自带 `sa-token-jackson` 仅用于其内部序列化（规划 §5.4） |
| `mybatis-spring-boot-starter` 2.2.2 | → `mybatis-plus-spring-boot3-starter` **3.5.7** | SB3 必须用专用 starter |
| `spring-boot-starter-data-elasticsearch` | **删** | 搜索用 `FULLTEXT ... WITH PARSER ngram`（已实测可用） |
| `cos_api`（腾讯对象存储） | **删** → 自建 `FileStorage` + `LocalFileStorage` | 无密钥；规划 §11.4 已留 `infrastructure/storage` |
| `wx-java-mp-spring-boot-starter` | **删** | 与本站无关 |
| `easyexcel` | **删** | 与本站无关 |
| `spring-session-data-redis` | **删** | 会话交给 Sa-Token |
| `knife4j-openapi2`（Swagger2，不支持 SB3） | → `knife4j-openapi3-jakarta-spring-boot-starter` **4.5.0** | 保留中文友好的接口文档 UI |
| `freemarker` + `CodeGenerator` | **删** | 模板代码生成器绑定它自己的包名与 ftl，本期手写更省 |
| `User` / `Post` / `PostFavour` / `PostThumb` / `WxMp*` 及其 service/mapper | **删** | 模板业务 |
| `hutool-all` | **删** | 用 JDK + `commons-lang3` 够；少一个 5MB 级依赖 |
| `spring-boot-devtools` | 留 | 本地热重载 |
| `spring-boot-starter-aop` | 留 | 审计日志切面用 |
| `common/{BaseResponse,ResultUtils,ErrorCode,PageRequest,DeleteRequest}` | **留契约、重写进 `common/result` 与 `common/exception`** | 统一响应体形状与错误码分段（§9.1）保留 |
| `exception/{BusinessException,GlobalExceptionHandler,ThrowUtils}` | 同上 | 并按 `Agent.md` 补：Service 记日志带参数、Web 层统一转换、不向前端吐堆栈 |
| `aop/AuthInterceptor` + `annotation/AuthCheck`（模板自研鉴权） | **删** | 换 Sa-Token 拦截器 |
| `aop/LogInterceptor` | 改造 | 变成审计/访问日志（`admin_audit_log` 只记写操作） |
| `config/CorsConfig` | 留 | dev 直连时用；但 dev 主路径走 vite proxy（D5） |
| `mvnw` / `.mvn` | 留 | 团队/CI 统一 Maven 版本 |

**新增依赖**：`sa-token-spring-boot3-starter` + `sa-token-redis-template`（1.44.0）、`commons-pool2`、`spring-boot-starter-validation`、`spring-boot-starter-actuator`、`flyway-core` + `flyway-mysql`、`gson`、`spring-security-crypto`（只要 `BCryptPasswordEncoder`，不引 Spring Security 框架）、`commons-lang3`、`archunit-junit5` 1.3.0（test）。

> 证据：这套依赖已用探针 pom 在本机 `dependency:resolve` 全量解析通过（BUILD SUCCESS，1:20），版本见 §6。

### D2 · 包结构与 ArchUnit 卡口

按规划 §11.4 落地；`decisions.md` #100 自己承认「`Agent.md` 那几条规则目前没有任何东西守」，本期把它们全部变成**可执行判据**（这既是质量卡口，也是本期「评估集」的一部分）：

| # | 规则 | 判据 |
| --- | --- | --- |
| 1 | portal 不得依赖 admin（反之亦然） | `noClasses().that().resideInAPackage("..web.portal..").should().dependOnClassesThat().resideInAPackage("..web.admin..")`（反向同理） |
| 2 | `web.*` 不得依赖 `repository` | 同上套路 |
| 3 | DO 不得出现在 `web..` 依赖里 | `..web.. → ..domain.dataobject..` 禁止 |
| 4 | Controller 只依赖 Service 接口 | `..web.. → ..service.impl..` 禁止 |
| 5 | `common` / `infrastructure` 不得依赖业务包 | `..common..` / `..infrastructure.. → ..domain..|..service..|..repository..` 禁止 |
| 6 | `manager` 只能被 `service` 依赖 | `..repository..|..web.. → ..manager..` 禁止 |
| 7 | **禁字段注入** | 字段上带 `@Autowired` 的类数为 0（含 `@Resource`） |
| 8 | **Lombok 白名单** | 源码中出现的 Lombok 注解 ⊆ {`Data`,`Getter`,`Setter`,`Slf4j`}（文本扫描，因 ArchUnit 看不到注解在 DO/Repository 上的组合语义） |
| 9 | **Service/DAO 方法命名前缀** | `..service..` 与 `..repository..` 的公开方法名须以 `get/list/count/save/insert/remove/delete/update` 开头（构造器、`Object` 方法除外） |
| 10 | **禁 `QueryWrapper`** | `..service..` 与 `..service.impl..` 不得依赖 `com.baomidou.mybatisplus.core.conditions.query.QueryWrapper`（含 `LambdaQueryWrapper`） |
| 11 | **只用 GET/POST** | 无 `@PutMapping` / `@PatchMapping` / `@DeleteMapping` |
| 12 | GET/POST 的两个 ArchUnit 盲区 | ① 文本扫描：`RequestMethod.(PUT\|PATCH\|DELETE)` 命中数为 0；② **裸 `@RequestMapping` 用 ArchUnit 查、且只查方法级**（`methodLevelRequestMappingMustDeclareMethod`）—— 写计划时发现原方案「用文本正则查裸 @RequestMapping」是错的：正则分不清类级与方法级，会把 `@RequestMapping("/v1/articles")` 这种标准路径前缀写法一起误伤；方法级不带 `method` 才是「对所有 HTTP 方法开放」的真风险 |

规则 7–12 是本期的**新增卡口**，前 6 条规划里已写但从未实现。

### D3 · 数据模型与 Flyway

**原样落规划 §6 的 DDL**（`admin_user` / `admin_audit_log` / `category` / `tag` / `article_tag` / `article` / `article_content`），Flyway `V1__init_schema.sql` + `V2__seed_data.sql`，只增不改。

- 时间统一 `DATETIME`，应用层 `Asia/Shanghai`；ID 以**字符串**下发（Gson `LongToStringAdapter`）
- `status`：`0` 草稿 / `1` 已发布 / `2` 归档；`publish_time` 只在 `0→1` 时写入
- `word_count` / `reading_minutes` 在保存时计算（中文按 **400 字/分钟**估算，向上取整，最小 1）
- **不做软删**（规划 §6.6：一期物理删除）；删除同时删 `article_content` 与 `article_tag`（Service 层事务内保证）
- **索引实测结论（§6 有完整证据）**：公开列表、分类筛、相邻篇三条查询都**走得上规划设计的索引**（其中「下一篇」走反向索引扫描，`rows=1`）
- **一处已知的 filesort（接受）**：首页「最新 3 篇」若按 `ORDER BY is_top DESC, publish_time DESC` 排序，`is_top` 不在任何索引里 → `Using filesort`。本期**接受**（千级数据量下代价可忽略），不加索引以免偏离 §6 的 DDL；若将来数据上万，再补 `(type, status, is_top, publish_time)`

### D4 · 内容与 seed（**待批准**）

现状：`frontend/src/data/articles.ts` 里 5 篇是**占位文案**（标题/摘要像真的，但没有正文）。处置方案：

| 方案 | 说明 | 评价 |
| --- | --- | --- |
| **A（推荐）** | 5 篇以 **`status=0` 草稿**灌库（标题/摘要/分类/标签保留，正文写一页可编辑的提纲骨架）＋ 我另写 **1 篇真实发布文**（就是三期后端的技术复盘，内容真发生过），用于验证列表/详情/阅读时长/上下篇 | 占位文不会被当成成品发出去；同时有真实内容可验收 |
| B | 5 篇以 `status=1` 直接发布 | 把占位文当正式内容上线，**不建议** |
| C | 不灌库，列表空着 | 详情页没有可验收的数据，回归成本高 |

不管选哪个，**空态**都必须实现（一期 spec 已有「空数据给出方向」的要求）。

### D5 · API 契约

前缀 `/api`，**只用 GET/POST**，统一响应 `{code,message,data,traceId}`，分页 `{list,page,size,total,pages}`，错误码分段见规划 §9.1（400xx/401xx/404xx/409xx/429xx/500xx，HTTP 状态码与 `code` **同时**正确）。

**公开（零鉴权）**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 探活（DB + Redis） |
| GET | `/api/v1/articles` | `type` `categoryId` `tagSlug` `page` `size`；**只返回已发布**；**不含正文**；**不做 keyword 搜索**（偏离见 §1 #4） |
| GET | `/api/v1/articles/{slug}` | 详情：Markdown 原文 + 元信息 + 分类/标签 + **相邻篇（内联）**；**只返回已发布** |
| POST | `/api/v1/articles/{slug}/view` | 浏览量 +1（Redis 按 `hash(ip+ua)` 按天去重，幂等） |
| GET | `/api/v1/categories` | `scope=TECH` 分类列表（含已发布计数） |
| GET | `/api/v1/tags` | 标签列表（含已发布计数） |

**后台（Sa-Token 登录，除 login 外全部需登录）**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/admin/auth/login` | `{username,password}` → token；限流 + 失败锁定（Redis `login:fail:{username}`，5 次/15 分钟） |
| POST | `/api/v1/admin/auth/logout` | `StpUtil.logout()` |
| GET | `/api/v1/admin/auth/me` | 当前账号（不含口令哈希） |
| GET | `/api/v1/admin/articles` | 列表（**含草稿**，可按 `status`/`categoryId`/`keyword` 筛，分页）；`keyword` 主路径走 **`MATCH(title,summary) AGAINST('kw*' IN BOOLEAN MODE)`**（§1 偏离 5），关键词 < 2 字回退 `LIKE 'kw%'` |
| POST | `/api/v1/admin/articles` | 新建（`type` 决定归属，本期只做 `TECH`） |
| POST | `/api/v1/admin/articles/{id}` | 更新 |
| POST | `/api/v1/admin/articles/{id}/publish` | 发布/撤回（切 `status`，状态迁移用**路径后缀**） |
| POST | `/api/v1/admin/articles/{id}/delete` | 删除 |
| POST | `/api/v1/admin/upload` | 图片上传（`multipart`），返回 URL |

**工程决定**：`server.port=8080`、`server.servlet.context-path=/api`（Controller 写 `/v1/...`）；dev 环境前端走 **vite proxy `/api` → `http://127.0.0.1:8080`**，从而**与生产同源**、不必依赖 CORS。

### D6 · 前台：三处页面 + 一套正文管线

**① `/tech` 列表页改版（卡片博客风）**
- 首屏：频道标题 + 定位语 + 计数/最近更新（保留一期信息），下面是**卡片栅格**：桌面 2 栏、≥1200px 3 栏、≤719px 单栏
- 每张卡：封面（无图时用**品牌青碧渐变 + 衬线首字**的字体封面，不依赖外部图片）、分类胶囊、标题、摘要（2 行截断）、底部档案行（日期 · 阅读时长 · 标签）
- hover：抬升 2px + 阴影加深 + 封面轻微缩放；键盘 focus 有可见焦点环
- 一次取 20 篇；若 `total > 20` 显示「加载更多」（**不做**筛选 UI）

**② `/tech/:slug` 详情页（护眼阅读）——本期视觉重点**

| 维度 | 档位 |
| --- | --- |
| 正文栏宽 | `68ch`（约 720–760px），居中；≥1024px 时右侧留 220px TOC 栏 |
| 正文字号 / 行高 | **17px / 1.9** |
| 段间距 | 1.15em；段首不缩进（网页惯例），用间距分段 |
| 字色 | 不用纯黑：亮色走现有 `--fg-*`，暗色同；对比度按二期口径（≥ 4.5:1 正文、≥ 3:1 大字）**纳入对比度审计** |
| 标题 | 文章标题用展示衬线（700 档），正文内 h2/h3 有**章节编号**（自动 `01 / 02`）与可点击锚点 |
| 代码块 | 14px / 行高 1.7、等宽栈、横向滚动不换行、右上角复制按钮、深浅两套 token 配色（**映射到本站 token，不引 highlight.js 自带主题**） |
| 引用 / 表格 / 图片 | 引用左侧竖线 + 斜体；表格横向滚动；图片最大宽 100% + 说明文字 |
| 元信息 | 日期 · 阅读时长 · 分类 · 标签 · 浏览量 |
| 页尾 | 上一篇/下一篇卡片 + 「返回技术分享」 |
| TOC | 从 Markdown 的 h2/h3 抽，滚动联动高亮当前项；≤1023px 折叠到正文顶部（可展开） |
| 动效 | 入场错峰、TOC 高亮、复制成功反馈；**全部尊重 `prefers-reduced-motion`** |
| 浏览量 | 进入详情页后 `POST .../view`（幂等，前端不关心返回） |

**③ 首页新增「最新技术分享」区块**
- 位置：**项目经历之后、技术栈之前**（与 r2 的「经历优先」排序一致：先产出、后能力清单）
- 内容：最新 3 篇的**通栏紧凑列表**（标题 + 日期 · 阅读时长）+ 「查看全部 →」入口到 `/tech`
- 数据：复用 `GET /api/v1/articles?type=TECH&size=3`
- **不用卡片**（写 OpenSpec proposal 时读 `homepage` spec 才发现的硬约束）：该 spec 有「首页 SHALL 只对关键数字 / 项目经历 / 技术栈三类区块使用面板容器；其余区块 SHALL 保持通栏，SHALL NOT 使用面板底色或投影」。首页新区块若做卡片会同时违反这条 spec 与本设计的破例范围（**破例只在 `/tech` 与详情页**）。→ 区块顺序那条 spec 需要 MODIFY，但「不用面板」这条**不改**。

> ⚠️ **连带影响（必须一起做）**：首页从 7 个区块变 8 个，而 `CelestialField.module.css` 的停靠表只有 `[data-scene='0'..'6']`（`useActiveScene` 是动态取 `main section[aria-labelledby]` 的）→ 新区块会落到 scene 7 的**无规则**状态。因此本期必须：① 补 scene 7 停靠规则；② 重跑停靠探针（#97）；③ 重新量各块矩形、确认球不压字（#98）；④ 重排 `data-rhythm`（M/m 交替）与 reveal 错峰；⑤ 对比度/行为断言/四视口截图全部重跑。

**④ 新增前端依赖（**待批准**）**

| 用途 | 依赖 | 版本 |
| --- | --- | --- |
| 正文渲染 | `react-markdown` | 10.1.0 |
| GFM（表格/任务列表/删除线） | `remark-gfm` | 4.0.1 |
| 代码高亮 | `rehype-highlight` + `highlight.js` | 7.0.2 / 11.12.0 |
| 标题锚点 | `rehype-slug` | 6.0.0 |
| 后台编辑器 | `codemirror`（**注意**：`@codemirror/basic-setup` 已废弃，官方回「renamed to just 'codemirror'」）+ `@codemirror/lang-markdown` | 6.0.2 / 6.5.2 |

**依赖纪律**：二期立过「一期只加 1 个依赖」。本期加 5+2 个，理由：Markdown 渲染/高亮/消毒的边界情况（XSS、嵌套、表格、围栏代码）自己写不划算；编辑器同理。**代价控制**：详情页与 `/admin` 全部**路由级懒加载**，公开首屏不下载编辑器与后台代码，并纳入构建体积核对。

### D7 · 文章页的字体问题（**新增决策，必须定**）

本期第一次出现**动态长文本**，这与一期建的「自托管中文衬线子集」正面冲突：子集是从**静态渲染 DOM** 收集的 531 字（92.7KB），而文章正文/标题是后台随时写的 —— **任何字符表外的汉字都会回落到系统宋体**，出现同段混款（README 与 #38 已经写过这个坑）。

| 方案 | 说明 | 代价 |
| --- | --- | --- |
| **A（推荐）** | 为**文章页单独**生成一套「扩展子集」：**GB2312 一级字库 3755 字 + 常用标点**，两档（正文 500 / 展示 700），**独立 family 名**，只在 `/tech/:slug` 的 CSS 里引用 → **只在文章页下载**，静态页仍用现有小集 | 文章页多约 1.2MB（500 档）+ 0.35MB（700 档），`font-display: swap` 且浏览器缓存 |
| B | 文章页正文与标题**全部走系统字体栈**，不引子集 | 零成本、零混排风险；但失去品牌衬线，「博客感」打折 |
| C | 沿用现有 531 字子集 | **不可行**：动态内容必然命中表外字 → 混款 |

方案 A 的两套 `@font-face` 用**不同 family 名**，因此不存在 README 警告的「同一字符被两个 face 抢」问题（那是同一 family + 同 `unicode-range` 时的分裂）。

### D8 · 后台写入口（`/admin`）

| 路由 | 内容 |
| --- | --- |
| `/admin/login` | 账号 + 口令 → 拿 token。token 存 **`sessionStorage`**（不用 localStorage：关页即失效更安全） |
| `/admin/articles` | 列表：状态筛选（全部/草稿/已发布/归档）、关键词、分类；行内操作：编辑 / 发布·撤回 / 删除（**二次确认**） |
| `/admin/articles/new` · `/admin/articles/:id` | 编辑页：标题、slug（自动从标题生成、可手改、唯一性实时校验）、摘要、分类、标签、封面 URL、**Markdown 编辑器**（CodeMirror + 实时预览 + 图片粘贴上传）、保存草稿 / 发布 |

- 视觉**与公开站隔离**（规划 §10.4）：后台走标准管理台样式，不复用公开站的衬线/流线/天体层
- `/admin` 不进 sitemap、`robots.txt` 禁收录；未登录一律 401 → 前端跳登录页
- token 失效（`40102`）→ 清 token + 跳登录页，**不做静默降级**

### D9 · Markdown 导入器（CLI，不暴露 HTTP）

`java -jar backend.jar --import=<dir> [--dry-run] [--type=TECH]`，独立 profile `importer`。

- front-matter 约定照规划 §10.3（`title/slug/type/category/tags/summary/cover/status/publishTime`）
- 按 `(type, slug)` **幂等 upsert**；**绝不删除**已发布内容
- `--dry-run`：只打印将发生的变更（新增/更新/跳过），不写库
- **front-matter 校验失败 → 整批回滚**（单事务 + 逐文件预校验两段式：先全量解析校验，再统一落库）
- 输出计数表：新增 / 更新 / 跳过 / 失败（含失败原因与文件名）

### D10 · 验收策略（TDD 的保留与替代）

用户要求 1：**不可单测的任务用评估集替代 TDD**。本期分三类：

| 类别 | 手段 |
| --- | --- |
| 可单测（照走 TDD，先写测试） | slug 唯一性与生成、发布/撤回状态机、浏览量去重幂等、草稿不出现在公开接口、删除的级联（content/tag）、导入器幂等与整批回滚、BCrypt 登录与失败锁定、错误码映射、`reading_minutes` 估算 |
| 架构规则 | **ArchUnit 12 条**（D2）—— 这是 `Agent.md` 规则第一次有判据 |
| 接口层 | MockMvc 集成测试：401/400/404/409 + 统一响应体形状 + 分页结构 + GET/POST 文本扫描 |
| **不可单测（视觉/页面）** | **评估集** `docs/phase3-effect-matrix.md`：每条效果 = 判据 + 复核命令 + 实测结果。扩现有 `.tmp/tools`：`audit-behavior.cjs`（加 `/tech`、详情、首页新区块的断言）、`audit-contrast.cjs`（加正文/代码块/胶囊，亮暗各一遍）、`shot-final.cjs`（四视口加 `/tech`、`/tech/:slug`、`/admin`）、新增停靠探针（scene 7 与球压字） |
| 数据层 | **Docker Desktop 未运行 → Testcontainers 不可用**：用本机专用库 `jcpress_test` + Redis `db 15`，独立 `application-test.yml`，Flyway 建表；Testcontainers 作为 CI profile 占位（不实现） |

**环境适配（已实测，见 §6）**：编译需显式 `JAVA_HOME=<jdk-17>`（本机 Maven 3.6.3 默认挂在 Java 8 上）；Maven 本地仓库与 npm 缓存若因沙箱落在工作区外，分别用 `-Dmaven.repo.local=.tmp/m2` 与 `--cache .tmp/npm-cache` 绕开。

### D11 · 文档同步（本期交付物，不是顺手改）

| 文件 | 改动 |
| --- | --- |
| `docs/项目前期规划.md` | §5.3 技术选型 Java 21 → **17**；§5.5 Sa-Token 1.46.0 → **1.44.0** 并补「本机 Redis 5.0 实测」；§9.3 上传接口实现口径；§10.2 技术分享的维护方式（导入器 + 后台写入口都已有） |
| `README.md` | 技术栈表 Java 21 → 17；「后端与部署尚未开始」→ 三期状态；补后端验收命令 |
| `docs/decisions.md` | 新增本期决策 + 视觉纪律破例的**显式修订** |
| `docs/dev-journal.md` | 每阶段留痕（用户要求 2） |

---

## 3. 文件级交付物地图

```text
backend/                                   # 新建（模板移植而来）
├── pom.xml  mvnw  .mvn/
├── src/main/java/com/jcpress/
│   ├── JcpressApplication.java
│   ├── common/{result,exception,constant,enums,util}
│   ├── infrastructure/{config,cache,storage}
│   ├── domain/{dataobject,dto,query,vo,converter}
│   ├── repository/                        # Mapper 接口（含自写 SQL）
│   ├── manager/                           # 浏览量计数/去重等下沉能力
│   ├── service/ + service/impl/
│   ├── web/portal/controller/  web/admin/controller/
│   └── importer/                          # CLI 导入器
├── src/main/resources/
│   ├── application.yml  application-{dev,test,prod}.yml
│   ├── mapper/*.xml
│   └── db/migration/{V1__init_schema.sql, V2__seed_data.sql}
└── src/test/java/com/jcpress/             # ArchUnit + service/web/importer 测试

frontend/src/
├── api/{client.ts, articles.ts, admin.ts, types.ts}
├── hooks/{useArticles.ts(改), useArticleDetail.ts, useLatestArticles.ts, useAdminAuth.ts, useAdminArticles.ts}
├── components/markdown/{MarkdownBody.tsx, Toc.tsx, markdown.module.css, useToc.ts}
├── components/home/{LatestArticles.tsx, LatestArticles.module.css}     # 首页新区块
├── pages/tech/{TechListPage.tsx(改), ArticleCard.tsx, ArticleDetailPage.tsx, *.module.css}
└── pages/admin/{AdminLoginPage, AdminArticleListPage, AdminArticleEditPage, AdminLayout, *.module.css}

docs/{design-tech-module.md, plan-tech-module.md, phase3-effect-matrix.md}
openspec/changes/phase-3-tech-module/{proposal.md, design.md, tasks.md, specs/**/spec.md}
```

---

## 4. 风险与已知缺口（不藏）

| # | 项 | 处置 |
| --- | --- | --- |
| 1 | **构建期预渲染不再覆盖文章详情页**（内容在库里，构建期拿不到） | 本期详情页 SEO 降级为客户端渲染；SSR/预渲染留下一期。**这是明确的能力回退**，要写进 README |
| 2 | 首页多一个区块会动到天体停靠表 | 见 D6 的三条连带工作，**不许只加区块不重验** |
| 3 | 动态长文本 vs 静态字体子集 | 见 D7，必须选 A/B/C |
| 4 | 工作量：5 条工作流 + 5 个新页面 + 1 个 CLI + 1 套卡口 | 计划里按 W1→W2→W3→W5→W4 排序，每个任务单独提交、单独留痕；W4 依赖 W2 的接口，W3 的 UI 依赖 W3 的接口 |
| 5 | 本机 Redis 5.0 / MySQL 8.0.36 / Maven 3.6.3-on-Java8 | Sa-Token 锁 1.44.0（已解决）；Maven 编译显式指定 JDK 17 |
| 6 | 上传接口是新的攻击面 | 校验 MIME + 扩展名 + 大小上限 + 重命名落盘 + 禁可执行类型与路径穿越（规划 §10.5） |
| 7 | 前台从 mock 切真接口后接口挂了就是错误态 | **不做假数据降级**（`Agent.md`：依赖缺失应表现为失败，不得降级为用户可见文案） |
| 8 | 无对象存储 / CDN | 图片落本地磁盘，`uploads/` 已 gitignore；部署期再换 `OssFileStorage` |

---

## 5. 审批结果（2026-10-02 · 用户已全部批准）

用户原话：**「全部按推荐批准（D4-A / D6 批准 / D7-A / D5 按此）」**。

| 编号 | 待批内容 | 裁定 |
| --- | --- | --- |
| **D4** | 5 篇占位文怎么处理（A 灌草稿 + 另写真实文 / B 直接发布 / C 不灌） | ✅ **A** |
| **D6** | ① **前端新增 7 个依赖**（react-markdown 系 + CodeMirror 系）破二期「一期只加 1 个」的例；② **视觉纪律破例范围**与正文阅读档位（17px / 1.9 / 68ch / 代码块 14px） | ✅ **批准**：① 代价用**路由懒加载**控制；② 破例**仅限 `/tech` 与详情页**，并写进 decisions 显式修订 |
| **D7** | 文章页字体的三条路（A 文章页专用扩展子集 / B 全走系统字体栈 / C 沿用现有 531 字子集） | ✅ **A** |
| **D5** | 端口 8080 + context-path `/api` + dev 走 vite proxy（替代 CORS） | ✅ **按此执行** |

---

## 6. 本轮环境实测记录（设计所依据的证据）

| 实测 | 命令/方式 | 结果 |
| --- | --- | --- |
| 后端依赖可解析 | 探针 pom + `dependency:resolve` | **BUILD SUCCESS（1:20）**：SB 3.3.4 / MyBatis-Plus 3.5.7 / Sa-Token 1.44.0+1.46.0 / Flyway / Gson / knife4j-openapi3 4.5.0 / ArchUnit 1.3.0 |
| Maven 仓库可写性 | `New-Item D:\maven\repository\__dsh_probe` | **Access denied** → 改用工作区内 `.tmp\m2` |
| Sa-Token `KEEPTTL` | 解 jar 读 `SaTokenDaoForRedisTemplate.class` 常量池 | 1.46.0 **有** `KEEPTTL`；**1.44.0 / 1.42.0 无**；1.39.0 阿里云取不到 |
| 本机 Redis | `INFO server` | **5.0.14.1**（Windows 移植版）—— 低于 Sa-Token 要求的 6.0 |
| MySQL | `select version()` | **8.0.36**，root 可连，账号下无 `jcpress*` 库 |
| **规划 §6 DDL 可用性** | 把 §6.1/6.2/6.3 建表语句原样跑进探针库 | **全部建成**；`WITH PARSER ngram` 生效；`MATCH(title,summary) AGAINST('分片' IN BOOLEAN MODE)` **命中 1 行**；`DESC` 索引列生效；探针库已 drop |
| 前端依赖可解析 | `npm view <pkg> version --cache .tmp\npm-cache` | react-markdown 10.1.0 / remark-gfm 4.0.1 / rehype-highlight 7.0.2 / rehype-slug 6.0.0 / highlight.js 11.12.0 / codemirror 6.0.2 / @codemirror/lang-markdown 6.5.2 |
| npm 缓存 | 不加 `--cache` | 报 `error writing to the directory: C:\Users\O\AppData\Local\npm-cache\_logs` |
| Maven on JDK 17 | `JAVA_HOME=jdk-17 mvn -v` | Java version: **17.0.10**（Maven 3.6.3 可用） |
| OpenSpec | `openspec list --json` / `openspec context --json` | root = `C:\Users\O\Desktop\myproject\jcpress`，`changes: []`（可开新 change） |
| 前端 dev server | `GET 127.0.0.1:5173` | **HTTP 200**，是本项目的 Vite dev server（可直接用于浏览器断言与截图） |
| 首页区块连带面 | 读 `CelestialField.module.css` / `useActiveScene.ts` | 停靠表只有 `scene 0..6`；`useActiveScene` **动态**取 `main section[aria-labelledby]` → 新增第 8 区块会落到无规则的 scene 7 |
| **规划 §6 查询计划（2000 行真实数据量）** | 灌 2000 行 + `ANALYZE TABLE` + `EXPLAIN`（`.tmp/probe-sql/query-probe.sql`） | 公开列表 `ref` 走 `idx_type_status_publish_time`（**无 filesort**）；分类筛 `ref` 走 `idx_category_id_status_publish_time`；相邻篇「下一篇」`Backward index scan`、**`rows=1`**，「上一篇」`range` + index condition；**唯一例外**：首页按 `is_top DESC, publish_time DESC` 产生 `Using filesort`（已记入 D3，接受） |
| **ngram 全文索引 vs `LIKE` 前缀** | 同一份数据上 `EXPLAIN` 对比 | ngram（`AGAINST('分片*' IN BOOLEAN MODE)`）→ `type=fulltext` 走 `ft_title_summary`；`LIKE '探针文章 1%'` → **`type=ALL` 扫 1940 行**（`title` 上没有可用索引）→ 后台 keyword 主路径改走全文索引（§1 偏离 5） |
| **ngram 的单字边界** | `SHOW VARIABLES LIKE 'ngram_token_size'` + 单字 `AGAINST` | `ngram_token_size=2`，**单个汉字命中 0** → 关键词 < 2 字必须回退 `LIKE`，否则用户搜一个字永远搜不到 |
| **视觉验收工具链的可用性** | `node .tmp/tools/audit-contrast.cjs`（依赖 5173 上正在跑的 dev server） | 先报 `browserType.launch: spawn EPERM`（Edge 以 `--remote-debugging-pipe` 命名管道启动，被沙箱拒绝）；**文件策略放开为 `danger-full-access` 后跑通**：亮暗各 **220** 处文本、未达标 **0** —— 二期基线未回退，评估集这条路径可用 |

---

## 7. 批准后的下一步

1. ~~你批准本文件~~ ✅ **2026-10-02 已批准** → 连同**阶段 31 留痕**一起提交
2. `writing-plans` 产出 `docs/plan-tech-module.md`（任务级拆分，含每任务的验收命令）→ **计划评审**
3. `openspec new change phase-3-tech-module` → proposal / specs 增量 / design / tasks
4. 开分支 `feat/phase-3-tech-module` → 按 W1→W2→W3→W5→W4 实施，每个任务完成即留痕
