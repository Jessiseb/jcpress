<div align="center">

# jcpress
一个Vibe Coding出来个人网站
为了能方便地分享技术，所以才有了这个网站。
为了展示自己的技术能力，所以才有了这个网站。

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square)](https://react.dev/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.4-6DB33F?style=flat-square)](https://spring.io/projects/spring-boot)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat-square)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square)](https://redis.io/)

<img src="docs/assets/home-light.webp" alt="首页" width="880">

</div>

前端 React 18 + TypeScript + Vite 6，纯静态 SPA；后端 Spring Boot 3.3 + MySQL 8 + Redis 7，只提供内容读写接口。公开页面不用登录，后台单账号，账号在数据库里维护，没有注册入口。

## 目录

- [里面有什么](#里面有什么)
- [怎么跑起来](#怎么跑起来)
- [几个想过的取舍](#几个想过的取舍)
- [常用命令](#常用命令)
- [项目结构](#项目结构)
- [还没做好的地方](#还没做好的地方)
- [一些规矩](#一些规矩)
- [部署](#部署)
- [文档](#文档)
- [许可](#许可)

## 里面有什么

**首页**简历

**技术分享**

## 怎么跑起来

依赖：JDK 17、Node 18 以上、MySQL 8、Redis 6 以上。

### 建库

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS jcpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

表结构和种子数据由 Flyway 在启动时执行（`backend/src/main/resources/db/migration/`）。也可以手动建：`mysql -u root -p jcpress < deploy/init_schema.sql`。

### 起后端（:8091）

```bash
export JAVA_HOME=/path/to/jdk-17      # 必须是 17，本机这条经常指错
cd backend
./mvnw -q spring-boot:run -Dspring-boot.run.arguments="--server.port=8091"
```

```bash
curl -s http://127.0.0.1:8091/api/health
# {"code":0,"message":"ok","data":{"db":"UP","redis":"UP"},"traceId":"..."}
```

`application.yml` 里写的是 8080，**8091 是运行时覆盖的**。部署脚本、Vite 代理、验收脚本都按 8091 写死，本地起服务需保持一致，否则连不上。

### 起前端（:8099）

```bash
cd frontend
npm install
npm run dev        # → http://localhost:8099
```

`/api` 由 Vite 代理到 `127.0.0.1:8091`（`vite.config.ts` 里 `server.proxy` 和 `preview.proxy` 各配了一份），所以前后端同源，没有 CORS 问题。上传的图片也走这条代理。

### 跑验收

```bash
# 后端 111 个用例
export JAVA_HOME=/path/to/jdk-17 && cd backend && ./mvnw -q -B test

# 前端类型检查 + 单测（本机要加 --configLoader runner，原因见「还没做好的地方」）
cd frontend && npx tsc --noEmit
cd frontend && npx vitest run --configLoader runner

# 浏览器里的断言，需要 8099 和 8091 都在跑，从仓库根目录执行
node .tmp/tools/audit-behavior.cjs      # 84 项：路由、交互、触摸目标、无溢出
node .tmp/tools/audit-contrast.cjs      # 亮/暗两套主题的文字对比度
node .tmp/tools/audit-firstscreen.cjs   # 首屏不许加载编辑器和文章字体
node .tmp/tools/shot-final.cjs          # 四档视口截图 + 横向溢出巡检
```

这些脚本放在 `.tmp/tools/` 下（目录名像临时区，实际是 `.gitignore` 白名单放行的）。每加一条效果就补一个对应的判据脚本，不靠人工点一遍确认。

## 几个想过的取舍

**没用 Spring AI。** 装上试过：缺 api key 时整个应用起不来。这里的设计是「AI 可选，没配 key 也要能正常启动，调接口时返回 50002」，两者冲突。所以直接用 Spring 6.1 自带的 `RestClient` 调 OpenAI 兼容协议，没有新增依赖。

**没用 UI 组件库。** 全站 CSS Modules 加一套自定的 token。这个站的排版本身就是要做的部分，套组件库等于跳过。

**预渲染还没做，现在是纯 SPA。** `index.html` 里只有一个挂载点和一段首帧画主题的脚本。预渲染排在里程碑 M6，代码按「预渲染友好」写（首屏内容不依赖 JS 才存在），但功能尚未实现。

理由和当时的实测数据都记在 [`docs/decisions.md`](docs/decisions.md) 里，包括走错又退回来的那几次。

## 常用命令

前端（`frontend/`）：

| 命令 | 作用 |
| :-- | :-- |
| `npm run dev` | 开发服务器，:8099，带 `/api` 代理 |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | 预览构建产物，:8099 |
| `npm test` | Vitest 单测（本机要加 `--configLoader runner`） |
| `npm run fonts:build` | 重建 500 档中文衬线子集 |
| `npm run fonts:build:display` | 只重建展示字（700 档） |
| `npm run fonts:build:article` | 重建文章正文字体（GB2312 一级字） |

后端（`backend/`）：

| 命令 | 作用 |
| :-- | :-- |
| `./mvnw -q -B test` | 全量测试 |
| `./mvnw -q -DskipTests compile` | 只编译 |
| `./mvnw -q spring-boot:run -Dspring-boot.run.arguments="--server.port=8091"` | 起服务 |
| `./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer -Dspring-boot.run.arguments="--dry-run"` | Markdown 导入器，非 web 模式 |

## 项目结构

```text
jcpress/
├── frontend/                  # React SPA（含 /admin 路由）
│   ├── src/
│   │   ├── pages/             # home / tech / admin / 两个占位频道
│   │   ├── components/        # 按域分组：home、tech、admin、layout
│   │   ├── api/               # 请求层与类型
│   │   ├── hooks/             # useTechCatalog 等
│   │   ├── styles/            # 全局样式与 token 引入顺序
│   │   └── utils/             # Markdown 预览、结构计数
│   ├── scripts/               # 字体子集流水线：收字符 → 切 woff2
│   └── public/                # 字体、封面、公司照片、简历 PDF
├── backend/                   # Spring Boot
│   └── src/main/java/com/jcpress/
│       ├── web/portal/        # 公开读接口
│       ├── web/admin/         # 后台写接口，Sa-Token 保护
│       ├── service/ manager/  # 业务逻辑，每个业务一个 manager
│       ├── repository/        # MyBatis-Plus Mapper
│       ├── domain/            # DO / DTO / VO / Query / Converter
│       ├── infrastructure/    # 配置、Gson、存储、切面
│       └── importer/          # Markdown 导入器
├── content/                   # Markdown 源文件，供导入器灌库
├── design-system/             # 设计 token 与提取溯源
├── docs/                      # 规划、决策、效果矩阵、开发留痕
├── deploy/                    # 裸机部署脚本 + 建表 SQL
└── openspec/                  # 变更提案与归档
```

## 还没做好的地方

目前已知的问题：

**前端单测 59 例里有 15 例是红的。** 都在 `HomePage`、`AdminArticleEditPage`、`MarkdownBody` 三个文件里，三期改版之前就红了——用 `git show HEAD:` 把旧版取出来对照跑过，跟后面的改动无关，暂时没逐条修。现在靠 `tsc` 加浏览器断言兜着。

**后台编辑器的暗色模式有 31 处标点颜色不够。** 是 CodeMirror `basicSetup` 自带的浅色高亮（标点走 `#404740`）压不住暗底。要修得换一套跟着主题走的语法高亮，没做。

**本机 `vite build` 过不去。** EDR 会拦 esbuild 子进程读文件，报 `winapi error #5`。`vitest` 加 `--configLoader runner` 能绕开，build 没有等价开关，所以生产构建在服务器上跑。

**算法笔记、项目笔记的页面是空的。** 路由、导航、空态都在，内容待补。

## 一些规矩

几条固定约束：

- 视觉基线取自 [`golangstar.cn`](https://golangstar.cn/) 的结构和数值（VuePress + Theme Hope，MIT），只用 token 体系和数值关系，颜色与视觉签名另外做。溯源在 [`design-system/README.md`](design-system/README.md)。
- 字体自托管子集，两档真字重（500 / 700），拉丁字母走系统 Georgia。文章正文另有一套 GB2312 一级字子集，**只在文章详情页下载**，首页和列表页不请求，有反向断言守着。新增汉字要重跑字符表，否则那个字会掉回系统宋体，和旁边的字不同款。
- 手机上必须能用。每版都在 375 / 390 / 768 / 1280 四档下验收，触摸目标不小于 44px，代码块和表格横向滚动，不用 `overflow: hidden` 掩盖问题。
- 性能数字必须带测试环境。同一份代码，dev server 上跑 Lighthouse 是 30 分，生产构建是 98 分。

## 部署

没用 Docker，裸机脚本（服务器装好 JDK 17 和 Node 18+ 就行）：

```bash
bash deploy/deploy-backend.sh    # 停旧进程 → 拉代码 → 构建 → 起 jar（:8091）
bash deploy/deploy-frontend.sh   # 装依赖 → build → vite preview（:8099）
```

两个脚本顶部都有「按你实际环境改这里」的配置块：部署路径、分支、JDK 路径、JVM 参数、端口。密钥从部署机上的 `.env` 注入，不写在脚本里，仓库里也没留。

## 文档

- [`docs/项目前期规划.md`](docs/项目前期规划.md)：信息架构、系统架构、库表与 Redis 设计、接口契约、里程碑。改需求先改它。
- [`RUNBOOK.md`](RUNBOOK.md)：怎么起服务、全套验收脚本怎么跑、本机环境的坑。
- [`docs/decisions.md`](docs/decisions.md)：每条决策的理由和当时的实测数据。
- [`docs/dev-journal.md`](docs/dev-journal.md)：开发留痕，包括被推翻过什么、返工了几轮。
- [`docs/phase3-effect-matrix.md`](docs/phase3-effect-matrix.md)：每条效果的判据、复核命令、实测结果。


