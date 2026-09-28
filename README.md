# jcpress

> 个人网站 —— 展示个人经历与技术栈，沉淀技术分享与项目笔记。
> 当前状态：**前期规划完成，尚未编写业务代码**。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + React Router + TanStack Query |
| 后端 | Java 21 + Spring Boot 3 + MyBatis-Plus + **Gson** + **Sa-Token**（仅后台登录用） |
| 存储 | MySQL 8（内容 + 后台账号） · Redis 7（Sa-Token 会话 / 缓存 / 限流） |
| 部署 | Docker Compose（Nginx + Backend + MySQL + Redis） |

## 规划文档

| 文档 | 内容 |
| --- | --- |
| [`docs/项目前期规划.md`](docs/项目前期规划.md) | **唯一源**：设计基线、信息架构、系统架构、数据库设计、Redis 设计、访问控制与后台认证（Sa-Token）、API 契约、后台管理系统、工程规范、部署、里程碑、风险、决策表 |
| [`design-system/README.md`](design-system/README.md) | 设计 token 的提取溯源、许可说明与已知缺口 |
| [`design-system/tokens.curated.css`](design-system/tokens.curated.css) | 可直接引入的 light + dark 双主题 token（建议作为前端基线） |

## 已确定的内容结构

导航：**关于我** · **技术分享**（按分类）· **项目笔记**

- `/` 关于我：Hero、技术栈矩阵、实习经历时间线、项目经历卡片、数据统计、联系方式
- `/tech` 技术分享：分类总览 → 分类列表 → 文章详情（Markdown + 代码高亮 + TOC）
- `/projects` 项目笔记：项目卡片墙 → 项目详情 → 关联笔记
- `/admin` 后台写入口：**需要账号登录**（Sa-Token），不出现在公开导航里
- 前台**无需登录**：全站公开可读，没有注册入口、没有内容可见性分级
- 生活经验频道**暂不实现**（决策 D2；可见性备选方案见规划文档[附录 C](docs/项目前期规划.md#附录-c生活经验可见性备选方案)）

## 内容维护方式（一期）

| 内容 | 怎么维护 |
| --- | --- |
| 技术分享 / 项目笔记 | 仓库写 `content/**/*.md` + front-matter，M1 的 **Markdown 导入器**灌库（可 diff、可回滚）；也可用后台写入口 |
| 后台写入口 | `/admin` 登录后写，M5 实现（**Sa-Token 账号登录**） |
| 简历数据 | Flyway seed / 直接 SQL |
| 后台账号 | 数据库手工维护，**不开放注册** |
| 完整管理后台 | **放在 M7，按需启动** —— 见规划文档 [§10](docs/项目前期规划.md#10-后台管理系统)（决策 D8） |

## 仓库结构（规划）

```text
jcpress/
├── docs/                # 前期规划与决策记录
├── design-system/       # 设计 token、提取产物与溯源说明
├── content/             # Markdown 源文件（技术文章 / 项目笔记，待创建）
├── frontend/            # React SPA，含 /admin 后台路由（待创建）
├── backend/             # Spring Boot 应用（待创建）
└── deploy/              # docker-compose、nginx、Dockerfile（待创建）
```

## 下一步

1. 确认 [`docs/项目前期规划.md` §15](docs/项目前期规划.md#15-待确认决策) 的 **D1、D3–D7** 决策（D2 生活经验暂不做、D8 后台分三步、D9 前台免登录 + 后台 Sa-Token 已定）
2. 确定品牌主色，替换 token 基线里的参照站靛蓝
3. 启动 **M1 工程骨架**：前后端最小可运行工程 + Docker 依赖 + 统一响应/异常 + Gson 转换器 + Markdown 导入器

## 说明

- 设计基线提取自 `https://golangstar.cn/`（VuePress + VuePress Theme Hope，均为 MIT 许可），
  仅复用 token 结构与数值体系，品牌色与视觉签名将自行设计；详见规划文档 §2.7。
- 仓库中不提交任何密钥；数据库口令、对象存储 AK、后台账号口令一律通过环境变量注入。
- 后端工程规范遵循《Java开发手册（黄山版）》：包结构按 **portal / admin 隔离**，
  并用 **P3C-PMD + ArchUnit** 在 CI 卡口（见规划文档 §11.4 分包架构、§11.5 符合性清单）。
