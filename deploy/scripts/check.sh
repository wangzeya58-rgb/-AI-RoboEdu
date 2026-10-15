#!/usr/bin/env bash
# =============================================================
#  服务状态自检脚本
#  使用：bash deploy/scripts/check.sh
#  作用：一次输出 Node / Nginx / 端口 / 日志 / 健康检查 的关键信息
# =============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0m'; NC='\033[0m'
APP_PORT="${APP_PORT:-5000}"

section() { echo -e "\n${BLUE}==== $* ====${NC}"; }
ok()      { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()     { echo -e "${RED}[FAIL]${NC} $*"; }

# ---------- Node 进程 ----------
section "Node 进程（edu-platform）"
if pgrep -af 'edu-platform' >/dev/null; then
  pgrep -af 'edu-platform' | head -5
  ok "进程存在"
else
  err "未发现 edu-platform 进程"
  echo "  排查：sudo systemctl status edu-platform"
fi

# ---------- systemd 状态 ----------
section "systemd 状态"
if systemctl list-unit-files edu-platform.service &>/dev/null; then
  systemctl --no-pager status edu-platform | head -15 || true
else
  warn "systemd unit edu-platform.service 未安装"
fi

# ---------- 端口监听 ----------
section "端口监听（5000）"
if command -v ss &>/dev/null; then
  if ss -tuln | grep -E ":${APP_PORT}\b" >/dev/null; then
    ss -tulnp | grep ":${APP_PORT}" | head -3
    ok "端口 ${APP_PORT} 在监听"
  else
    err "端口 ${APP_PORT} 未监听"
  fi
else
  warn "ss 命令不可用，跳过"
fi

# ---------- Nginx ----------
section "Nginx 状态"
if command -v nginx &>/dev/null; then
  nginx -t 2>&1 | tail -3
  systemctl --no-pager status nginx | head -5 || true
else
  warn "Nginx 未安装"
fi

# ---------- 健康检查 ----------
section "健康检查"
echo -n "  http://127.0.0.1:${APP_PORT}/api/health → "
if curl -fsS --max-time 5 "http://127.0.0.1:${APP_PORT}/api/health"; then
  echo
  ok "后端 API 健康"
else
  err "后端 API 不通"
fi

echo -n "  http://127.0.0.1/                      → "
if curl -fsS --max-time 5 -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1/"; then
  ok "Nginx 80 端口可访问"
else
  err "Nginx 80 端口不可访问"
fi

# ---------- 最近日志 ----------
section "最近日志（journalctl）"
journalctl -u edu-platform -n 20 --no-pager 2>/dev/null || warn "无日志"

section "Nginx 错误日志（最近 20 行）"
tail -n 20 /var/log/nginx/edu-platform.error.log 2>/dev/null || warn "无日志"

cat <<EOF

=============================================================
  自检完毕。常见操作：
    - 重启服务：sudo systemctl restart edu-platform
    - 重载 Nginx：sudo systemctl reload nginx
    - 实时日志：journalctl -u edu-platform -f
=============================================================
EOF
