#!/bin/bash
# ============================================================================
# jcpress 后端部署脚本（模仿 buis-admin 的裸机部署方式：停旧进程 → 拉代码 → 构建 → 启 jar）
# 用法：
#   bash deploy/deploy-backend.sh
# 前置：服务器已装 git / maven / Java 21，且本项目已 clone 到 DEPLOY_DIR
#
# 注意：jcpress 后端目前还在前期（M1 工程骨架未做），后端代码 / maven 模块还没就位，
#       本脚本现在跑不了，等后端代码就绪、模块名确定后，改一下顶部变量即可直接复用。
#
# 安全：DB 口令、Sa-Token 密钥等一律走 ENV_FILE（.env），绝不写死在脚本里，
#       记得把 .env 加进 .gitignore，别提交进仓库。
# ============================================================================

set -e  # 任意一步失败就停（避免"构建挂了还启动旧逻辑"）；pkill 等允许失败处已用 || true

# ------------------------- 按你实际环境改这里 -------------------------
APP_NAME="jcpress-backend"            # 进程匹配名（pkill / 日志 / pid 都用它）
DEPLOY_DIR="/opt/jcpress/backend"     # 项目 clone 到的绝对路径（绝对路径比相对路径稳）
GIT_BRANCH="main"                     # 拉取分支（你 buis 用的是 test，这里默认 main）
MODULE="jcpress-backend"              # maven 模块名；若后端是单模块 jar，保持即可
JAR_PATH="./${MODULE}/target/${MODULE}.jar"
JVM_OPTS="-Xms256m -Xmx512m"          # 原 buis 用 128m，Spring Boot 3 + JDK21 偏紧，调到 256/512
PORT=8080                             # 后端监听端口
SPRING_PROFILE="prod"                 # 激活的 Spring profile
LOG_FILE="${DEPLOY_DIR}/${APP_NAME}.log"
PID_FILE="${DEPLOY_DIR}/${APP_NAME}.pid"
ENV_FILE="${DEPLOY_DIR}/.env"         # 密钥文件，不提交
# -----------------------------------------------------------------------

# 加载环境变量（DB / Sa-Token 等），不存在就跳过
if [ -f "$ENV_FILE" ]; then
  echo ">>> 加载环境变量: $ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
fi

# 1. 停掉旧进程（按 jar/进程名匹配）
echo ">>> 停止旧进程: $APP_NAME"
sudo pkill -f "$APP_NAME" || true
sleep 2   # 等端口释放，避免新进程因端口被占起不来

# 2. 拉最新代码
echo ">>> 拉取代码 (branch=$GIT_BRANCH)"
cd "$DEPLOY_DIR"
sudo git pull origin "$GIT_BRANCH"

# 3. 构建（跳过测试）
echo ">>> 构建 (跳过测试)"
if [ -n "$MODULE" ]; then
  sudo mvn clean install -pl "$MODULE" -am -Dmaven.test.skip=true
else
  sudo mvn clean install -Dmaven.test.skip=true
fi

# 4. 后台启动
echo ">>> 启动 $APP_NAME (port=$PORT, profile=$SPRING_PROFILE)"
sudo nohup java $JVM_OPTS \
  -jar "$JAR_PATH" \
  --server.port=$PORT \
  --spring.profiles.active=$SPRING_PROFILE \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo ">>> 已启动, PID=$(cat "$PID_FILE"), 日志: $LOG_FILE"
echo ">>> 跟踪日志: tail -f $LOG_FILE"
echo ">>> 停止服务: sudo pkill -f $APP_NAME"
