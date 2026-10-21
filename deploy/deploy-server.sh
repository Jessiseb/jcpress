#!/usr/bin/env bash
# ============================================================================
# jcpress 服务器侧一键部署：git pull → 构建后端 → 构建前端 → 重启
#
# 用法（在服务器上，仓库根目录或任意位置都行）：
#   bash /root/jcpress/deploy/deploy-server.sh              # 全量：拉代码 + 构建 + 重启
#   bash /root/jcpress/deploy/deploy-server.sh --backend    # 只更后端
#   bash /root/jcpress/deploy/deploy-server.sh --frontend   # 只更前端
#   bash /root/jcpress/deploy/deploy-server.sh --no-pull    # 不拉代码，用当前代码重建
#   bash /root/jcpress/deploy/deploy-server.sh --restart-only  # 不构建，只重启
#
# 2G 机器的取舍：
#   - 构建内存有上限（MAVEN_OPTS 512m / NODE_OPTIONS 768m，见 /etc/profile.d/jcpress.sh）
#   - 先构建成功再停旧进程，构建失败则旧版本继续对外服务
#   - 构建期间机器会变慢（走 swap），不是卡死
#
# 服务器上没有 EDR，所以前端**正常 minify**，产物比本机构建小得多。
# ============================================================================

set -euo pipefail

APP_NAME="jcpress-backend"
DEPLOY_DIR="/root/jcpress/backend"
LOG_FILE="${DEPLOY_DIR}/${APP_NAME}.log"
ENV_FILE="${DEPLOY_DIR}/.env"
GIT_BRANCH="jcpress-test"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info() { echo -e "${GREEN}>>>${NC} $*"; }
warn() { echo -e "${YELLOW}>>>${NC} $*"; }
die()  { echo -e "${RED}>>> 失败:${NC} $*" >&2; exit 1; }

DO_BACKEND=1; DO_FRONTEND=1; DO_PULL=1; DO_BUILD=1
for arg in "$@"; do
  case "$arg" in
    --backend)      DO_FRONTEND=0 ;;
    --frontend)     DO_BACKEND=0 ;;
    --no-pull)      DO_PULL=0 ;;
    --restart-only) DO_BUILD=0; DO_PULL=0 ;;
    -h|--help)      sed -n '2,20p' "$0"; exit 0 ;;
    *) die "未知参数: $arg" ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -d .git ] || die "$ROOT 不是 git 仓库，先 clone 下来"

# login shell 才读 /etc/profile.d，这里显式给上，非交互执行也稳
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/jdk-17}"
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_OPTS="${MAVEN_OPTS:--Xmx512m -Xms256m}"
export NODE_OPTIONS="${NODE_OPTIONS:--max-old-space-size=768}"
[ -x "${JAVA_HOME}/bin/javac" ] || die "找不到 ${JAVA_HOME}/bin/javac，先跑 deploy/server-init.sh"

[ -f "$ENV_FILE" ] || warn "${ENV_FILE} 不存在，后端可能因缺 DB_PASSWORD / REDIS_PASSWORD 起不来"
mkdir -p "$ROOT/.tmp"

# ---------------------------------------------------------------------------
# 1. 拉代码
# ---------------------------------------------------------------------------
if [ "$DO_PULL" -eq 1 ]; then
  info "拉取 ${GIT_BRANCH}"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    warn "工作区有未提交改动，git pull 可能被拒；先 git stash 或手工处理"
  fi
  # --ff-only：分叉时直接失败，不在服务器上产生 merge commit
  git pull --ff-only origin "$GIT_BRANCH" || die "git pull 失败（代码分叉或网络不通）"
  info "当前版本 $(git log -1 --format='%h %s' | cut -c1-60)"
fi

# ---------------------------------------------------------------------------
# 2. 构建后端
# ---------------------------------------------------------------------------
JAR_PATH=""
if [ "$DO_BACKEND" -eq 1 ] && [ "$DO_BUILD" -eq 1 ]; then
  info "构建后端（MAVEN_OPTS=${MAVEN_OPTS}）"
  cd "$DEPLOY_DIR"
  if bash mvnw clean package -Dmaven.test.skip=true -B > "$ROOT/.tmp/build-backend.log" 2>&1; then
    info "后端构建完成"
  else
    echo "--- 构建日志最后 40 行 ---" >&2
    tail -n 40 "$ROOT/.tmp/build-backend.log" >&2
    die "后端构建失败，旧版本继续在跑，未做任何变更"
  fi
  cd "$ROOT"
fi

if [ "$DO_BACKEND" -eq 1 ]; then
  JAR_PATH=$(ls "$DEPLOY_DIR"/target/*.jar 2>/dev/null | grep -v -E 'sources|javadoc|original' | head -1 || true)
  [ -n "$JAR_PATH" ] || die "找不到 jar：${DEPLOY_DIR}/target/*.jar"
  info "后端产物 $(basename "$JAR_PATH") $(du -h "$JAR_PATH" | cut -f1)"
fi

# ---------------------------------------------------------------------------
# 3. 构建前端
#    服务器上没有 EDR，不需要 --configLoader runner / --minify false，
#    走 vite 默认流程（esbuild minify），产物比本机构建小很多。
# ---------------------------------------------------------------------------
DIST_DIR=""
if [ "$DO_FRONTEND" -eq 1 ]; then
  if [ "$DO_BUILD" -eq 1 ]; then
    cd "$ROOT/frontend"
    if [ ! -d node_modules ] || [ "$ROOT/frontend/package-lock.json" -nt "$ROOT/frontend/node_modules" ]; then
      info "安装前端依赖（npm ci）"
      npm ci --no-audit --no-fund > "$ROOT/.tmp/build-frontend.log" 2>&1 \
        || { tail -n 40 "$ROOT/.tmp/build-frontend.log" >&2; die "npm ci 失败"; }
    else
      info "依赖已是最新，跳过 npm ci"
    fi

    info "构建前端（NODE_OPTIONS=${NODE_OPTIONS}）"
    if npx tsc -b >> "$ROOT/.tmp/build-frontend.log" 2>&1 \
       && npx vite build >> "$ROOT/.tmp/build-frontend.log" 2>&1; then
      info "前端构建完成"
    else
      echo "--- 构建日志最后 40 行 ---" >&2
      tail -n 40 "$ROOT/.tmp/build-frontend.log" >&2
      die "前端构建失败，旧版本继续在跑，未做任何变更"
    fi
    cd "$ROOT"
  fi
  DIST_DIR="$ROOT/frontend/dist"
  [ -f "$DIST_DIR/index.html" ] || die "找不到 ${DIST_DIR}/index.html"
  info "前端产物 $(du -sh "$DIST_DIR" | cut -f1) / $(find "$DIST_DIR" -type f | wc -l) 个文件"
fi

# ---------------------------------------------------------------------------
# 4. 落地 + 重启（复用 remote-restart.sh，两个脚本不重复实现停启逻辑）
# ---------------------------------------------------------------------------
info "落地并重启"
bash "$ROOT/deploy/remote-restart.sh" "$JAR_PATH" "$DIST_DIR"

echo
info "部署完成：$(date '+%m-%d %H:%M:%S')  $(git log -1 --format='%h')"
info "看日志：tail -f ${LOG_FILE}"
