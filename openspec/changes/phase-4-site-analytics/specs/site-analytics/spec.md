# Spec Delta

## Purpose

统计口径与查询：把 Redis 里的日内累计落成 MySQL 的日聚合，并对外提供**能解释清楚**的四条统计。

## ADDED Requirements

### Requirement: 日聚合的写入是幂等的

站点与路径的日内计数 SHALL 在 Redis 中累计，并**周期性以快照方式覆盖**写入 `visit_daily` / `visit_path_daily`；同一天回写任意多次，结果 SHALL 与只回写一次相同。UV SHALL 取自去重集合的基数，SHALL NOT 由累加得到。

#### Scenario: 回写两次不会翻倍

- **WHEN** 某天已回写一次（pv=3、uv=2）后再次回写
- **THEN** 该天记录仍是 pv=3、uv=2

#### Scenario: 回写中途失败不留脏数

- **WHEN** 回写过程中 MySQL 抛出异常
- **THEN** 该天已有记录保持上一次的正确值，Redis 累计不受影响（下次回写照常补齐）

### Requirement: 文章阅读的日维度与既有口径一致

一篇文章在某天的日计数 SHALL 与「按指纹去重后当天的阅读数」同口径：同一访客同一天重复打开同一篇 SHALL 只记 1 次。`article.view_count` 的累加方式与回写方式 SHALL 保持不变。

#### Scenario: 重复打开只记一次

- **WHEN** 同一访客在同一天打开同一篇文章 3 次
- **THEN** 该文章当天的 `article_view_daily.view_count` 为 1，`article.view_count` 增加 1

#### Scenario: 两个访客各记一次

- **WHEN** 两个不同指纹的访客在同一天打开同一篇文章
- **THEN** 当天 `view_count` 为 2

### Requirement: 统计查询的口径可解释

系统 SHALL NOT 提供「多日 UV 之和」这类把按日去重结果相加的指标；当日指标 SHALL 说明其新鲜度（最迟多少分钟更新）；文章维度的数字 SHALL 被表述为「按天去重的阅读数」而非「点击次数」。`days` 参数 SHALL 被服务端限幅在 1–90，`limit` SHALL 被限幅在 1–50。

#### Scenario: 没有七日 UV 这个字段

- **WHEN** 请求总览接口
- **THEN** 响应中不含任何形如「7 日 UV / 周 UV」的字段，只有近 7 日 PV

#### Scenario: 天数越界被夹住

- **WHEN** 请求趋势接口时传 `days=1000`
- **THEN** 实际按 90 天返回，且不报错

### Requirement: 趋势序列按日连续

趋势接口 SHALL 返回请求区间内**每一个自然日**的数据，没有数据的日子 SHALL 以 0 补齐并按日期升序返回；日期 SHALL 以 `yyyy-MM-dd` 表示。

#### Scenario: 中间没有数据的日子补 0

- **WHEN** 区间内只有 10-01 与 10-03 有访问
- **THEN** 返回序列包含 10-02，其 pv 与 uv 均为 0

### Requirement: 排行与热门页面的排序

文章排行 SHALL 按「期间内阅读数」降序、相等时按累计阅读数降序；每项 SHALL 同时给出期间阅读数、累计阅读数与标题、slug。热门页面 SHALL 按期间内 PV 降序，SHALL 排除 `/admin` 前缀的路径。

#### Scenario: 并列时用累计数破平

- **WHEN** 两篇文章在区间内都是 3 次阅读，累计分别为 10 与 40
- **THEN** 累计 40 的那篇排在前面

#### Scenario: 文章已删除也不报错

- **WHEN** 排行里某篇文章已被删除，但日表里仍有它的记录
- **THEN** 接口正常返回，该条以「（已删除）」占位而不是抛异常或返回空标题
