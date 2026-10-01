# Spec Delta

## Purpose

技术分享的后台写平面：让站主在浏览器里完成文章的新建、修改、发布、撤回与删除，并能上传配图，所有写操作都留下审计记录。

## ADDED Requirements

### Requirement: 后台列表包含草稿

后台文章列表 SHALL 返回全部状态的内容（草稿 / 已发布 / 归档），SHALL 支持按状态、分类与关键词筛选并分页；关键词匹配 SHALL 走全文索引主路径，关键词长度不足 2 个字符时 SHALL 回退为标题前缀匹配，SHALL NOT 使用左模糊或全模糊匹配。

#### Scenario: 草稿出现在后台列表

- **WHEN** 已登录管理员请求后台文章列表并筛选草稿
- **THEN** 返回结果中存在未发布的文章

#### Scenario: 单字关键词仍能搜到

- **WHEN** 用 1 个汉字作为关键词筛选
- **THEN** 返回标题以该字开头的文章（回退路径生效，而不是返回空）

### Requirement: 文章状态机与写操作约束

新建文章 SHALL 生成正文与标签关系；更新 SHALL 重算字数与阅读时长并整体替换标签关系；发布（`status=1`）SHALL 在 `publish_time` 为空时写入当前时间，撤回（`status=0`）SHALL NOT 修改已有的 `publish_time`；删除 SHALL 同时删除正文与标签关系，SHALL NOT 留下孤立记录。全部写操作 SHALL 在一个事务内完成。

#### Scenario: 发布写入发布时间

- **WHEN** 管理员发布一篇 `publish_time` 为空的草稿
- **THEN** 该文章的 `status` 变为 1 且 `publish_time` 被写入

#### Scenario: 撤回不改发布时间

- **WHEN** 管理员撤回一篇已发布文章再重新发布
- **THEN** 撤回期间 `publish_time` 保持不变

#### Scenario: 删除不留孤立正文

- **WHEN** 管理员删除一篇文章
- **THEN** 该文章的正文与标签关系都不再存在

### Requirement: slug 的唯一性与生成规则

`slug` SHALL 在「类型 + slug」维度上唯一，唯一性 SHALL 由数据库唯一约束兜底（而不是仅靠先查后插）。当请求未提供 slug 且标题含拉丁字母或数字时，系统 SHALL 由标题生成 kebab-case slug；当标题**不含**可用拉丁字符时，系统 SHALL NOT 猜测拼音，而 SHALL 返回参数错误要求调用方填写。新建与更新遇到重复 slug SHALL 返回冲突（业务码 40901，HTTP 409）。

#### Scenario: 重复 slug 被拒

- **WHEN** 用已存在的 slug 新建文章
- **THEN** 返回 40901 且 HTTP 状态码为 409

#### Scenario: 中文标题不猜拼音

- **WHEN** 标题为纯中文且未提供 slug
- **THEN** 返回参数错误（40001），提示需要填写 slug

### Requirement: 标签按名字解析或创建

写接口 SHALL 接受标签**名字**数组；系统 SHALL 为每个名字解析已有标签或在不存在时创建它，并重建该文章的标签关系；同一篇文章的标签数量 SHALL 有上限（6 个），重复名字 SHALL 只保留一个。

#### Scenario: 新标签被自动创建

- **WHEN** 保存文章时带一个库中不存在的标签名
- **THEN** 该标签被创建并与文章关联

#### Scenario: 标签数超限被裁剪

- **WHEN** 保存文章时提交 9 个不同标签
- **THEN** 该文章最多关联 6 个标签

### Requirement: 写操作留审计

每一项后台写操作（登录、登出、新建、更新、发布撤回、删除、上传）SHALL 在同一事务内写入一条审计记录，记录 SHALL 包含操作者、动作、目标类型与目标 ID、IP 与 User-Agent；审计表 SHALL 只追加，SHALL NOT 被更新或删除。

#### Scenario: 新建文章留下审计

- **WHEN** 管理员新建一篇文章
- **THEN** 审计表中存在一条动作为新建、目标为该文章 ID 的记录

#### Scenario: 审计记录带操作者

- **WHEN** 检查任一审计记录
- **THEN** 它的操作者 ID 与发起该操作的登录账号一致

### Requirement: 图片上传的安全约束

上传接口 SHALL 只接受白名单内的图片扩展名（jpg / jpeg / png / webp / gif），SHALL 校验文件头（magic bytes）与扩展名一致，SHALL 拒绝超过大小上限的文件，SHALL 重命名落盘（不沿用原始文件名），SHALL 拒绝含路径分隔符或 `..` 的文件名。上传结果 SHALL 返回**对外可访问的完整 URL**（含服务端 context-path 前缀），使该 URL 可直接写进 Markdown 正文。

#### Scenario: 扩展名伪造被拒

- **WHEN** 上传一个扩展名为 `.png` 但内容不是图片的文件
- **THEN** 返回参数错误，且磁盘上不产生文件

#### Scenario: 返回的 URL 可直接访问

- **WHEN** 上传一张合法图片后访问返回的 URL
- **THEN** 能取到该图片（而不是 404）

#### Scenario: 超限文件被拒

- **WHEN** 上传超过大小上限的文件
- **THEN** 返回参数错误且不落盘

### Requirement: 后台操作只走 POST 与 GET

后台写接口 SHALL 只使用 `POST`，读取 SHALL 只使用 `GET`；状态迁移 SHALL 用路径后缀表达（如 `/publish`、`/delete`）。系统 SHALL NOT 暴露 `PUT` / `PATCH` / `DELETE` 映射。

#### Scenario: 写操作是 POST

- **WHEN** 检查后台新建、更新、发布、删除接口的 HTTP 方法
- **THEN** 它们全部是 POST
