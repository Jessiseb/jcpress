#!/bin/bash
# ============================================================================
# jcpress 后端部署脚本（裸机部署：停旧进程 → 拉代码 → 构建 → 启 jar）
# 用法： bash deploy/deploy-backend.sh
#
# 前置：
#  - 服务器已装 git（构建用仓库自带的 mvnw，无需另装 maven）
#  - JDK17 已装到 /usr/lib/jvm/jdk-17（软链；系统默认仍是 Java8，仅本项目用 17）
#  - 本项目已 clone 到 DEPLOY_DIR
#  - 端口：后端 8091 / 前端 8099（见 deploy-frontend.sh）
#
# 安全：DB 口令等走 ENV_FILE（.env），不写死在脚本里；
#       记得把 .env 加进 .gitignore，别提交进仓库。
# ============================================================================

set -e  # 任一步失败就停；pkill 等允许失败处用 || true

# ------------------------- 按你实际环境改这里 -------------------------
APP_NAME="jcpress-backend"
DEPLOY_DIR="/root/jcpress/backend"        # 项目 clone 到的绝对路径
GIT_BRANCH="jcpress-test"                 # 拉取分支（服务器实际分支）
MODULE="jcpress-backend"                  # maven 产物 jar 名（artifactId）
JAVA_HOME="/usr/lib/jvm/jdk-17"           # 本项目专用 JDK17（软链，详见安装步骤）
JVM_OPTS="-Xms256m -Xmx512m"
PORT=8091                                # 后端监听端口
SPRING_PROFILE="prod"
LOG_FILE="${DEPLOY_DIR}/${APP_NAME}.log"
PID_FILE="${DEPLOY_DIR}/${APP_NAME}.pid"
ENV_FILE="${DEPLOY_DIR}/.env"            # 密钥文件，不提交
# -----------------------------------------------------------------------

# 加载环境变量（DB_PASSWORD 等），不存在就跳过
if [ -f "$ENV_FILE" ]; then
  echo ">>> 加载环境变量: $ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
fi

# 用本项目专用 JDK17（不动系统默认 Java8）
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
echo ">>> 使用 JAVA: $("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"

# 1. 停掉旧进程（按进程名匹配）
echo ">>> 停止旧进程: $APP_NAME"
pkill -f "$APP_NAME" || true
sleep 2   # 等端口释放，避免新进程因端口被占起不来

# 2. 拉最新代码（best-effort：连不上 GitHub 就用已有代码，不中断部署）
echo ">>> 拉取代码 (branch=$GIT_BRANCH)"
cd "$DEPLOY_DIR"
git pull origin "$GIT_BRANCH" || echo ">>> git pull 失败（服务器可能连不上 GitHub），使用已有代码继续"

# 3. 构建（用 maven 包装器，无需服务器另装 maven；跳过测试）
echo ">>> 构建 (跳过测试)"
bash mvnw clean package -Dmaven.test.skip=true

# 4. 定位构建产物 jar（支持带版本号命名，如 jcpress-backend-0.1.0-SNAPSHOT.jar）
JAR_FILE=$(ls "${DEPLOY_DIR}"/target/*.jar 2>/dev/null | grep -v -E 'sources|javadoc' | head -1)
if [ -z "$JAR_FILE" ]; then
  echo ">>> 错误：未在 ${DEPLOY_DIR}/target/ 找到 jar，构建可能失败，已中止"
  exit 1
fi
echo ">>> 找到产物: $JAR_FILE"

# 5. 后台启动
echo ">>> 启动 $APP_NAME (port=$PORT, profile=$SPRING_PROFILE)"
nohup "$JAVA_HOME/bin/java" $JVM_OPTS \
  -jar "$JAR_FILE" \
  --server.port=$PORT \
  --spring.profiles.active=$SPRING_PROFILE \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo ">>> 已启动, PID=$(cat "$PID_FILE"), 日志: $LOG_FILE"
echo ">>> 跟踪日志: tail -f $LOG_FILE"
echo ">>> 停止服务: sudo pkill -f $APP_NAME"
