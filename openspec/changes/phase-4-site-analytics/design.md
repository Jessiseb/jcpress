# Design

## 上下文

- 前端是 SPA（React Router 6），页面由 nginx 直出，`/api/**` 反代到后端 8091。**后端看不到任何页面请求。**
- 已有浏览量的完整先例：`ArticleViewManager`（Redis `SADD` 去重 + `INCR` 累加 + `RENAME` 搬走 + 每 5 分钟 `INCR` 回写 `article.view_count`），Redis 锁 5.0.14（无 `GETDEL`）。
- 生产是 2G 内存 / 单实例 / MySQL 单库，Redis 带 `requirepass`。
- 后台已有外壳（深色侧栏 + 标签页 + 面包屑），菜单由 `adminMenu.ts` 单点驱动。

## 决策

### D-A 采集点放在前端，而不是后端过滤器

**选择**：前端在路由落定后 `POST /v1/stats/pageview`。

**理由**：nginx 只把 `/api/**` 转给后端，页面请求根本不经过 Java；SPA 内部切路由更是连 HTTP 请求都不产生（除了接口调用，而那些是 `/api/v1/articles` 之类，无法区分「列表页」与「详情页」）。后端若想统计，只能去解析接口调用，得到的不是「访问量」而是「接口调用量」。

**代价**：不执行 JS 的爬虫/纯静态抓取不会被记到（对个人站这是**优点**：数据更接近真人）。首屏会多一个非阻塞请求（`sendBeacon` 不占连接、不参与渲染）。

### D-B 只留日聚合，不留原始事件流

**选择**：三张按日聚合的表，没有 `visit_event`。

**理由**：单人站日 PV 以百计，原始表一年也就几万行 —— 这不是性能问题，是**没人会去查**的问题。日聚合表一年 365 行，`SELECT` 一眼看完，`EXPLAIN` 都不需要。真要按小时/按来源分析，那是有一个明确问题要回答的时候再做，届时原始数据也补不回来（这点认了，写进已知限制）。

**代价**：不可回算历史口径（例如以后想换 UV 去重算法，只能从换的那天起生效）。

### D-C 站点计数用「日内累计 + 快照覆盖」，不复刻 `RENAME` 搬走

**选择**：Redis 里 `stat:pv:{yyyyMMdd}` 是**日内累计**（`HINCRBY` 只增不减），回写时把累计值**覆盖**写进 MySQL（`ON DUPLICATE KEY UPDATE pv = VALUES(pv)`），键不删除、只设 7 天 TTL。UV 直接 `SCARD stat:uv:{yyyyMMdd}`（O(1)）。

**理由**：站点统计是「这一天的总量」，天然可覆盖、天然幂等 —— 定时任务跑 10 次和跑 1 次结果一样，进程中途挂掉也不会少算。文章 `view_count` 之所以必须 `RENAME` 搬走，是因为它是**增量**累加（`view_count = view_count + delta`），重复刷会把数加两遍。**同一份代码里两种回写方式并存，是因为语义不同，不是因为随手写的。**

**代价**：日内累计键要到 TTL 才消失，7 天内 Redis 多几个 key（每个几 KB），可接受。

### D-D 文章日维度复用既有去重判定，不另开一套计数

**选择**：`ArticleViewManager.saveView` 里 `SADD` 返回 1（说明是新访客）时，除现有 `INCR view:count:{id}`，再 `HINCRBY stat:article:{yyyyMMdd} {articleId} 1`；回写时覆盖写 `article_view_daily`。

**理由**：如果另开一套「点击次数」计数，后台就会出现两个数：卡片上的 `view_count`（去重阅读数）和排行里的「点击数」（含刷新）。**两个数不一致时，用户只会认为其中一个是错的。** 所以本期只有一套口径，并在界面上写明它是「按天去重的阅读数」。

**代价**：「同一个人一天点开同一篇 5 次」记 1 次。这符合「有多少人读了」而不是「被点了几次」，也符合已有的 `view_count` 语义。

### D-E 趋势图手写 SVG，不引图表库

**选择**：`TrendChart.tsx` 用 `<svg>` + `polyline` + 渐变 `<linearGradient>` 画双线（PV / UV），鼠标移动出竖线与 tooltip。

**理由**：echarts 打包后 300KB+、recharts 100KB+，而这里要画的东西是「30 个点的两条折线」。为了这点图形引一个带主题系统、动画引擎、无数配置项的库，与三条约束都冲突：后台懒加载包体积、设计系统（颜色必须跟 `--adm-*` 走）、以及本项目的「不用大件解决小问题」倾向。手写 SVG 还能直接吃 CSS 变量、亮暗自动跟随。

**代价**：没有缩放、brush、图例点击隐藏等交互。真要那些能力时再换库 —— 换的成本就是重写这一个组件。

### D-F 看板成为后台落地页，而不是菜单里的第七项

**选择**：`ADMIN_HOME` 从 `/admin/articles` 改为 `/admin/dashboard`；`useAdminTabs` 的常驻标签跟着常量走（标题改为「数据看板」）。

**理由**：运营后台的第一屏应该是「我的站现在怎么样」，而不是「文章列表」。若只加一个菜单项、落地仍是文章列表，看板就成了没人点开的一页 —— 数据看板的价值全在「顺手看见」。

**代价**：`ADMIN_HOME` 是标签系统的约定点（常驻标签、`closeOthers` 的锚点、登录后的返回路径），改一处要检查三处；已有测试里若有「默认落在文章列表」的断言需要同步。

### D-G 今日数据最多滞后 5 分钟，并在界面上写明

**选择**：定时回写沿用 5 分钟节奏；接口**不读 Redis** 补实时值；看板的「今日」卡片带一行小字「数据每 5 分钟更新一次」。

**理由**：接口去读 Redis 拼实时值，会引入「MySQL 与 Redis 两份真相 + 时区/进程重启差异」的复杂度，而收益只是「少等 5 分钟」。单人站看数据不是看盘，5 分钟完全够。**但必须写出来** —— 否则用户看到 0 会以为没人来，实际上可能是刚发的文章。

### D-H 不提供「7 日 UV」

**选择**：`overview` 只有 `todayPv / todayUv / last7Pv / totalArticleView` 等，**没有** `last7Uv`。

**理由**：每天的 UV 是「当天独立访客数」，把 7 天加起来会把同一个人算 7 次，得出的数字既不是「7 天内来了多少人」也不是任何真实量。要算真正的 7 日 UV，得存 7 天的指纹并集（或者 HyperLogLog），代价与收益不成比例。**宁可不给这个数**，也不给一个看起来合理其实错的数。趋势图里逐日 UV 是有效的（每个点各自成立）。

### D-I 指纹只在 Redis 里，不进 MySQL

**选择**：UV 去重集合 `stat:uv:{day}` 存 `HashUtils.fingerprint(ip, ua)`（SHA-256 前 16 位），TTL 7 天；MySQL 里只有天数与计数。

**理由**：与既有浏览量去重口径一致，且让「数据库里没有任何身份信息」这条成立。指纹不可逆，7 天后 Redis 里也不剩。

### D-J 时区与统计日

**选择**：统计日取 JVM 默认时区（生产已由 `server-init.sh` 固定为 Asia/Shanghai，数据源 URL 也带 `serverTimezone=Asia/Shanghai`），`stat_date` 用 `DATE` 列。

**理由**：`visit_daily.stat_date` 与「自然日」必须一致，否则跨 0 点的那两三条会被记到前一天。生产时区已统一，这里不额外引入 `ZoneId` 参数（多一个可配置项就多一处能配错）。

## 数据模型

```sql
visit_daily(stat_date DATE PK, pv INT UNSIGNED, uv INT UNSIGNED, gmt_create, gmt_modified)
visit_path_daily(stat_date DATE, path VARCHAR(160), pv INT UNSIGNED, PK(stat_date, path))
article_view_daily(article_id BIGINT UNSIGNED, stat_date DATE, view_count INT UNSIGNED,
                   PK(article_id, stat_date), KEY idx_stat_date(stat_date))
```

**有意偏离**（与 `V1__init_schema.sql` 头部约定不同）：这三张表**不设自增 `id`**，用「日期（+ 路径/文章）」作主键。理由与既有的 `article_content`（用 `article_id` 当主键）、`article_tag`（复合主键）同一条：**聚合表的天然主键就是维度本身**，硬加一个代理键只会让「一天只能有一行」这件事失去数据库约束。

## 接口

| 方法 | 路径 | 用途 |
| :-- | :-- | :-- |
| POST | `/v1/stats/pageview` | 上报一次页面访问（公开、限流、无返回体） |
| GET | `/v1/admin/stats/overview` | 今日 PV·UV、近 7 日 PV、累计阅读、文章数 |
| GET | `/v1/admin/stats/trend?days=30` | 逐日 PV / UV（缺日补 0） |
| GET | `/v1/admin/stats/articles?days=30&limit=10` | 期间点击排行（含累计） |
| GET | `/v1/admin/stats/paths?days=7&limit=10` | 热门页面（`/admin` 不计入） |

`days` 服务端限幅 `[1, 90]`，`limit` 限幅 `[1, 50]` —— 与 `PageQuery` 的 `size` 限幅同一条纪律（参数再大也不让一次拉全表）。

## 风险与已知限制

1. **历史无法回填**：本期上线前的访问与文章点击只有 `article.view_count` 总量，日维度从上线当天开始有数。看板首屏会是「今天有数、前面 29 天为 0」，空态文案必须能解释这件事，否则看着像坏了。
2. **单实例假设**：Redis 累计键的读写没有分布式锁；多实例部署时需换成 Lua 或每实例独立键。与 `ArticleViewManager` 的既有边界一致。
3. **广告/扫描器**：指纹去重对同一 IP 的爬虫无力。个人站不设防护，接受这部分噪声（比装反爬便宜）。
4. **`visit_path_daily` 的基数**：路径含 slug，长期会随文章数增长。当前量级（百篇）无问题；若到万篇再考虑把 `/tech/:slug` 归并成 `/tech/*`。
