# 部署与远程开发

服务器 2 核 2G，MySQL 与 Redis 同机。下面的事情由硬件条件决定，不是偏好。

## 走哪条路

| | 服务器拉代码构建（主） | 本地构建上传（备） |
| --- | --- | --- |
| 命令 | `bash deploy/deploy-server.sh` | `JC_SERVER=jcpress bash deploy/publish.sh` |
| 代码从哪来 | `git pull` | 本机工作区，可以不提交 |
| 构建在哪跑 | 服务器 | 本机 |
| 一次多久 | 有缓存约 3–5 分钟 | 约 1 分钟（构建 + 上传） |
| 机器负担 | 构建期间变慢，走 swap | 服务器只接收文件 |
| 适用 | 日常发布、远程改代码 | 服务器构建失败、或想发未提交的改动 |

主路的好处是只有一个真相来源（GitHub），服务器上改完 `git commit && git push` 就和本地一致。备选路留着，因为本机有 EDR 拦 esbuild 的历史，反过来服务器上也存在构建失败的可能，那时至少还能用产物上传。

## 一次性准备

### 1. SSH 免密

本机已有 `~/.ssh/id_rsa`（能连 GitHub），推公钥：

```bash
ssh root@<服务器IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" < ~/.ssh/id_rsa.pub
```

`~/.ssh/config`：

```
Host jcpress
    HostName <服务器IP>
    User root
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 30
    ServerAliveCountMax 3
    Compression yes
```

`ServerAliveInterval` 这两行不能省：不配的话连接空闲几分钟会被中间设备断掉，Remote-SSH 卡在「Setting up SSH host」。

### 2. 初始化服务器

```bash
ssh jcpress 'bash -s' < deploy/server-init.sh
```

干的事：2G swap、`vm.swappiness=10`、inotify 上限、时区、JDK17 + Node 20 + nginx + git + rsync、`/etc/profile.d/jcpress.sh`（构建内存闸门）、`~/.m2/settings.xml`（HTTPS 阿里云镜像）。幂等，可以重复跑。

### 3. 拉代码

```bash
ssh jcpress 'git clone -b jcpress-test https://github.com/Jessiseb/jcpress.git /root/jcpress'
```

仓库是 public，clone 不需要凭据。要在服务器上 push 得另外配 key 或 token。

### 4. 填环境变量

```bash
ssh jcpress 'cp /root/jcpress/backend/.env.example /root/jcpress/backend/.env'
ssh jcpress 'vi /root/jcpress/backend/.env'
```

要填 `DB_PASSWORD`、`REDIS_PASSWORD`、`JCPRESS_AI_API_KEY`。`DB_HOST` 默认 `127.0.0.1`（MySQL 同机），不同机才改。

`.env` 在 `.gitignore` 里，不会被 `git pull` 覆盖。

### 5. nginx

```bash
scp deploy/nginx-jcpress.conf jcpress:/etc/nginx/conf.d/jcpress.conf
ssh jcpress 'nginx -t && systemctl enable --now nginx'
```

配置里几个固定做法：

- `proxy_pass http://127.0.0.1:8091;` **不带尾斜杠**。后端 `context-path: /api`，加了尾斜杠会把 `/api/x` 改写成 `/x`，全站 404。
- 上传图片走 `/api/uploads`（`jcpress.upload.public-prefix` 含 context-path），被 `/api/` 那条 location 覆盖，不用单独配。
- `index.html` 单独 `no-cache`。不设的话发版后用户拿到旧壳，指向已删除的旧 asset，白屏。
- `proxy_read_timeout 150s`，AI 生成文章实测 41s，`application.yml` 给到 120s。

## 日常部署

在服务器上：

```bash
bash /root/jcpress/deploy/deploy-server.sh              # 拉代码 + 构建 + 重启
bash /root/jcpress/deploy/deploy-server.sh --backend    # 只更后端
bash /root/jcpress/deploy/deploy-server.sh --frontend   # 只更前端
bash /root/jcpress/deploy/deploy-server.sh --no-pull    # 用当前代码重建
bash /root/jcpress/deploy/deploy-server.sh --restart-only
```

流程：`git pull --ff-only` → `mvnw clean package` → `tsc -b && vite build` → `remote-restart.sh` 落地产物并重启。

几个设计上的选择：

- **先构建成功再停旧进程**。构建失败时旧版本继续对外服务，脚本 `die` 退出，什么都不改。
- `git pull --ff-only`：分叉时直接失败，不在服务器上产生 merge commit。
- 构建日志写进 `.tmp/build-*.log`，失败时只打印最后 40 行，终端不会被 Maven 的进度条淹没。
- 落地产物复用 `remote-restart.sh`，`publish.sh` 和 `deploy-server.sh` 走同一套停启逻辑，不重复实现。
- 前端在服务器上**正常 minify**（服务器没有 EDR），产物比本机构建小得多。

## 2G 上的内存账目

| 项 | 内存 |
| --- | --- |
| 系统 + nginx | 200–300M |
| Spring Boot（`-Xmx512m`） | 700–800M |
| Maven 构建（`MAVEN_OPTS=-Xmx512m`） | 500–700M |
| Vite 构建（`NODE_OPTIONS=--max-old-space-size=768`） | 600–800M |
| vscode-server（Remote-SSH 连上时） | 250–400M |

后三项不能同时跑。脚本里是串行的，且构建期间后端仍在服务，峰值会吃到 swap —— 表现是**变慢**，不是崩溃。

内存上限不是拍脑袋定的：本机限到 512m 堆跑 `mvnw package` 49 秒成功，限到 768m 跑前端构建 59 秒成功。低于这个量级 Maven 会 `OutOfMemoryError`，`server-init.sh` 已经把它写进 `/etc/profile.d/jcpress.sh`，别再往上调。

## 备选：本地构建上传

服务器构建不出来时用。本机有 JDK17 和 `node_modules`，构建完只传一个 jar 和一个 tar 包。

```bash
JC_SERVER=jcpress bash deploy/publish.sh              # 全量
JC_SERVER=jcpress bash deploy/publish.sh --frontend
JC_SERVER=jcpress bash deploy/publish.sh --backend
JC_SERVER=jcpress bash deploy/publish.sh --no-build   # 传已有产物
```

本机构建有三个被迫的参数（2026-10-21 实测）：

| 参数 | 不加会怎样 |
| --- | --- |
| `--configLoader runner` | EDR 拦 esbuild 编译 `vite.config.ts` |
| `--minify false` | 默认压缩要写临时文件再读回，EDR 拦：`vite:esbuild-transpile` → `winapi error #5` |
| `--target esnext` | 同一条转译链路 |

代价是产物未压缩（`AdminArticleEditPage` 1.45MB / gzip 369KB）。另外 `vite build` 失败会**先清空 `dist`**，失败后别接着 `--no-build`。

## 远程开发

VS Code + Remote-SSH，本机还没装：

```powershell
winget install --id Microsoft.VisualStudioCode -e
```

```bash
code --install-extension ms-vscode-remote.remote-ssh
```

`F1` → `Remote-SSH: Connect to Host...` → `jcpress` → 打开 `/root/jcpress`。首次连接会在服务器下 `~/.vscode-server`（约 100MB），2G 机器上要等一两分钟。

**服务器端不要装**：Extension Pack for Java、Java Language Support（Maven 导入 1G 起）、ESLint、GitLens。都装在 LOCAL 那栏。`.vscode/settings.json` 里已经关掉 `java.import.maven.enabled`，是第二道保险。

Remote-SSH 的定位是**改代码、看日志、跑 `deploy-server.sh`**，不是在那儿开着 Maven 边改边编译。

## 安全须知

仓库是 **public**，下面这些已经在提交历史里了，删文件不会消除：

1. `backend/src/main/resources/db/migration/V2__seed_data.sql` 里 `admin` 账号的 BCrypt 哈希。哈希本身不能直接反推，但如果对应弱口令，public 仓库等于给了离线爆破的样本。**上线第一件事就是改后台密码为强口令。**
2. 旧版 `application-prod.yml` 里写死过服务器公网 IP。现在改成了 `${DB_HOST:127.0.0.1}`，但历史提交里仍有。云安全组记得只放行 80/443/22。

想彻底解决只能把仓库转 private（GitHub → Settings → General → Danger Zone → Change visibility），历史会跟着一起隐藏。这件事没做，等你决定。

## 换行符

本机 `core.autocrlf=true`，脚本 checkout 出来是 CRLF，传到 Linux 报 `\r: command not found`。仓库已加 `.gitattributes` 把 `*.sh` / `*.conf` / `*.yml` 钉成 `eol=lf`，`publish.sh` 上传后还会再 `sed -i 's/\r$//'` 一次。

## 还没做的

- HTTPS。需要域名解析到这台机器，然后 `certbot --nginx -d 域名`，加 443 的 server 块。
- 数据库备份。MySQL 数据目前只在服务器上，没有定时 dump。
- 部署没有回滚命令。`remote-restart.sh` 会留一份 `app.jar.prev`，手工 `mv` 回去再重启即可，但没做成脚本。
- `deploy/deploy-backend.sh` 和 `deploy/deploy-frontend.sh` 是早期版本，已被 `deploy-server.sh` 取代，保留未删。后者用 `vite preview` 对公网，不要再用。
