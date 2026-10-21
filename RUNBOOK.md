# 本地跑起来（RUNBOOK）

> 本文件是**本机环境专属**的运行手册 —— 记的是这台机器上踩过的坑与确切命令。
> 通用规划见 `docs/项目前期规划.md`，验收判据见 `docs/phase3-effect-matrix.md`。
>
> **端口约定：后端 8091 / 前端 8099。** 这套口径来自 `deploy/` 下的部署脚本（服务器上后端靠
> `--server.port=8091` 覆盖，前端本地 `vite preview` 起在 8099；上线后静态文件改由 nginx 的 80 端口托管，
> 见第 7 节），`vite.config.ts` 的
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
# ⚠️ 但先清掉 SERVER__PORT —— 宿主会话会注入它（等价于 server.port），会盖掉这里的指定，
#    表现为启动时报 "Port 57196 was already in use"（57196 就是宿主自己占的端口）
unset SERVER__PORT SERVER_PORT

# AI 排版是可选能力：不配这个 key 应用照样启动，只是后台「AI 排版」会报 50002 AI 服务未配置
export JCPRESS_AI_API_KEY='sk-你的key'

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

> **`node_modules/.vite` 不要删**（2026-10-20 实测）：这个缓存里是依赖预构建产物，而预构建
> 是 esbuild 干的活 —— 本机 EDR 现在**禁止 esbuild.exe 读任何文件**（连 `package.json` 都
> `winapi error #5`，而同一个文件用 Node 的 `fs` 读完全正常）。缓存还在时 dev 能起，是因为
> 跳过预构建、模块转换走 stdin；一旦缓存没了就再也建不起来。
> 起不来时的替代路径（已实测）：
>
> ```bash
> npx vite build --configLoader runner --target esnext --minify false   # rollup 打包，esbuild 只做 transform
> npx vite preview --configLoader runner                                # 预览块也有 /api 代理，仍走 8099
> ```
>
> 根治要管理员给项目目录或 esbuild 加排除：`Add-MpPreference -ExclusionPath "C:\Users\O\Desktop\myproject\jcpress"`。

前端通过 Vite 的 `/api` proxy 把请求转给 8091（见 `vite.config.ts`），所以只访问 8099 即可。

> **起完立刻跑一次模块体检（建议）**：
>
> ```bash
> cd .. && node .tmp/tools/probe-vite-modules.cjs   # 爬完整模块图，约 1 秒
> ```
>
> 为什么要跑：后台各页是 `React.lazy` 懒加载的，它们的模块**只在你第一次导航过去时才被 Vite 读取**。
> 而冷进程的首次文件读取会被本机实时防护拦一下，报 `EPERM: operation not permitted, open ...`，
> 表现是**只有那一个页面**白屏 + 浏览器弹一个错误遮罩 —— 首页、接口、健康检查全都正常。
> 这个命令把整张模块图（含懒加载路由块）爬一遍：既做体检（有模块编译不过就红），
> 也顺带把首次读取提前做掉，不给浏览器弹遮罩的机会。
>
> 万一遮罩还是出现了：按 Esc 或刷新页面即可，重新发起的请求会成功（不是代码问题）。

## 3. 打开页面

| 地址 | 页面 |
| --- | --- |
| http://localhost:8099/ | 首页（关于我） |
| http://localhost:8099/tech | 技术分享列表（目录式索引，一行一篇；**没有左栏**） |
| http://localhost:8099/tech/phase-3-backend-retro | 文章详情（**左栏目录** + 正文 + 右栏页内目录） |
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
node .tmp/tools/audit-behavior.cjs      # 84 项
node .tmp/tools/audit-contrast.cjs      # 对比度（12 组，含后台两页）
node .tmp/tools/probe-docking.cjs       # 天体停靠
node .tmp/tools/shot-final.cjs .tmp/shots-p3
node .tmp/tools/probe-admin.cjs         # 后台全链路（登录→列表→编辑→发布→前台可见）
node .tmp/tools/probe-admin-scroll.cjs  # 后台外壳：文档不可滚 / 导航与顶栏与标签条固定 / 切页回顶部（11 条）
node .tmp/tools/shot-admin.cjs          # 后台三页截图
node .tmp/tools/probe-vite-modules.cjs  # 模块图体检（108 个模块能否编译，含懒加载路由）
node .tmp/tools/probe-route-render.cjs  # 5 条路由真实渲染体检（无编译遮罩 / 无失败请求）
node .tmp/tools/shot-tech.cjs           # 技术分享整段截图（列表/详情 × 亮暗 + 窄屏）
node .tmp/tools/probe-tech-rail.cjs     # 技术分享左栏归属（列表无 / 详情有）+ 与首页同一条装订线
node .tmp/tools/probe-tech-top.cjs      # 技术分享三页 h1 距导航底的净距（列表 ≈ 首页，3 条判据）
node .tmp/tools/probe-exp-photo.cjs     # 首页实习照片：四视口框比例 / 底部实底高度 / 照片可见占比
node .tmp/tools/probe-photo-margins.cjs # 首页实习照片：复现 cover 裁切，逐视口报 logo 左右余量（<20px 即失败）
node .tmp/tools/probe-logo-bounds.cjs   # 量照片里 logo 的外接矩形（换公司照片后重跑，填回上面那支的 LOGO_SAFE）
node .tmp/tools/shot-exp-photo.cjs      # 首页实习照片六格截图（四视口 + 暗色 + 整块）
node .tmp/tools/shot-article.cjs <slug> # 单篇文章详情页：亮/暗/窄屏三张截图 + h2/代码块/表格计数
node .tmp/tools/probe-article-measure.cjs # 详情页宽度分配（容器/左栏/正文/TOC/每行汉字数）
node .tmp/tools/probe-detail-bp.cjs      # 详情页在 1080/1079/1024/768 四档的正文宽与每行汉字数（断点两侧）
node .tmp/tools/probe-md-toolbar.cjs     # 后台 Markdown 工具条：13 按钮 + 快捷键 + 链接/代码块/表格，亮暗各一遍（20 条）
node .tmp/tools/make-company-photo.cjs  # 公司照片 → webp（借 Chromium 编码器，零新依赖）
node .tmp/tools/make-readme-shots.cjs   # 重生成 README 预览图 → docs/assets/（现截 + 转 webp）
```

> 浏览器脚本需要 `playwright-core`，它装在用户级 `C:/Users/O/node_modules`（不在项目里）：
> 跑之前 `export NODE_PATH=C:/Users/O/node_modules`。
> `vite build` 在本机原样仍受 EDR 影响，未验证。
> 替代覆盖见 `docs/phase3-effect-matrix.md` 的「构建口子的说明」。

## 5. Markdown 导入器（CLI，非 web 模式）

```bash
export JAVA_HOME="/c/Program Files/Java/jdk-17"
cd backend
# 先干跑看清单（只解析校验，一个字节都不写库）
./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer -Dspring-boot.run.arguments="--import=../content/tech --dry-run"
# 真导入
./mvnw -q spring-boot:run -Dspring-boot.run.profiles=importer -Dspring-boot.run.arguments="--import=../content/tech"
```

`--import` 是必填的：不带这个参数进程会静默退出（它挂在正常启动流程里也不会误触发）。

- **幂等**：按 `(type, slug)` upsert，同一目录重复导入不会产生重复文章；标签是「先清后写」，也不会累积。
- **不删除**：目录里少了一个文件，库里的文章不会被删。
- **front-matter 必填** `title` / `slug` / `category`（填分类的 slug，如 `java-backend`）/ `summary` / `status`。
- `publishTime` 写不写引号都行（`2026-10-20 19:30:00` 直接写即可，2026-10-20 修掉了 SnakeYAML 把时间戳解析成 `Date` 导致报格式错的坑）。
- 新增文章后可用 `node .tmp/tools/shot-article.cjs <slug>` 截图核对前台渲染。

## 6. 本机已知坑（踩过，别再踩）

| 坑 | 现象 | 处置 |
| --- | --- | --- |
| **JDK 版本** | `mvnw` 以 JDK 8 启动、编译失败 | `export JAVA_HOME="/c/Program Files/Java/jdk-17"` |
| **git 代理** | `git pull/push` 报 `Failed to connect to ...:443` 或 `schannel: server closed abruptly` 或 `CONNECT tunnel failed, response 502` | 环境会注入 `http_proxy/https_proxy=127.0.0.1:64274`，那个端口连不上 github。直连 443 也不通。**实际可用的是 7890**，见下面「git 代理」一节 |
| **凭据助手名过时** | `git: 'credential-manager-core' is not a git command` | `git config --global credential.helper manager`（已修） |
| **前端 dev server / 测试报 `winapi error #5`** | `npm run dev`、`vitest run` 报 `failed to load config from vite.config.ts` + `Cannot read file "package.json": winapi error #5` | 本机 EDR 拦 **esbuild 子进程**读文件，**与代理无关**。但根因只有一环：vite 默认 `configLoader: bundle`，会用 esbuild 去编译 `vite.config.ts`。换成 runner 模式（Node 原生加载）即可绕开：<br>`npx vite --configLoader runner`（≈ `npm run dev -- --configLoader runner`）<br>`npx vitest run --configLoader runner`<br>**两者已于 2026-10-12 实测跑通**（dev server 起在 8099、模块转换与依赖预构建均正常，vitest 全量 42 例可跑）。`vite build` 未验证。<br>**别用 `esbuild --version` 判断环境可用性**（它不读文件所以永远成功）<br>**2026-10-20 更新**：runner 模式只解决「编译配置文件」这一环。**依赖预构建**同样要 esbuild 读 `node_modules`，现在这一步也被拦（15 个入口全部 `winapi error #5`），所以 `node_modules/.vite` 一旦被删，dev server 就再也起不来 —— 替代路径见上面「启动」一节。`vite build --target esnext --minify false` 可以跑完（rollup 负责读文件） |
| **上传 URL 404** | 正文图片打不开 | 对外 URL 带 `/api` 前缀（`/api/uploads/...`），与静态映射路径 `/uploads` 是两个配置项 |
| **`SERVER__PORT` 覆盖端口**（2026-10-13 实测） | 后端报 `Port 57196 was already in use`，但 57196 不是项目里任何配置 | 宿主（WorkBuddy）会往环境里注入 `SERVER__PORT`，Spring Boot 的 relaxed binding 让它等价于 `server.port`，直接盖掉配置值。起服务前 `unset SERVER__PORT SERVER_PORT` |
| **`mvnw` 拉不到新依赖**（2026-10-13 实测） | `mvnw dependency:get` 报 `Could not find artifact ... in alimaven`，现象像"坐标写错了" | `settings.xml` 里配的是 **HTTP** 阿里云镜像，而 `mvnw` 用的 Maven 3.8.1 会拦 HTTP 镜像。**用系统 `mvn`（3.6.3，不拦）即可**，代价是要自己 `export JAVA_HOME` 指到 JDK 17。已有依赖在本地仓库 `D:\maven\repository`，`mvnw` 日常编译不受影响 |

### git 代理（当前：只能用 7890）

2026-10-21 实测的三种情况，别在其他两种上浪费时间：

| 方式 | 结果 |
| --- | --- |
| 环境变量里的 `127.0.0.1:64274` | `CONNECT tunnel failed, response 502` / `schannel: server closed abruptly` |
| 清空环境变量直连 | `Failed to connect to github.com:443 after 21061 ms` |
| `127.0.0.1:7890` | 正常，`ddc64ef..49f5615 jcpress-test -> jcpress-test` |

环境变量里的代理每次会话可能变，**不要**写进 `git config`（写死后端口一变就全挂）。只在单次命令上挂：

```bash
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin jcpress-test
```

找可用端口：

```bash
netstat -ano | grep LISTENING | grep -E ":(7890|7897|10809)"
curl -x http://127.0.0.1:<端口> -sI -m 20 https://github.com | head -1
```

彻底摆脱这件事的办法：把 `~/.ssh/id_rsa.pub` 加到 GitHub 账号，remote 换 SSH。现在这个 key 不在账号里（`ssh -T git@github.com` 报 `Permission denied (publickey)`），所以暂时只能走代理。

## 7. 部署上线（服务器拉代码构建）

服务器是 2 核 2G 裸机，构建跑在服务器上（有内存闸门），日常一条命令。完整步骤见 **`deploy/REMOTE-DEV.md`**。

```bash
# 首次：四步，见 REMOTE-DEV.md 的「一次性准备」
ssh jcpress 'bash -s' < deploy/server-init.sh        # swap + JDK17 + Node20 + nginx + Maven 镜像
ssh jcpress 'git clone -b jcpress-test https://github.com/Jessiseb/jcpress.git /root/jcpress'
ssh jcpress 'cp /root/jcpress/backend/.env.example /root/jcpress/backend/.env'
scp deploy/nginx-jcpress.conf jcpress:/etc/nginx/conf.d/jcpress.conf

# 日常：在服务器上跑
bash /root/jcpress/deploy/deploy-server.sh           # git pull → 构建 → 重启
bash /root/jcpress/deploy/deploy-server.sh --backend # 只更后端
```

脚本关系：`deploy-server.sh`（服务器侧编排）→ `remote-restart.sh`（落地产物 + 停启）。本机构建上传的 `publish.sh` 也调 `remote-restart.sh`，两条路共用一套停启逻辑。

**构建内存闸门**（写进 `/etc/profile.d/jcpress.sh`，是实测下限，别往上调）：

| 变量 | 值 | 依据 |
| --- | --- | --- |
| `MAVEN_OPTS` | `-Xmx512m -Xms256m` | 本机限 512m 堆跑通 `mvnw package`，49s |
| `NODE_OPTIONS` | `--max-old-space-size=768` | 本机限 768m 堆跑通 `tsc -b && vite build`，59s |

2G 上前端构建和后端构建不能同时跑。脚本里是串行的；构建期间后端仍在服务，峰值吃 swap，表现是变慢而不是崩。

**本机构建（备选）的三条限制**（2026-10-21 实测，都不是可选项）：

| 参数 | 不加会怎样 |
| --- | --- |
| `--configLoader runner` | EDR 拦 esbuild 编译 `vite.config.ts`，构建卡在配置加载 |
| `--minify false` | 默认的 esbuild 压缩要写临时文件再读回，被 EDR 拦：`vite:esbuild-transpile` → `winapi error #5` |
| `--target esnext` | 同一条转译链路，避免语法降级 |

代价是产物未压缩（`AdminArticleEditPage` 1.45MB / gzip 369KB）。另外 `vite build` **失败会先清空 `dist`**，失败后别接着用 `--no-build`。

**换行符**：本机 `core.autocrlf=true`，脚本 checkout 出来是 CRLF，传到 Linux 报 `\r: command not found`。仓库已加 `.gitattributes` 把 `*.sh` / `*.conf` / `*.yml` 钉成 `eol=lf`。

**安全**：仓库是 public。`V2__seed_data.sql` 里 admin 账号的 BCrypt 哈希、旧版 `application-prod.yml` 里的公网 IP，都已经在提交历史里，删文件消不掉。上线第一件事是改后台密码为强口令；要彻底解决只能把仓库转 private。
