# Spec Delta

## Purpose

访问采集：把「有人打开了哪个页面」这件事从浏览器送到后端，并在不影响页面、不泄露身份的前提下落到当天。

## ADDED Requirements

### Requirement: 采集时机与上报内容

前台 SHALL 在**每次路由落定后**上报一次页面访问（首次进入与站内跳转都算），上报内容 SHALL 只包含规范化后的 `pathname`，SHALL NOT 包含 query string、hash、referrer 或任何用户标识。后台路由（`/admin` 及其子路径）SHALL NOT 上报。

#### Scenario: 站内跳转各记一次

- **WHEN** 访客从 `/` 点进 `/tech`，再点开 `/tech/foo`
- **THEN** 后端依次收到 `/`、`/tech`、`/tech/foo` 三次访问

#### Scenario: 同一路径带不同查询参数只算同一页

- **WHEN** 访客分别打开 `/tech?tag=java` 与 `/tech?page=2`
- **THEN** 两次上报的 path 都是 `/tech`，热门页面里只有一行 `/tech`

#### Scenario: 后台页面不进统计

- **WHEN** 站主在后台翻看文章列表与数据看板
- **THEN** 这些访问不出现在任何访问统计里（含热门页面）

### Requirement: 采集不得影响页面

上报 SHALL 是非阻塞的（`sendBeacon` 优先、`fetch keepalive` 兜底），SHALL NOT 重试，SHALL NOT 在失败时向用户展示任何提示或改动页面状态，SHALL NOT 让请求异常冒泡到 React 渲染链路。

#### Scenario: 后端不可用时页面照常

- **WHEN** 采集接口返回 500 或网络中断
- **THEN** 页面正常渲染、正常交互，控制台不出现未捕获的异常

### Requirement: 服务端对采集接口的约束

采集接口 SHALL 是公开接口（无需登录），SHALL 对同一来源 IP 限流，SHALL 拒绝不含 `/` 或长度超过 160 的路径参数（返回参数错误），SHALL 对无法识别的来源（无 IP）采取「照常返回成功但不计数」而不是报错。

#### Scenario: 超长路径被拒

- **WHEN** 上报的 path 长度为 500
- **THEN** 返回 40001 且不写入任何计数

#### Scenario: 高频上报被限流

- **WHEN** 同一 IP 在一分钟内上报次数超过阈值
- **THEN** 超出部分返回 42901，已计入的部分不受影响

### Requirement: 访客去重与隐私边界

访客身份 SHALL 以「IP + User-Agent 的不可逆指纹」表示，按自然日去重；指纹 SHALL 只存在于 Redis 的去重集合中并随 TTL 过期，SHALL NOT 写入数据库；数据库 SHALL 只保存日期与计数。

#### Scenario: 同一访客同一天只算一个 UV

- **WHEN** 同一 IP 与同一 UA 在同一天内访问 5 次首页
- **THEN** 当天 UV 为 1、PV 为 5

#### Scenario: 库里没有身份信息

- **WHEN** 查询 `visit_daily` 与 `visit_path_daily` 的全部列
- **THEN** 不存在 IP、User-Agent、Cookie 或指纹字段
