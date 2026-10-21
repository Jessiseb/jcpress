#!/usr/bin/env bash
# ============================================================================
# jcpress 服务器一次性初始化（2 核 2G 裸机，构建跑在服务器上）
#
# 装的东西分两类：
#   运行时  JRE/JDK17 + nginx + Redis 客户端
#   构建时  JDK17（要 javac）+ Node 20（要 vite/tsc）
#
# 2G 上构建能跑通，但要限内存：Maven 512m 堆、Node 768m 堆（实测这两个
# 上限够用：后端 49s、前端 59s，本机数据）。不加限制的话 JVM/Node 会按
# 物理内存的一半去要，直接把自己和 Spring Boot 一起拖进 swap。
#
# 用法（二选一）：
#   ssh root@<IP> 'bash -s' < deploy/server-init.sh
#   scp deploy/server-init.sh root@<IP>:/tmp/ && ssh root@<IP> 'bash /tmp/server-init.sh'
#
# 幂等：重复跑不会重复建 swap、不会重复写 fstab、不会重复装 Node。
# ============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info() { echo -e "${GREEN}>>>${NC} $*"; }
warn() { echo -e "${YELLOW}>>>${NC} $*"; }
die()  { echo -e "${RED}>>> 失败:${NC} $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "需要 root 权限运行"

# ---------------------------------------------------------------------------
# 1. swap —— 2G 机器上这一步不是可选
#    构建时 Maven(512m) + Node(768m) + Spring Boot(700m) 加起来超过物理内存，
#    没有 swap 就是进程被内核直接杀掉，日志里只会看到 "Killed"。
# ---------------------------------------------------------------------------
info "配置 swap"
if swapon --show=NAME --noheadings | grep -q .; then
  warn "已有 swap，跳过"
else
  # fallocate 在 OpenVZ / btrfs 上会失败，用 dd 兜底
  if ! fallocate -l 2G /swapfile 2>/dev/null; then
    warn "fallocate 不可用，改用 dd（慢一些）"
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  fi
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "已启用 2G swap"
fi

# 默认 swappiness=60 对服务器太激进：会把 Java 堆频繁换出，响应毛刺明显
if [ ! -f /etc/sysctl.d/99-jcpress.conf ]; then
  cat > /etc/sysctl.d/99-jcpress.conf <<'EOF'
# jcpress：2G 小内存机器的内存与文件监听调优
vm.swappiness = 10
fs.inotify.max_user_watches = 65536
fs.inotify.max_user_instances = 1024
EOF
  sysctl --system >/dev/null
  info "已写入 /etc/sysctl.d/99-jcpress.conf"
else
  warn "sysctl 配置已存在，跳过"
fi

# ---------------------------------------------------------------------------
# 2. 时区
# ---------------------------------------------------------------------------
if [ "$(timedatectl show -p Timezone --value 2>/dev/null)" != "Asia/Shanghai" ]; then
  timedatectl set-timezone Asia/Shanghai 2>/dev/null || ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
  info "时区设为 Asia/Shanghai"
fi

# ---------------------------------------------------------------------------
# 3. 系统包
# ---------------------------------------------------------------------------
info "安装系统包（git / curl / rsync / nginx / JDK17）"
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  # psmisc 提供 fuser：remote-restart.sh 在 PID 文件丢失时按端口清进程要用
  apt-get install -y -qq git curl rsync nginx openjdk-17-jdk-headless ca-certificates psmisc
  PKG_MGR=apt
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y -q git curl rsync nginx java-17-openjdk-devel psmisc
  PKG_MGR=dnf
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q git curl rsync nginx java-17-openjdk-devel psmisc
  PKG_MGR=yum
else
  die "未识别的包管理器，请手工安装 git / curl / rsync / nginx / JDK17"
fi

# ---------------------------------------------------------------------------
# 4. JDK 路径统一成 /usr/lib/jvm/jdk-17
#    deploy 脚本里写死了这个路径，保持一致，避免以后两套脚本对不上。
# ---------------------------------------------------------------------------
if [ ! -e /usr/lib/jvm/jdk-17 ]; then
  JAVA_BIN=$(find /usr/lib/jvm -maxdepth 3 -type f -name java -path '*/bin/java' 2>/dev/null | head -1 || true)
  [ -n "$JAVA_BIN" ] || die "找不到 java，JDK 安装可能失败"
  ln -s "$(dirname "$(dirname "$JAVA_BIN")")" /usr/lib/jvm/jdk-17
fi
"$(readlink -f /usr/lib/jvm/jdk-17)/bin/javac" -version 2>&1 | sed 's/^/    javac: /'

# ---------------------------------------------------------------------------
# 5. Node.js 20（服务器上要跑 tsc / vite build）
# ---------------------------------------------------------------------------
if command -v node >/dev/null 2>&1 && [ "$(node -v | cut -d. -f1 | tr -d v)" -ge 18 ]; then
  warn "已有 Node $(node -v)，跳过"
else
  info "安装 Node.js 20"
  if [ "$PKG_MGR" = "apt" ] && curl -fsSL --max-time 60 https://deb.nodesource.com/setup_20.x -o /tmp/nodesource.sh 2>/dev/null; then
    bash /tmp/nodesource.sh >/dev/null 2>&1
    apt-get install -y -qq nodejs
  else
    # NodeSource 不可达时走 npmmirror 二进制包
    warn "NodeSource 不可达，改用 npmmirror 二进制包"
    NODE_TARBALL=$(curl -fsSL --max-time 60 "https://registry.npmmirror.com/-/binary/node/latest-v20.x/" \
      | tr ',' '\n' | grep -oE 'node-v20\.[0-9]+\.[0-9]+-linux-x64\.tar\.gz' | head -1 || true)
    [ -n "$NODE_TARBALL" ] || die "拿不到 Node 版本清单，请手工安装 Node 20"
    curl -fsSL --max-time 300 "https://registry.npmmirror.com/-/binary/node/latest-v20.x/${NODE_TARBALL}" -o /tmp/node.tar.gz
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1
    rm -f /tmp/node.tar.gz
  fi
  command -v node >/dev/null 2>&1 || die "Node 安装失败"
  info "Node $(node -v) / npm $(npm -v)"
fi

# ---------------------------------------------------------------------------
# 6. 构建工具的内存上限与 Maven 镜像
#    本机 settings.xml 用的是 HTTP 阿里云镜像，Maven 3.8+ 会拒绝 HTTP 仓库，
#    服务器上写 HTTPS 版本。
# ---------------------------------------------------------------------------
if [ ! -f /etc/profile.d/jcpress.sh ]; then
  cat > /etc/profile.d/jcpress.sh <<'EOF'
# jcpress：2G 机器上构建时的内存闸门
export JAVA_HOME=/usr/lib/jvm/jdk-17
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_OPTS="-Xmx512m -Xms256m"
export NODE_OPTIONS="--max-old-space-size=768"
EOF
  info "已写入 /etc/profile.d/jcpress.sh"
fi

if [ ! -f /root/.m2/settings.xml ]; then
  mkdir -p /root/.m2
  cat > /root/.m2/settings.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
  <mirrors>
    <mirror>
      <id>aliyun-https</id>
      <name>Aliyun Public</name>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
EOF
  info "已写入 /root/.m2/settings.xml（HTTPS 阿里云镜像）"
fi

# ---------------------------------------------------------------------------
# 7. 目录
# ---------------------------------------------------------------------------
info "创建目录"
mkdir -p /var/www/jcpress          # 前端静态文件（nginx root）
mkdir -p /root/jcpress             # 仓库 clone 位置
mkdir -p /var/log/nginx
chown -R root:root /var/www/jcpress

# ---------------------------------------------------------------------------
# 8. 收尾提示（不自动改防火墙：改错了会把自己锁在外面）
# ---------------------------------------------------------------------------
cat <<'EOF'

==================== 初始化完成 ====================

接下来手工做四件事：

1) 放行端口（云厂商还要在控制台安全组里放行 80/443）
     ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp

2) 把仓库 clone 下来（服务器拉代码部署的前提）
     git clone -b jcpress-test https://github.com/Jessiseb/jcpress.git /root/jcpress
   仓库是 public，clone 不需要凭据。要 push 得配 SSH key 或 token。

3) 填环境变量
     cp /root/jcpress/backend/.env.example /root/jcpress/backend/.env
     vi /root/jcpress/backend/.env      # DB_PASSWORD / REDIS_PASSWORD / JCPRESS_AI_API_KEY

4) 启用 nginx 站点
     cp /root/jcpress/deploy/nginx-jcpress.conf /etc/nginx/conf.d/jcpress.conf
     nginx -t && systemctl enable --now nginx

之后部署只要一条命令（在服务器上）：
     bash /root/jcpress/deploy/deploy-server.sh

首次构建要下载 Maven 依赖（约 300MB）和 npm 包，会比较久；
之后有缓存，一次完整部署约 3~5 分钟。
====================================================
EOF
