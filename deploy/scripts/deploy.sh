#!/usr/bin/env bash
# =============================================================
#  智能AI小车实训教育平台 - 一键部署脚本
# =============================================================
#  用途：本地执行，把构建产物上传到阿里云 ECS 并启动服务
#  前置：
#    1) 服务器已创建 www 用户：sudo useradd -m -s /bin/bash www
#    2) 服务器已放通 SSH（22） + 应用端口（仅 80/443 对外）
#    3) 服务器已安装 Node.js 20+ 与 pnpm（corepack enable）
#    4) 本地已配置 SSH 公私钥免密登录
#  使用：
#    pnpm build:standalone               # 完整流程（推荐）
#    pnpm build:standalone --skip-build  # 跳过构建，只上传
#    pnpm build:standalone --restart     # 部署后自动重启服务
# =============================================================

set -euo pipefail

# ---------- 配置项（按你的服务器改） ----------
SERVER_HOST="${SERVER_HOST:-8.134.xx.xx}"            # ECS 公网 IP
SERVER_USER="${SERVER_USER:-root}"                   # 部署用账户（有 sudo）
REMOTE_DIR="/www/wwwroot/edu-platform"               # 服务器项目根
APP_PORT="${APP_PORT:-5000}"                         # 后端 Node 端口
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXCLUDE_FILE="$(mktemp)"

# ---------- 颜色 ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

# ---------- 参数 ----------
SKIP_BUILD=false
DO_RESTART=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --restart)    DO_RESTART=true ;;
    *) warn "未知参数: $arg" ;;
  esac
done

# ---------- 0) 预检 ----------
log "▶ 预检：服务器连通性 & Node / pnpm"
ssh -o ConnectTimeout=5 -o BatchMode=yes "${SERVER_USER}@${SERVER_HOST}" 'echo "SSH OK" && node -v && pnpm -v' \
  || { err "SSH 或环境检查失败"; exit 1; }
ok "预检通过"

# ---------- 1) 本地构建 ----------
if [ "$SKIP_BUILD" = false ]; then
  log "▶ 本地构建（Next.js standalone）"
  cd "$LOCAL_DIR"
  pnpm install --frozen-lockfile
  pnpm build
  ok "构建完成"
else
  warn "已跳过构建（--skip-build）"
fi

# ---------- 2) 打包上传 ----------
log "▶ 打包 standalone 产物"
cd "$LOCAL_DIR"
trap 'rm -f "$EXCLUDE_FILE"' EXIT

# 排除清单：开发/测试产物、git、IDE 配置
cat > "$EXCLUDE_FILE" <<'EOF'
.git/
node_modules/
.next/cache/
*.log
.DS_Store
.vscode/
.idea/
tests/
coverage/
.env.local
.env.*.local
EOF

# Next.js standalone 输出在 .next/standalone
if [ ! -d ".next/standalone" ]; then
  err "未找到 .next/standalone，请确认 next.config.ts 已开启 output: 'standalone'"
  warn "如未开启，可改用 'pnpm start' 模式（需在服务器 pnpm install）"
  STANDALONE_MODE=false
else
  STANDALONE_MODE=true
  log "▶ rsync 上传 standalone 产物"
  rsync -avz --delete \
    --exclude-from="$EXCLUDE_FILE" \
    -e ssh \
    ".next/standalone/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/"
  # .next/static 必须保留在 standalone 之外并单独拷贝
  rsync -avz -e ssh ".next/static/" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/.next/static/"
  rsync -avz -e ssh "public/"        "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/public/"
fi

# 上传项目根（package.json / next.config / src / .next）
log "▶ rsync 上传项目源代码"
rsync -avz --delete \
  --exclude-from="$EXCLUDE_FILE" \
  -e ssh \
  --include='package.json' --include='pnpm-lock.yaml' --include='next.config.ts' --include='.coze' \
  --include='src/' --include='public/' --include='.next/' --include='scripts/' \
  --include='.env.production' \
  --exclude='*' \
  "./" \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/backend/"

ok "上传完成"

# ---------- 3) 服务器侧：环境初始化 & 启动 ----------
log "▶ 服务器：安装依赖、配置 systemd"
ssh "${SERVER_USER}@${SERVER_HOST}" <<REMOTE_EOF
set -e
cd ${REMOTE_DIR}/backend

# 1) 同步生产依赖（如已存在 node_modules 则跳过）
[ -d node_modules ] || pnpm install --prod --frozen-lockfile

# 2) 写好 standalone 需要的 .next/static 软链
if [ -d .next/standalone ] && [ -d .next/static ] && [ ! -e .next/standalone/.next/static ]; then
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  cp -r public         .next/standalone/public 2>/dev/null || true
fi

# 3) www 用户 & 目录权限
id www &>/dev/null || useradd -m -s /bin/bash www
chown -R www:www ${REMOTE_DIR}

# 4) 复制 systemd 服务文件
install -m 0644 /dev/stdin /etc/systemd/system/edu-platform.service <<'UNIT'
[Unit]
Description=Smart AI Car Training Platform (Next.js)
After=network.target
[Service]
User=www
Group=www
WorkingDirectory=${REMOTE_DIR}/backend
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=HOSTNAME=127.0.0.1
ExecStart=$( [ -f .next/standalone/server.js ] && echo 'node .next/standalone/server.js' || echo '/usr/bin/pnpm start' )
Restart=on-failure
RestartSec=5
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable edu-platform
systemctl restart edu-platform
sleep 3
systemctl --no-pager status edu-platform | head -20 || true
REMOTE_EOF

ok "服务已重启"

# ---------- 4) 健康检查 ----------
log "▶ 健康检查"
ssh "${SERVER_USER}@${SERVER_HOST}" "curl -fsS http://127.0.0.1:${APP_PORT}/api/health || (echo '健康检查失败' && exit 1)"
ok "健康检查通过 ✓"

cat <<EOF

=============================================================
  部署完成 🚀
  - 后端 Node 服务：http://127.0.0.1:${APP_PORT}
  - Nginx 反代入口：http://${SERVER_HOST}
  - 日志：  journalctl -u edu-platform -f
  - 重启：  ssh ${SERVER_USER}@${SERVER_HOST} 'systemctl restart edu-platform'
=============================================================
EOF
