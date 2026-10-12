# 本地跑起来（RUNBOOK）

> 本文件是**本机环境专属**的运行手册 —— 记的是这台机器上踩过的坑与确切命令。
> 通用规划见 `docs/项目前期规划.md`，验收判据见 `docs/phase3-effect-matrix.md`。
>
> **端口约定：后端 8091 / 前端 8099。** 这套口径来自 `deploy/` 下的部署脚本（服务器上后端靠
> `--server.port=8091` 覆盖，前端 `vite preview` 起在 8099），`vite.config.ts` 的
> `server.port` / `preview.port` 与 `/api` 代理目标都已按这套口径对齐，**本地照抄即可，别用 8080/5173**。

## 0. 前置依赖（本机已装好，通常不用管）

| 依赖 | 地址 | 说明 |
| --- | --- | --- |
| MySQL 8 | `127.0.0.1:3306` | 库名 `jcpress`，账号 `root` / `123456`（见 `application-dev.yml`） |
| Redis 7 | `127.0.0.1:6379` | Sa-Token 会话 + 浏览量去重，**必须 ≥6.0** |
| JDK 17 | `C:\Program Files\Java\jdk-17` | **本机 `JAVA_HOME` 默认指向 JDK 8，必须显式指定** |
| Node | 22.x | 前端构建 |

自查（都应看到 LISTENING）：

```bash
netstat -ano | grep LISTENING | grep -E ":3306|:6379"
```

数据库没建过也不用管：后端启动时 Flyway 会自动跑 `V1__init_schema.sql` + `V2__seed_data.sql`。

## 1. 起后端（端口 8091）

```bash
# ⚠️ 关键：必须显式指定 JDK 17。本机默认 JAVA_HOME 是 corretto-1.8.0_452（JDK 8），
#    不指定会以 JDK 8 启动并失败。
export JAVA_HOME="/c/Program Files/Java/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"

cd backend
# 端口是运行时覆盖：application.yml 里写的是 8080，但前端 vite 代理指向 8091，必须对齐
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=8091"
```

验证：

```bash
curl -s http://127.0.0.1:8091/api/health
# 期望：{"code":0,"message":"ok","data":{"db":"UP","redis":"UP"},...}
```

## 2. 起前端（端口 8099）

**另开一个终端**：

```bash
cd frontend
npm install        # 首次或依赖变动后

# 关键：带 --configLoader runner。本机 EDR 拦 esbuild 子进程，而 vite 默认要用
# esbuild 去编译 vite.config.ts，于是普通 `npm run dev` 直接启动失败（winapi error #5）。
npm run dev -- --configLoader runner
```

前端通过 Vite 的 `/api` proxy 把请求转给 8091（见 `vite.config.ts`），所以只访问 8099 即可。

## 3. 打开页面

| 地址 | 页面 |
| --- | --- |
| http://localhost:8099/ | 首页（关于我） |
| http://localhost:8099/tech | 技术分享列表 |
| http://localhost:8099/tech/phase-3-backend-retro | 文章详情 |
| **http://localhost:8099/admin** | **后台入口**（自动跳 `/admin/articles`） |
| http://localhost:8099/admin/login | 后台登录页 |

**后台账号**：`admin` / `jcpress@2026`

> 注意：直接访问 `localhost:8091/admin` **打不开** —— 后端只有 `/api/**`，没有页面。

## 4. 跑测试

```bash
# 后端全量（111 个用例）；同样必须先 export JAVA_HOME
export JAVA_HOME="/c/Program Files/Java/jdk-17"
cd backend && ./mvnw -q -B test

# 前端类型检查
cd frontend && npx tsc --noEmit

# 前端单测（origin 配置加载会被 EDR 拦，同样要加 runner 模式）
cd frontend && npx vitest run --configLoader runner

# 前端浏览器验收（需要 8099 与 8091 都起着）
cd ..   # 回到仓库根
node .tmp/tools/audit-behavior.cjs      # 82 项
node .tmp/tools/audit-contrast.cjs      # 对比度（12 组，含后台两页）
node .tmp/tools/probe-docking.cjs       # 天体停靠
node .tmp/tools/shot-final.cjs .tmp/shots-p3
node .tmp/tools/probe-admin.cjs         # 后台全链路（登录→列表→编辑→发布→前台可见）
node .tmp/tools/shot-admin.cjs          # 后台三页截图
```

> 浏览器脚本需要 `playwright-core`，它装在用户级 `C:/Users/O/node_modules`（不在项目里）：
> 跑之前 `export NODE_PATH=C:/Users/O/node_modules`。
> `vite build` 在本机原样仍受 EDR 影响，未验证。
> 替代覆盖见 `docs/phase3-effect-matrix.md` 的「构建口子的说明」。

## 5. Markdown 导入器（CLI，非 web 模式）

```bash
export JAVA_HOME="/c/Program Files/Java/jdk-17"
cd backend
# 先干跑看清单
./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer -Dspring-boot.run.arguments="--dry-run"
# 真导入
./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer
```

## 6. 本机已知坑（踩过，别再踩）

| 坑 | 现象 | 处置 |
| --- | --- | --- |
| **JDK 版本** | `mvnw` 以 JDK 8 启动、编译失败 | `export JAVA_HOME="/c/Program Files/Java/jdk-17"` |
| **git 代理** | `git pull/push` 报 `Failed to connect to 127.0.0.1 port <旧端口>: Connection refused` | git 里配过写死的代理端口，会话间会失效。**本仓库已改为直连**（本机直连 github 实测通且更快），若再遇到就 `git config --unset http.proxy && git config --unset https.proxy` |
| **凭据助手名过时** | `git: 'credential-manager-core' is not a git command` | `git config --global credential.helper manager`（已修） |
| **前端 dev server / 测试报 `winapi error #5`** | `npm run dev`、`vitest run` 报 `failed to load config from vite.config.ts` + `Cannot read file "package.json": winapi error #5` | 本机 EDR 拦 **esbuild 子进程**读文件，**与代理无关**。但根因只有一环：vite 默认 `configLoader: bundle`，会用 esbuild 去编译 `vite.config.ts`。换成 runner 模式（Node 原生加载）即可绕开：<br>`npx vite --configLoader runner`（≈ `npm run dev -- --configLoader runner`）<br>`npx vitest run --configLoader runner`<br>**两者已于 2026-10-12 实测跑通**（dev server 起在 8099、模块转换与依赖预构建均正常，vitest 全量 42 例可跑）。`vite build` 未验证。<br>**别用 `esbuild --version` 判断环境可用性**（它不读文件所以永远成功） |
| **上传 URL 404** | 正文图片打不开 | 对外 URL 带 `/api` 前缀（`/api/uploads/...`），与静态映射路径 `/uploads` 是两个配置项 |

### git 代理（当前：直连）

本仓库**不配代理**，直接用直连。本机实测直连 github 通且比走代理更快（2026-10-12 验证）。

```bash
# 若哪天直连不通、必须走代理：环境提供的本地代理端口每次会话会变
env | grep -i proxy           # 拿当前端口（注意环境变量里的端口也可能过期）
netstat -ano | grep LISTENING | grep -E ":(7890|7897|10809)\b"   # 找真正在听的端口
git config http.proxy  http://127.0.0.1:<端口>
git config https.proxy http://127.0.0.1:<端口>
# 用完记得清掉，否则下次会话端口一变又连不上：
git config --unset http.proxy && git config --unset https.proxy
```

彻底摆脱这件事的办法：改用 SSH key，或把 remote 换成 `gh` 管理的地址。
