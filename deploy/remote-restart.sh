#!/usr/bin/env bash
# ============================================================================
# jcpress 服务器侧：落地产物 + 重启后端
#
# 由 deploy/publish.sh 通过 ssh 调用，也可以单独手工跑：
#   bash /root/jcpress/deploy/remote-restart.sh /tmp/x.jar /tmp/dist.tar.gz
#   bash /root/jcpress/deploy/remote-restart.sh            # 只重启，不换产物
#
# 参数：
#   $1  jar 绝对路径（省略则用当前目录里已有的 jar）
#   $2  前端 dist 压缩包路径（省略则不动前端）
# ============================================================================

set -euo pipefail

APP_NAME="jcpress-backend"
DEPLOY_DIR="/root/jcpress/backend"
WEB_ROOT="/var/www/jcpress"
JAVA_HOME="/usr/lib/jvm/jdk-17"
JVM_OPTS="-Xms256m -Xmx512m"
PORT=8091
SPRING_PROFILE="prod"
LOG_FILE="${DEPLOY_DIR}/${APP_NAME}.log"
PID_FILE="${DEPLOY_DIR}/${APP_NAME}.pid"
ENV_FILE="${DEPLOY_DIR}/.env"

NEW_JAR="${1:-}"
DIST_TAR="${2:-}"

info() { echo ">>> $*"; }
die()  { echo ">>> 失败: $*" >&2; exit 1; }

[ -x "${JAVA_HOME}/bin/java" ] || die "找不到 ${JAVA_HOME}/bin/java，先跑 deploy/server-init.sh"

# ---------------------------------------------------------------------------
# 1. 换前端（先换前端再重启后端：静默窗口里用户看到的是新壳配老接口，
#    比老壳配新接口更不容易出错）
# ---------------------------------------------------------------------------
if [ -n "$DIST_TAR" ]; then
  # 两种入参：publish.sh 传 tar.gz（跨机上传），deploy-server.sh 传仓库里的 dist 目录
  if [ -d "$DIST_TAR" ]; then
    DIST_SRC="$DIST_TAR"
  elif [ -f "$DIST_TAR" ]; then
    info "解包前端"
    mkdir -p "${WEB_ROOT}.new"
    rm -rf "${WEB_ROOT}.new"/*
    tar -xzf "$DIST_TAR" -C "${WEB_ROOT}.new"
    DIST_SRC="${WEB_ROOT}.new"
  else
    die "dist 路径不存在: $DIST_TAR"
  fi
  [ -f "${DIST_SRC}/index.html" ] || die "产物里没有 index.html，构建可能没成功"

  info "同步前端到 ${WEB_ROOT}"
  # rsync --delete 才能删掉上一版残留的旧 hash 文件；没有 rsync 就整体换目录
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "${DIST_SRC}/" "${WEB_ROOT}/"
    rm -rf "${WEB_ROOT}.new"
  else
    mv "${WEB_ROOT}" "${WEB_ROOT}.old" 2>/dev/null || true
    mkdir -p "$WEB_ROOT"
    cp -a "${DIST_SRC}/." "${WEB_ROOT}/"
    rm -rf "${WEB_ROOT}.old" "${WEB_ROOT}.new"
  fi
  info "前端已更新（$(ls "${WEB_ROOT}/assets" | wc -l) 个 assets 文件）"
fi

# ---------------------------------------------------------------------------
# 2. 换后端 jar
# ---------------------------------------------------------------------------
JAR_FILE=""
if [ -n "$NEW_JAR" ]; then
  [ -f "$NEW_JAR" ] || die "jar 不存在: $NEW_JAR"
  info "备份旧 jar"
  if ls "${DEPLOY_DIR}"/app.jar >/dev/null 2>&1; then
    cp "${DEPLOY_DIR}/app.jar" "${DEPLOY_DIR}/app.jar.prev"
  fi
  # 固定命名成 app.jar：jar 带版本号时 pkill -f 会误伤，也省得每次找文件
  cp "$NEW_JAR" "${DEPLOY_DIR}/app.jar"
  JAR_FILE="${DEPLOY_DIR}/app.jar"
elif [ -f "${DEPLOY_DIR}/app.jar" ]; then
  JAR_FILE="${DEPLOY_DIR}/app.jar"
else
  JAR_FILE=$(ls "${DEPLOY_DIR}"/target/*.jar 2>/dev/null | grep -v -E 'sources|javadoc|original' | head -1 || true)
fi
[ -n "$JAR_FILE" ] || die "没有可用的 jar，请传一个上来或先用 deploy-backend.sh 构建"

# ---------------------------------------------------------------------------
# 3. 停旧进程（优先 PID 文件；记录里的 PID 可能已被复用，所以要校验命令行）
# ---------------------------------------------------------------------------
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null && tr '\0' ' ' < "/proc/${OLD_PID}/cmdline" 2>/dev/null | grep -q "$APP_NAME\|app.jar"; then
    info "停止旧进程 PID=${OLD_PID}"
    kill "$OLD_PID" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$OLD_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi
# 兜底：PID 文件丢了，但端口还占着
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  info "端口 ${PORT} 仍被占用，按端口清理"
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 2
fi

# ---------------------------------------------------------------------------
# 4. 启动
# ---------------------------------------------------------------------------
if [ -f "$ENV_FILE" ]; then
  info "加载 ${ENV_FILE}"
  set -a; . "$ENV_FILE"; set +a
else
  echo ">>> 警告：${ENV_FILE} 不存在，DB 口令等环境变量可能缺失"
fi

info "启动 ${APP_NAME}（port=${PORT}, profile=${SPRING_PROFILE}, jar=$(basename "$JAR_FILE")）"
nohup "${JAVA_HOME}/bin/java" $JVM_OPTS \
  -jar "$JAR_FILE" \
  --server.port="$PORT" \
  --spring.profiles.active="$SPRING_PROFILE" \
  >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

# ---------------------------------------------------------------------------
# 5. 等端口起来（2G 机器首次启动 30~60s 是常态，不要用固定 sleep）
# ---------------------------------------------------------------------------
info "等待端口 ${PORT} 就绪（最多 120s）"
READY=0
for _ in $(seq 1 120); do
  if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then READY=1; break; fi
  kill -0 "$(cat "$PID_FILE")" 2>/dev/null || break   # 进程已经死了，不用再等
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo ">>> 启动失败，最后 30 行日志："
  tail -n 30 "$LOG_FILE" >&2
  exit 1
fi

info "已就绪 PID=$(cat "$PID_FILE")，日志 ${LOG_FILE}"
info "跟踪日志：tail -f ${LOG_FILE}"
