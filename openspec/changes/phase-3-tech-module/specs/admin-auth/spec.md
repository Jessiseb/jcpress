# Spec Delta

## Purpose

后台认证：用一套最小、可控的账号口令登录机制保护 `/api/v1/admin/**` 写平面，使前台保持零鉴权的同时，后台入口不被匿名访问。

## ADDED Requirements

### Requirement: 口令以 BCrypt 哈希存储

后台账号口令 SHALL 只以 BCrypt 哈希形式存于数据库，SHALL NOT 存在任何明文口令；校验 SHALL 使用同一算法比对。任何账户相关响应（登录、当前账号）SHALL NOT 包含口令哈希字段。系统 SHALL NOT 提供注册入口。

#### Scenario: 响应不含口令哈希

- **WHEN** 登录成功或查询当前账号
- **THEN** 响应体中没有口令哈希字段

#### Scenario: 数据库里没有明文口令

- **WHEN** 检查后台账号表的哈希列
- **THEN** 每一行都是 BCrypt 格式（以 `$2a$` 等标识开头）

### Requirement: 登录签发 token 且会话落 Redis

登录成功 SHALL 签发一个 token 并返回 token 值与其请求头名称；token 的请求头名称 SHALL 与配置一致（本项目为 `jcpress-token`）。会话 SHALL 持久化到 Redis，使服务重启后登录态不丢失。业务实体 SHALL NOT 被写入 Sa-Token 的会话（只存账号标识等基本值），以避免多态反序列化限制导致的运行期失败。

#### Scenario: 登录返回 token 与头名

- **WHEN** 用正确口令登录
- **THEN** 响应包含非空 token 与头名 `jcpress-token`

#### Scenario: 会话写入 Redis

- **WHEN** 登录后检查 Redis 中前缀为 token 名称的键
- **THEN** 存在对应的会话键

#### Scenario: 重启后仍可登录态校验

- **WHEN** 应用重启后用既有 token 请求当前账号接口
- **THEN** 返回该账号信息（登录态未因重启丢失）

### Requirement: 登录失败锁定与限流

同一用户名连续失败达到 5 次后 SHALL 在 15 分钟内拒绝该用户名的登录尝试（即使口令正确），并 SHALL 返回专门的错误码（40103）。登录接口 SHALL 按来源 IP 限流（每分钟 10 次），超限 SHALL 返回频率限制错误码（42901）。登录成功后 SHALL 清除该用户名的失败计数。

#### Scenario: 五次失败后锁定

- **WHEN** 同一用户名连续 5 次使用错误口令，随后改用正确口令登录
- **THEN** 返回 40103（登录失败次数过多）

#### Scenario: 成功后清空失败计数

- **WHEN** 一次失败之后用正确口令登录成功
- **THEN** 该用户名的失败计数被清除

#### Scenario: 同 IP 高频尝试被限流

- **WHEN** 同一 IP 在一分钟内发起超过 10 次登录请求
- **THEN** 后续请求返回 42901

### Requirement: 未登录与失效的口径

未携带 token 访问受保护接口 SHALL 返回业务码 40101；携带无效或已过期 token SHALL 返回业务码 40102。两种情况的 HTTP 状态码 SHALL 都是 401（SHALL NOT 一律返回 200 再用业务码区分）。受保护接口 SHALL NOT 向前端返回原始异常堆栈。

#### Scenario: 无 token 返回 40101

- **WHEN** 不带 token 请求当前账号接口
- **THEN** HTTP 401 且业务码为 40101

#### Scenario: 无效 token 返回 40102

- **WHEN** 带一个伪造 token 请求当前账号接口
- **THEN** HTTP 401 且业务码为 40102

### Requirement: 后台命名空间的统一拦截

所有 `/api/v1/admin/**` 路径 SHALL 需要登录，**唯一例外**是登录接口本身；前台路径 SHALL NOT 受任何鉴权影响（SHALL NOT 要求 token，也 SHALL NOT 因为后台登录状态而变化）。

#### Scenario: 后台接口统一受保护

- **WHEN** 未登录访问任意 `/api/v1/admin/**` 接口（除登录外）
- **THEN** 返回 401

#### Scenario: 前台接口零鉴权

- **WHEN** 不带任何 token 访问公开的文章列表与详情接口
- **THEN** 正常返回数据
