#!/usr/bin/env bash
# ============================================================================
# jcpress 本地一键发布：本地构建 → 上传产物 → 远程重启
#
# 为什么构建放本地：服务器 2 核 2G，mvn package 要 600M~1G 堆、vite build
# 也要 1G 上下，同时在跑就是被 OOM killer 杀。本机有 JDK17 + node_modules，
# 构建完只传一个 jar 和一个 dist 包，几十 MB。
#
# 用法：
#   JC_SERVER=root@1.2.3.4 bash deploy/publish.sh              # 全量发布
#   JC_SERVER=root@1.2.3.4 bash deploy/publish.sh --frontend   # 只更前端
#   JC_SERVER=root@1.2.3.4 bash deploy/publish.sh --backend    # 只更后端
#   JC_SERVER=root@1.2.3.4 bash deploy/publish.sh --no-build   # 不构建，传已有产物
#
# 前置：本地已配好 SSH 免密（见 deploy/REMOTE-DEV.md 第 1 步）
# ============================================================================

set -euo pipefail

# ---------------------------- 配置 ----------------------------
SERVER="${JC_SERVER:-}"
REMOTE_BASE="/root/jcpress"
REMOTE_TMP="/tmp/jcpress-publish"

# 本机 JDK17（Windows 上 Git Bash 里必须用 /c/ 风格路径给 mvnw；
# 如果环境里是 C:\... 这种 Windows 风格，这里会探测不到而重新找一遍）
if [ ! -x "${JAVA_HOME:-}/bin/java" ]; then
  for c in "/c/Program Files/Java/jdk-17" "/c/Program Files/Eclipse Adoptium/jdk-17"*; do
    if [ -x "${c}/bin/java" ]; then JAVA_HOME="$c"; break; fi
  done
fi
if [ -x "${JAVA_HOME:-}/bin/java" ]; then
  export JAVA_HOME
  export PATH="${JAVA_HOME}/bin:${PATH}"
else
  echo ">>> 警告：没找到 JDK17，后端构建可能失败（手工设 JAVA_HOME）"
fi
# 沙箱会注入 SERVER__PORT，等价于 server.port，会让本地构建期的测试/启动端口错乱
unset SERVER__PORT 2>/dev/null || true
# -------------------------------------------------------------

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info() { echo -e "${GREEN}>>>${NC} $*"; }
warn() { echo -e "${YELLOW}>>>${NC} $*"; }
die()  { echo -e "${RED}>>> 失败:${NC} $*" >&2; exit 1; }

DO_BACKEND=1; DO_FRONTEND=1; DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --backend)    DO_FRONTEND=0 ;;
    --frontend)   DO_BACKEND=0 ;;
    --no-build)   DO_BUILD=0 ;;
    -h|--help)    sed -n '2,17p' "$0"; exit 0 ;;
    *) die "未知参数: $arg" ;;
  esac
done

[ -n "$SERVER" ] || die "设置 JC_SERVER，例如：JC_SERVER=root@1.2.3.4 bash deploy/publish.sh"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# 1. 构建后端
# ---------------------------------------------------------------------------
JAR_PATH=""
if [ "$DO_BACKEND" -eq 1 ]; then
  if [ "$DO_BUILD" -eq 1 ]; then
    info "构建后端（跳过测试）"
    ( cd backend && bash mvnw -q clean package -Dmaven.test.skip=true ) || die "后端构建失败"
  fi
  JAR_PATH=$(ls backend/target/*.jar 2>/dev/null | grep -v -E 'sources|javadoc|original' | head -1 || true)
  [ -n "$JAR_PATH" ] || die "找不到 jar：backend/target/*.jar"
  info "后端产物 $(basename "$JAR_PATH") $(du -h "$JAR_PATH" | cut -f1)"
fi

# ---------------------------------------------------------------------------
# 2. 构建前端
#    下面三个参数都是被迫的，2026-10-21 逐个实测过：
#      1) --configLoader runner  EDR 拦 esbuild 编译 vite.config.ts，npm run build
#                                （= tsc -b && vite build）会卡在配置加载
#      2) --minify false         默认的 esbuild 压缩要写临时文件再读回，被 EDR 拦
#                                （vite:esbuild-transpile → winapi error #5）
#      3) --target esnext        同一条转译链路，避开语法降级
#    代价：产物未压缩。最大的 AdminArticleEditPage 1.45MB / gzip 369KB，
#    上线后靠 nginx gzip 兜底。要再小得装 terser 走非 esbuild 的压缩路径。
#    注意 vite 构建失败时会先清空 dist，所以失败后 dist 是空的，
#    别接着用 --no-build 传一份空目录上去。
# ---------------------------------------------------------------------------
DIST_TAR=""
if [ "$DO_FRONTEND" -eq 1 ]; then
  if [ "$DO_BUILD" -eq 1 ]; then
    info "构建前端"
    ( cd frontend && npx tsc -b ) || die "前端类型检查失败"
    ( cd frontend && npx vite build --configLoader runner --target esnext --minify false ) \
      || die "前端构建失败"
  fi
  [ -f frontend/dist/index.html ] || die "找不到 frontend/dist/index.html"
  DIST_TAR="$ROOT/.tmp/dist.tar.gz"
  mkdir -p "$ROOT/.tmp"
  info "打包前端产物"
  tar -czf "$DIST_TAR" -C frontend/dist .
  info "前端产物 $(du -h "$DIST_TAR" | cut -f1)"
fi

# ---------------------------------------------------------------------------
# 3. 上传
# ---------------------------------------------------------------------------
info "连接 $SERVER"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$SERVER" "mkdir -p '$REMOTE_TMP'" \
  || die "SSH 连不上或没配免密，先看 deploy/REMOTE-DEV.md 第 1 步"

# 服务器侧的部署脚本每次都同步一份最新版
scp -q deploy/remote-restart.sh "$SERVER:$REMOTE_TMP/remote-restart.sh"
# 本机 core.autocrlf=true，万一 checkout 出 CRLF，Linux 上会报 "\r: command not found"
ssh -o BatchMode=yes "$SERVER" "sed -i 's/\r\$//' '$REMOTE_TMP/remote-restart.sh'"

REMOTE_JAR=""
if [ -n "$JAR_PATH" ]; then
  info "上传 jar"
  scp -q "$JAR_PATH" "$SERVER:$REMOTE_TMP/app.jar"
  REMOTE_JAR="$REMOTE_TMP/app.jar"
fi

REMOTE_DIST=""
if [ -n "$DIST_TAR" ]; then
  info "上传前端产物"
  scp -q "$DIST_TAR" "$SERVER:$REMOTE_TMP/dist.tar.gz"
  REMOTE_DIST="$REMOTE_TMP/dist.tar.gz"
fi

# ---------------------------------------------------------------------------
# 4. 远程落地 + 重启
# ---------------------------------------------------------------------------
info "远程部署"
ssh "$SERVER" "bash '$REMOTE_TMP/remote-restart.sh' '$REMOTE_JAR' '$REMOTE_DIST'"

echo
info "发布完成：$(date '+%H:%M:%S')"
