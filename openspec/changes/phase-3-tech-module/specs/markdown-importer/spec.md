# Spec Delta

## Purpose

Markdown 导入器：让仓库里的 Markdown 源文件（可 diff、可回滚）能以一条命令幂等地灌进数据库，与后台写入口共存而不互相破坏。

## ADDED Requirements

### Requirement: 导入器不暴露 HTTP 接口

导入器 SHALL 以命令行方式运行（同一个人可执行产物 + 独立 profile），SHALL NOT 暴露任何 HTTP 端点；未提供导入参数时 SHALL 静默退出，SHALL NOT 影响 Web 应用的正常运行。

#### Scenario: 不带参数启动不干活

- **WHEN** 以导入器 profile 启动但未提供导入目录参数
- **THEN** 进程正常结束且未写入任何内容

#### Scenario: 没有 HTTP 端点

- **WHEN** 检查导入器相关的控制器或路由
- **THEN** 不存在任何导入相关的 HTTP 端点

### Requirement: front-matter 约定与必填校验

导入的每个 Markdown 文件 SHALL 以 `---` 包裹的 front-matter 开头。`title`、`slug`、`category` SHALL 为必填；`slug` SHALL 满足小写字母/数字/连字符且长度 3–120；`status` SHALL 只取 `DRAFT`/`PUBLISHED`/`ARCHIVED`。任一文件不满足上述任一条，SHALL 以包含**文件名**的错误信息终止本次导入。

#### Scenario: 缺少 front-matter 被拒

- **WHEN** 目录中存在一个不以 `---` 开头的 `.md` 文件
- **THEN** 导入终止且错误信息包含该文件名

#### Scenario: 分类不存在被拒

- **WHEN** front-matter 里的 `category` 在分类表中不存在
- **THEN** 导入终止且错误信息指出分类不存在

#### Scenario: 空目录被拒

- **WHEN** 导入目录下没有任何 `.md` 文件
- **THEN** 导入终止并给出明确错误

### Requirement: 按类型与 slug 幂等

导入 SHALL 以「类型 + slug」为身份：不存在则新建（同时写入正文），已存在则更新（标题、摘要、分类、发布时间、状态与正文），SHALL NOT 产生重复记录。重复执行同一次导入 SHALL 只更新而不新增。导入器 SHALL NOT 删除任何已发布内容。

#### Scenario: 首次导入为新增

- **WHEN** 对一个尚未导入的目录执行导入
- **THEN** 报告新增数量大于 0，且库中出现对应文章

#### Scenario: 再次导入为更新

- **WHEN** 对同一目录再次执行导入
- **THEN** 报告新增为 0、更新为原有篇数

#### Scenario: 不删除已发布内容

- **WHEN** 导入目录中缺少库里已有的一篇已发布文章
- **THEN** 该文章仍然存在且未被修改

### Requirement: dry-run 不写库

提供 `--dry-run` 参数时，导入器 SHALL 只解析与校验并输出**将发生的动作**（新增 / 更新 + slug + 文件名），SHALL NOT 写入数据库。

#### Scenario: dry-run 后数据不变

- **WHEN** 用 `--dry-run` 运行一次导入，随后检查数据库
- **THEN** 文章数量与内容都没有变化
- **AND** 标准输出里能看到"将处理 N 个文件"的清单

### Requirement: 校验失败整批回滚

导入 SHALL 分两段：先对目录内**全部**文件做解析与校验，全部通过后才在**单个事务**内落库。任一文件校验失败 SHALL 导致整批不写库（SHALL NOT 出现"前几个文件已写入、后面的失败"）。

#### Scenario: 坏文件导致整批不写

- **WHEN** 目录中一个文件合法、另一个文件的分类不存在
- **THEN** 合法文件也没有被写入数据库

### Requirement: 导入结果可读

导入结束 SHALL 输出计数报告（新增 / 更新 / 跳过 / 失败），失败项 SHALL 附带文件名与原因；发布状态的文章 SHALL 保证 `publish_time` 非空（front-matter 未给出时取导入时刻），使它能出现在公开列表里。

#### Scenario: 报告包含四类计数

- **WHEN** 导入完成
- **THEN** 输出包含新增、更新、跳过、失败四项计数

#### Scenario: 已发布但未给时间的文章仍可见

- **WHEN** front-matter 标记为 `PUBLISHED` 但没有 `publishTime`
- **THEN** 导入后的该文章 `publish_time` 非空，且出现在公开列表中
