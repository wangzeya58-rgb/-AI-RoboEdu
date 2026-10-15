#!/usr/bin/env bash
# =============================================================
#  智能AI小车实训教育平台 - 服务器侧初始化（仅需执行一次）
# =============================================================
#  用途：在阿里云 CentOS ECS 上安装运行环境
#  使用：sudo bash deploy/scripts/server-init.sh
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "\033[0;34m[$(date +%H:%M:%S)]\033[0m $*"; }
ok()  { echo -e "${GREEN}✓${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC} $*"; }
err() { echo -e "${RED}✗${NC} $*"; }

# ---------- 1) 基础工具 ----------
log "▶ 1/6 安装基础工具"
yum install -y epel-release yum-utils \
  curl wget git vim lsof rsync \
  firewalld \
  || true
ok "基础工具完成"

# ---------- 2) Node.js 20 + pnpm ----------
log "▶ 2/6 安装 Node.js 20 LTS"
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
fi
node -v
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
ok "Node / pnpm 就绪"

# ---------- 3) Nginx ----------
log "▶ 3/6 安装 Nginx"
if ! command -v nginx &>/dev/null; then
  yum install -y nginx
fi
nginx -v
systemctl enable nginx
ok "Nginx 就绪"

# ---------- 4) 创建 www 用户与项目目录 ----------
log "▶ 4/6 创建 www 用户与项目目录"
id www &>/dev/null || useradd -m -s /bin/bash www
mkdir -p /www/wwwroot/edu-platform/{backend,frontend/public}
mkdir -p /var/log/nginx/edu-platform
chown -R www:www /www/wwwroot/edu-platform
chmod -R 755 /www/wwwroot/edu-platform
ok "目录就绪：/www/wwwroot/edu-platform"

# ---------- 5) 防火墙（阿里云 ECS 通常在安全组，这里只是兜底） ----------
log "▶ 5/6 防火墙（Firewalld）"
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http  || true
  firewall-cmd --permanent --add-service=https || true
  firewall-cmd --reload
  ok "防火墙已放行 80/443"
else
  warn "firewalld 未运行（阿里云安全组已放行即可）"
fi

# ---------- 6) SELinux（CentOS 关键） ----------
log "▶ 6/6 SELinux 调整"
if command -v getenforce &>/dev/null; then
  STATUS=$(getenforce)
  if [ "$STATUS" = "Enforcing" ]; then
    setsebool -P httpd_can_network_connect 1 || true
    setsebool -P httpd_read_user_content    1 || true
    setsebool -P httpd_enable_homedirs     1 || true
    ok "SELinux 放行 HTTP 网络连接"
  else
    warn "SELinux 处于 $STATUS 状态，跳过"
  fi
fi

cat <<EOF

=============================================================
  服务器初始化完成 🚀

  下一步：
    1) 上传/拉取代码到 /www/wwwroot/edu-platform/backend
    2) cd /www/wwwroot/edu-platform/backend && pnpm install
    3) 部署 Nginx 配置：
         sudo cp deploy/nginx/edu-platform.simple.conf \\
            /etc/nginx/conf.d/edu-platform.conf
         sudo nginx -t && sudo systemctl reload nginx
    4) 部署 systemd 服务：
         sudo cp deploy/systemd/edu-platform.service \\
            /etc/systemd/system/
         sudo systemctl daemon-reload
         sudo systemctl enable --now edu-platform
    5) 验证：curl http://127.0.0.1/api/health
=============================================================
EOF
