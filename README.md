# jcpress

> 个人网站 —— 展示个人经历与技术栈，沉淀技术分享、项目笔记与生活经验。
> 当前状态：**前期规划完成，尚未编写业务代码**。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + React Router + TanStack Query |
| 后端 | Java 21 + Spring Boot 3 + Spring Security(JWT) + **Gson** + MyBatis-Plus |
| 存储 | MySQL 8（内容与用户） · Redis 7（会话 / 缓存 / 限流） |
| 部署 | Docker Compose（Nginx + Backend + MySQL + Redis） |

## 规划文档

| 文档 | 内容 |
| --- | --- |
| [`docs/项目前期规划.md`](docs/项目前期规划.md) | **唯一源**：设计基线、信息架构、系统架构、数据库设计、Redis 设计、鉴权与权限、API 契约、工程规范、部署、里程碑、风险、待确认决策 |
| [`design-system/README.md`](design-system/README.md) | 设计 token 的提取溯源、许可说明与已知缺口 |
| [`design-system/tokens.curated.css`](design-system/tokens.curated.css) | 可直接引入的 light + dark 双主题 token（建议作为前端基线） |

## 已确定的内容结构

导航：**关于我** · **技术分享**（按分类）· **项目笔记** · **生活经验**（按权限可见）

- `/` 关于我：Hero、技术栈矩阵、实习经历时间线、项目经历卡片、数据统计、联系方式
- `/tech` 技术分享：分类总览 → 分类列表 → 文章详情（Markdown + 代码高亮 + TOC）
- `/projects` 项目笔记：项目卡片墙 → 项目详情 → 关联笔记
- `/life` 生活经验：按 `PUBLIC / AUTHENTICATED / MEMBER / PRIVATE` 四级可见性过滤（**服务端强制**）

## 仓库结构（规划）

```text
jcpress/
├── docs/                # 前期规划与决策记录
├── design-system/       # 设计 token、提取产物与溯源说明
├── frontend/            # React SPA（待创建）
├── backend/             # Spring Boot 应用（待创建）
└── deploy/              # docker-compose、nginx、Dockerfile（待创建）
```

## 下一步

1. 确认 [`docs/项目前期规划.md` §14](docs/项目前期规划.md#14-待确认决策) 的 **D1–D7** 决策
2. 确定品牌主色，替换 token 基线里的参照站靛蓝
3. 启动 **M1 工程骨架**：前后端最小可运行工程 + Docker 依赖 + 统一响应/异常 + Gson 转换器

## 说明

- 设计基线提取自 `https://golangstar.cn/`（VuePress + VuePress Theme Hope，均为 MIT 许可），
  仅复用 token 结构与数值体系，品牌色与视觉签名将自行设计；详见规划文档 §2.7。
- 仓库中不提交任何密钥；数据库口令、JWT secret、对象存储 AK 一律通过环境变量注入。
