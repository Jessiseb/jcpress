#!/bin/bash
# ============================================================================
# jcpress 前端部署脚本（裸机：装依赖 → 构建 → vite preview 起静态服务）
# 用法： bash deploy/deploy-frontend.sh
#
# 前置：服务器已装 Node.js 18+ 与 npm
# 端口：前端运行在 8099（与 vite.config.ts 的 server/preview.port 对应）
# 说明：后端在 8091；前端 /api 已在 vite.config 里代理到 127.0.0.1:8091
# ============================================================================

set -e

APP_NAME="jcpress-frontend"
DEPLOY_DIR="/root/jcpress/frontend"
PORT=8099
LOG_FILE="${DEPLOY_DIR}/${APP_NAME}.log"
PID_FILE="${DEPLOY_DIR}/${APP_NAME}.pid"

# 1. 停掉旧进程（匹配 vite preview）
echo ">>> 停止旧进程: $APP_NAME"
pkill -f "vite preview" || true
sleep 2

# 2. 安装依赖 + 构建
cd "$DEPLOY_DIR"
echo ">>> 安装依赖"
npm install
echo ">>> 构建"
npm run build

# 3. 启动预览（静态服务，端口 8099，监听所有网卡）
echo ">>> 启动 $APP_NAME (port=$PORT)"
nohup npx vite preview --port $PORT --host > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo ">>> 已启动, PID=$(cat "$PID_FILE"), 端口 $PORT, 日志: $LOG_FILE"
echo ">>> 跟踪日志: tail -f $LOG_FILE"
echo ">>> 停止服务: pkill -f 'vite preview'"
