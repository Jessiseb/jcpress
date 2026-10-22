# Proposal

## Why

站主现在对站点**几乎没有感知**：后台能看到的唯一数字是 `article.view_count`（每篇文章的累计阅读数），而且它还是 Redis 攒够 5 分钟才回写的。下面这些问题今天一个都答不出来 ——

- 今天有多少人来了？昨天呢？这周比上周好吗？
- 哪篇文章真的被点开了？上周点得最多的那篇是谁？
- 访客都停在哪些页面？除了文章详情，还有人在首页以外的地方停留吗？
- 站是新发的还是老文在回流？新写的文档有没有人看？

「访问量」这一层**完全不存在**：页面由 nginx 直出，后端只处理 `/api/**`，所以**后端日志里根本没有页面请求**；也没有任何前端埋点。文章的点击量只有总量、没有日维度，所以「最近 7 天」这种问题在现有表结构上无法回答。

第四期把「站点数据」这条链路打通：前端采集 → 后端日聚合 → 后台可视化。它同时要回答一个**口径问题** —— 一个数字如果口径说不清（比如「7 日 UV」把每天的独立访客加起来），它比没有这个数字更糟。

## What Changes

- **访问采集链路**（新增）：前端在 SPA 路由落定后向 `POST /v1/stats/pageview` 上报 `{path}`；后端按「ip + ua 指纹」按自然日去重后累计。埋点**永不阻塞页面、永不重试、失败静默**，后台路由不上报。
- **日聚合存储**（新增 Flyway `V3`）：`visit_daily`（日 PV / UV）、`visit_path_daily`（日 × 路径 PV）、`article_view_daily`（日 × 文章阅读数）。**不落原始访问事件流** —— 单人站、2G 服务器，原始表只会变成库里最大且无人查的表。
- **文章点击量补日维度**：`ArticleViewManager` 在既有的「同指纹同日只计一次」判定为真时，额外累加当天的 `article_view_daily`；`article.view_count` 的语义与回写方式**不变**。
- **统计查询接口**（新增 `GET /v1/admin/stats/*`）：`overview`（今日 / 7 日 / 累计）、`trend`（近 N 天逐日 PV·UV）、`articles`（期间点击排行 + 累计）、`paths`（热门页面）。
- **后台「数据看板」页**（`/admin/dashboard`）：四张指标卡 + 30 天趋势图 + 文章点击排行 + 热门页面；趋势图**手写 SVG**，不引图表库；并把它设为后台落地页（`ADMIN_HOME`），文章列表退为普通标签。
- **口径写进界面**：不提供「7 日 UV」（按日去重的集合不能相加）；今日数据标注「最多滞后 5 分钟」；文章维度明确是「按天去重的阅读数」而不是「点击次数」。

## Capabilities

### New Capabilities

- `stats-collection`: 访问采集 —— 何时上报（路由落定、仅匿名前台页）、上报什么（pathname，剥离 query/hash）、上报失败的静默策略、服务端限流与路径校验、访客去重与隐私边界（只留指纹、不落 IP/UA 原文到 MySQL）。
- `site-analytics`: 日聚合口径 —— Redis 日内累计 + 定时快照覆盖的幂等写入、文章阅读日维度与既有去重口径的一致性、聚合表的保留策略，以及四条统计查询的字段与排序。
- `admin-dashboard`: 后台数据看板 —— 落地页位置、四张指标卡的口径、趋势图的可判定要求（无数据日补 0 / 不引图表库 / 亮暗自适应）、排行与热门页面的排序与空态、三态与文案纪律。

## Impact

**新增代码（后端）**：`db/migration/V3__add_site_stats.sql`、`domain/dataobject/VisitDailyDO|VisitPathDailyDO|ArticleViewDailyDO`、`domain/projection/*StatRef`、`domain/vo/StatsOverviewVO|VisitTrendVO|ArticleStatsVO|PathStatsVO`、`repository/VisitStatMapper|ArticleViewStatMapper`（+ 2 个 XML）、`manager/VisitStatManager`、`service/StatsService` + `impl`、`web/portal/controller/StatsController`、`web/admin/controller/AdminStatsController`。

**新增代码（前端）**：`api/stats.ts`、`hooks/usePageView.ts`、`hooks/useDashboardStats.ts`、`pages/admin/AdminDashboardPage.tsx` + `dashboard.module.css`、`components/admin/TrendChart.tsx`。

**改动的现有代码**：`ArticleViewManager`（加日维度累加与回写）、`RedisKeyConstant`（新增统计键）、`App.tsx`（新路由 + 埋点挂载）、`pages/admin/adminMenu.ts`（菜单项 + 落地页常量）、`hooks/useAdminTabs.ts`（常驻标签跟着落地页走）、`api/types.ts`。

**数据库**：新增 3 张日聚合表；不改动任何既有表结构与索引。

**不引新依赖**：前端不引图表库（趋势图手写 SVG），后端不引统计/BI 组件。

**不在本期范围**：来源站点（Referer）分析、设备/地域分布、转化漏斗、实时在线人数、原始访问日志留存、数据导出、`/api/v1/search`。也不做「按小时」的粒度 —— 单人站的量级下日粒度足够，小时表会让行数 × 24 而不产生新决策。
