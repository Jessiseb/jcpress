# Tasks

> 纪律同前几期：每完成一项**立即**跑该项验证 → 在 `docs/dev-journal.md` 第 69 节追加留痕 → commit。不攒到最后补记。

## 1. W1 数据层与采集链路

- [x] 1.1 写 `V3__add_site_stats.sql`（`visit_daily` / `visit_path_daily` / `article_view_daily`，聚合表以维度+日期作主键、不设代理键），把三张表加进 `FlywayMigrationTest`，验证 `mvn -q test -Dtest=FlywayMigrationTest` 全绿
- [x] 1.2 建投影（`DailyPvUvRef`、`ArticleStatRef`、`PathStatRef`、`ArticleCountRef`）与 VO（`StatsOverviewVO`、`VisitTrendVO`、`ArticleStatsVO`、`PathStatsVO`）+ `PageViewDTO`，验证 `mvn -q -DskipTests compile` 通过。**落地修正**：三张聚合表不建 DO —— 它们是纯读模型，没有业务身份也不用 `selectById`，直接用投影更少一层（见 dev-journal 69.3）
- [x] 1.3 补 `RedisKeyConstant` 的统计键（站点累计 hash、UV 去重集合、路径累计 hash、文章累计 hash），键名集中管理、不在业务代码里散写
- [x] 1.4 实现 `VisitStatManager`（`saveVisit` 累加 + UV `SADD` + `flushDaily` 快照覆盖），验证 `VisitStatManagerTest` 三条全绿（同指纹只算 1 UV / 回写幂等不翻倍 / 回写后 MySQL 值等于 Redis 累计）
- [x] 1.5 扩展 `ArticleViewManager`：去重命中时同时累加当天文章计数，并回写 `article_view_daily`，验证 `ArticleViewManagerTest` 原三条仍绿 + 新增两条（日表写入 / 回写幂等）
- [x] 1.6 实现公开采集接口 `POST /v1/stats/pageview`（路径校验、按 IP 限流、无 IP 时不计数但返回成功），验证 `StatsControllerTest` 四条全绿（正常计数 / 非法路径 40001 / 超长路径 40001 / 超频 42901）
- [x] 1.7 W1 出口复核：跑 `mvn -q test -Dtest='VisitStatManagerTest,ArticleViewManagerTest,StatsControllerTest,FlywayMigrationTest'` 全绿，并在 dev-journal 第 69 节追加 W1 留痕

## 2. W2 统计查询

- [x] 2.1 写 `VisitStatMapper` + XML（按日区间取 PV/UV、按区间汇总 PV、路径排行、文章排行、文章累计阅读合计）与 `ArticleViewStatMapper`（日计数 upsert、按区间取某文章之和），验证 `VisitStatMapperTest` 全绿（区间边界含首含尾、空区间返回 0、排行排除 `/admin`）
- [x] 2.2 实现 `StatsService`（`getOverview` / `listTrend` / `listArticleStats` / `listPathStats`，`days` 夹在 1–90、`limit` 夹在 1–50、趋势补零、已删除文章标题兜底），验证 `StatsServiceTest` 五条全绿（含补零、夹值、已删除兜底）
- [x] 2.3 实现 `AdminStatsController`（四个 GET），验证 `AdminStatsControllerTest` 全绿（未登录 401 / 登录后四条都能取到）
- [x] 2.4 W2 出口复核：起后端手工 `curl` 上报几次 + 四条查询接口，核对数字与 Redis/MySQL 一致，追加 W2 留痕

## 3. W3 后台看板

- [x] 3.1 补 `api/types.ts` 的统计类型与 `api/stats.ts` 的四条请求（ID 一律 string、计数一律 number），验证 `npx tsc --noEmit` 通过
- [x] 3.2 实现 `usePageView`（`sendBeacon` 优先、跳过 `/admin`、剥 query/hash、失败静默）并挂到 `App.tsx`，验证 `usePageView.test.ts` 三条全绿（跳过后台 / 剥参数 / 失败不抛）
- [x] 3.3 改 `adminMenu.ts`（新增「数据看板」并置于内容管理之前、`ADMIN_HOME` 指向它）与 `useAdminTabs`（常驻标签跟随 `ADMIN_HOME`），验证既有 `useAdminTabs` 相关断言同步更新后通过
- [x] 3.4 实现 `TrendChart`（手写 SVG、双线 + 渐变、悬停竖线与 tooltip、全零时不出图），验证 `TrendChart.test.tsx` 三条全绿
- [x] 3.5 实现 `AdminDashboardPage` + `dashboard.module.css`（四张指标卡含口径小字、区间切换、排行、热门页面、三态），验证 `AdminDashboardPage.test.tsx` 四条全绿（KPI 渲染 / 失败态不伪装空态 / 全零空态文案 / 排行可点）
- [x] 3.6 补路由（`/admin/dashboard`，懒加载）与 `/admin` 的跳转目标，验证手工走「登录 → 落地看板 → 切区间 → 点排行进编辑页」
- [x] 3.7 W3 出口复核：`npx tsc --noEmit` + `npx vitest run` + 构建节流命令跑通，追加 W3 留痕

## 4. 集成收尾

- [x] 4.1 全量验证：后端 `mvn test` 全绿（含 ArchUnit 与源码扫描）、前端 `vitest run` 全绿、`tsc --noEmit` 0 错误
- [x] 4.2 端到端：真起前后端，前台访问几个页面 → 看板数字跟着变（允许 5 分钟滞后，手工触发一次回写核对）
- [x] 4.3 文档同步：`docs/dev-journal.md` 第 69 节收口、`docs/decisions.md` 追加本期决策、`RUNBOOK.md` 补「统计不生效怎么查」
- [ ] 4.4 `openspec validate phase-4-site-analytics` 通过；归档前向用户确认（按本项目惯例，`archive` 不自动执行）
