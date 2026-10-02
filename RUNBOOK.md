# 本地跑起来（RUNBOOK）

> 本文件是**本机环境专属**的运行手册 —— 记的是这台机器上踩过的坑与确切命令。
> 通用规划见 `docs/项目前期规划.md`，验收判据见 `docs/phase3-effect-matrix.md`。

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

## 1. 起后端（端口 8080）

```bash
# ⚠️ 关键：必须显式指定 JDK 17。本机默认 JAVA_HOME 是 corretto-1.8.0_452（JDK 8），
#    不指定会以 JDK 8 启动并失败。
export JAVA_HOME="/c/Program Files/Java/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"

cd backend
./mvnw spring-boot:run
```

验证：

```bash
curl -s http://127.0.0.1:8080/api/health
# 期望：{"code":0,"message":"ok","data":{"db":"UP","redis":"UP"},...}
```

## 2. 起前端（端口 5173）

**另开一个终端**：

```bash
cd frontend
npm install        # 首次或依赖变动后
npm run dev
```

前端通过 Vite 的 `/api` proxy 把请求转给 8080（见 `vite.config.ts`），所以只访问 5173 即可。

## 3. 打开页面

| 地址 | 页面 |
| --- | --- |
| http://localhost:5173/ | 首页（关于我） |
| http://localhost:5173/tech | 技术分享列表 |
| http://localhost:5173/tech/phase-3-backend-retro | 文章详情 |
| **http://localhost:5173/admin** | **后台入口**（自动跳 `/admin/articles`） |
| http://localhost:5173/admin/login | 后台登录页 |

**后台账号**：`admin` / `jcpress@2026`

> 注意：直接访问 `localhost:8080/admin` **打不开** —— 后端只有 `/api/**`，没有页面。

## 4. 跑测试

```bash
# 后端全量（111 个用例）；同样必须先 export JAVA_HOME
export JAVA_HOME="/c/Program Files/Java/jdk-17"
cd backend && ./mvnw -q -B test

# 前端类型检查
cd frontend && npx tsc --noEmit

# 前端浏览器验收（需要 5173 与 8080 都起着）
cd ..   # 回到仓库根
node .tmp/tools/audit-behavior.cjs      # 82 项
node .tmp/tools/audit-contrast.cjs      # 对比度
node .tmp/tools/probe-docking.cjs       # 天体停靠
node .tmp/tools/shot-final.cjs .tmp/shots-p3
```

> `vitest run` / `vite build` 在本机跑不动（EDR 拦 esbuild 子进程读文件，`winapi error #5`）。
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
| **git 不走代理** | `git push/fetch` 报 `Connection reset` / `Empty reply` | git **不读** `http_proxy` 环境变量，要单独配：见下 |
| **凭据助手名过时** | `git: 'credential-manager-core' is not a git command` | `git config --global credential.helper manager`（已修） |
| **vitest / vite build 跑不动** | esbuild 子进程被 EDR 拦（`winapi error #5`） | 用 `.tmp/tools/` 下的浏览器审计替代；**别用 `esbuild --version` 判断环境可用性**（它不读文件所以永远成功） |
| **上传 URL 404** | 正文图片打不开 | 对外 URL 带 `/api` 前缀（`/api/uploads/...`），与静态映射路径 `/uploads` 是两个配置项 |

### git 代理

环境提供的本地代理端口**每次会话会变**，所以：

```bash
# 1) 拿当前端口
env | grep -i proxy

# 2) 配到 git（仅当前仓库）
git config http.proxy  http://127.0.0.1:<端口>
git config https.proxy http://127.0.0.1:<端口>
```

彻底摆脱这件事的办法：改用 SSH key，或把 remote 换成 `gh` 管理的地址。
