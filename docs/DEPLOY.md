# 阿里云 CentOS ECS 部署指南

> 适用于本项目（智能AI小车实训教育平台）的生产环境部署。
> 涵盖：Nginx 反向代理、Node 后端服务、文件上传、开机自启、排查方法。

---

## 0. 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          阿里云 ECS（CentOS 7/8/Stream）                │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Nginx (80/443)                                              │   │
│   │    ├─ /api/*          ─── 反代 ──→ 127.0.0.1:5000（Node）   │   │
│   │    ├─ /_next/static/  ── 直出 ───→ /www/wwwroot/.../static │   │
│   │    ├─ /favicon.ico等  ── 直出 ───→ /www/wwwroot/.../public │   │
│   │    └─ /               ── 反代 ──→ 127.0.0.1:5000（Node）   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                  ▲                                    │
│                                  │  systemd 守护                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Node 服务（Next.js 16，监听 127.0.0.1:5000）                │   │
│   │    /www/wwwroot/edu-platform/backend                         │   │
│   │    ├─ .next/                ← 构建产物                       │   │
│   │    ├─ public/               ← 静态资源                       │   │
│   │    ├─ src/                  ← 源码（SSR + API Routes）        │   │
│   │    └─ package.json                                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
│   /www/wwwroot/edu-platform/frontend/public  ← 公共静态资源            │
│   /var/log/nginx/edu-platform.*.log          ← Nginx 日志             │
│   /etc/nginx/conf.d/edu-platform.conf        ← Nginx 配置            │
│   /etc/systemd/system/edu-platform.service   ← systemd 服务          │
└──────────────────────────────────────────────────────────────────────┘
```

> ⚠️ Node **只监听 127.0.0.1:5000**，不直接对外。所有对外入口走 Nginx 80/443。
> 这种结构：① 解决跨域 ② 隐藏后端 ③ 方便做 HTTPS 终结 / 限流 / 缓存。

---

## 1. 服务器目录约定

| 路径 | 作用 | 归属 | 备注 |
|------|------|------|------|
| `/www/wwwroot/edu-platform/backend/` | 后端项目根（Node 服务） | `www:www` | 含 `.next/`、`src/`、`public/`、`package.json` |
| `/www/wwwroot/edu-platform/frontend/public/` | 前端纯静态资源 | `www:www` | favicon、robots、图片等 |
| `/etc/nginx/conf.d/edu-platform.conf` | Nginx 反代配置 | `root:root` | 复制自 `deploy/nginx/*.conf` |
| `/etc/systemd/system/edu-platform.service` | systemd 服务单元 | `root:root` | 复制自 `deploy/systemd/edu-platform.service` |
| `/var/log/nginx/edu-platform.{access,error}.log` | Nginx 站点日志 | `nginx:nginx` | 滚动由 logrotate 处理 |
| `/www/wwwroot/edu-platform/backend/.env.production` | 生产环境变量 | `www:www 600` | Supabase / OSS 密钥 |

---

## 2. 一键部署（推荐路径）

### 2.1 在 ECS 上跑一次：服务器初始化

```bash
# SSH 登录
ssh root@<ECS_IP>

# 上传初始化脚本（也可以直接 curl 从 Git 拉取）
scp deploy/scripts/server-init.sh root@<ECS_IP>:/tmp/

# 在 ECS 上执行
sudo bash /tmp/server-init.sh
```

**做了什么**：安装 Node 20 + pnpm、Nginx、新建 `www` 用户、创建项目目录、SELinux/Firewalld 放行。

### 2.2 在 ECS 上：放代码 + 装依赖

```bash
# 方式 A：git 拉取（推荐）
cd /www/wwwroot/edu-platform/backend
sudo -u www git clone <YOUR_REPO_URL> .

# 方式 B：本地 scp 上传
# 在本地：
scp -r ./* www@<ECS_IP>:/www/wwwroot/edu-platform/backend/

# 安装依赖
cd /www/wwwroot/edu-platform/backend
sudo -u www pnpm install --frozen-lockfile

# 构建
sudo -u www pnpm build
```

### 2.3 在 ECS 上：部署 Nginx 与 systemd

```bash
# 1) Nginx 配置（先备份再覆盖）
sudo cp /etc/nginx/conf.d/edu-platform.conf{,.bak} 2>/dev/null || true
sudo cp deploy/nginx/edu-platform.simple.conf /etc/nginx/conf.d/edu-platform.conf
sudo nginx -t            # 语法检查
sudo systemctl reload nginx

# 2) systemd 服务
sudo cp deploy/systemd/edu-platform.service /etc/systemd/system/edu-platform.service
sudo systemctl daemon-reload
sudo systemctl enable --now edu-platform

# 3) 查看状态
sudo systemctl status edu-platform --no-pager
sudo journalctl -u edu-platform -f
```

### 2.4 验证

```bash
# 1) 本机后端直连
curl http://127.0.0.1:5000/api/health
# 期望：{"success":true,"code":0,"message":"ok","data":{"status":"healthy",...}}

# 2) Nginx 反代（80 端口）
curl http://127.0.0.1/api/health
# 期望：同上（通过 Nginx 转发）

# 3) 访问首页 HTML
curl -I http://127.0.0.1/
# 期望：HTTP/1.1 200

# 4) 公网访问（防火墙 / 安全组都放通后）
curl http://<ECS_IP>/api/health
```

### 2.5 一键部署脚本（本地触发）

在项目根目录：

```bash
# 设置环境变量
export SERVER_HOST=8.134.xx.xx
export SERVER_USER=root
export APP_PORT=5000

# 第一次完整部署
bash deploy/scripts/deploy.sh

# 后续只更新代码（跳过构建）
bash deploy/scripts/deploy.sh --skip-build --restart
```

---

## 3. 文件上传方案

### 方案 A：scp 一次性上传（最简单）

```bash
# 本地
scp -r ./* www@<ECS_IP>:/www/wwwroot/edu-platform/backend/
# 注：单文件超过 100MB 用 -C 压缩，-l 限速避免占满带宽
scp -rC -l 50000 ./node_modules www@<ECS_IP>:/www/wwwroot/edu-platform/backend/
```

### 方案 B：rsync 增量同步（推荐，可断点续传）

```bash
# 第一次全量
rsync -avz --delete -e ssh \
  --exclude='.git' --exclude='node_modules' --exclude='.next/cache' \
  ./ www@<ECS_IP>:/www/wwwroot/edu-platform/backend/

# 之后只传变更
rsync -avz -e ssh \
  --exclude='.git' --exclude='node_modules' --exclude='.next/cache' \
  ./ www@<ECS_IP>:/www/wwwroot/edu-platform/backend/
```

### 方案 C：git 拉取（团队协作推荐）

```bash
# ECS 端
cd /www/wwwroot/edu-platform/backend
sudo -u www git pull origin main
sudo -u www pnpm install --frozen-lockfile
sudo -u www pnpm build
sudo systemctl restart edu-platform
```

### 大文件处理（教学视频通常 100MB+）

- **OSS 直传**：前端拿到 STS 临时凭证后直传 OSS，不走 ECS。
  详见 `src/storage/` 下的 OSS 集成模块。
- **本地存储**：放在 `/www/wwwroot/edu-platform/backend/public/uploads/`，
  Nginx 加一段 `location /uploads/` 直接 `alias` 出去即可。
- **建议**：>50MB 的视频/课件优先走 OSS；Nginx 的 `client_max_body_size 500M` 已设置。

---

## 4. Nginx 关键配置说明

完整配置见 [`deploy/nginx/edu-platform.conf`](../deploy/nginx/edu-platform.conf)。

| 段 | 作用 | 关键点 |
|----|------|--------|
| `upstream edu_platform_backend` | 后端 Node 集群 | 单机写 `127.0.0.1:5000`；keepalive 64 |
| `location /api/` | **所有 API 走反代** | `proxy_buffering off`（流式 SSE 必需） |
| `location /_next/static/` | Next.js 哈希静态资源 | `expires 365d` + `immutable` |
| `location ~* (favicon.ico\|\.png\|\.css)` | 公共资源 | `expires 30d` |
| `location /` | 其它 → Node SSR | 转发 `X-Real-IP` 等头 |
| `gzip on` | 文本资源压缩 | ts/tsx/json/svg 全部压缩 |
| `client_max_body_size 500M` | 大文件上传 | 课程视频/课件 |

**跨域解决方案**：
- 方案 1：**同源反代**（本项目采用，Nginx 把 `/api/*` 反代到 5000，浏览器看到同源，不存在跨域）
- 方案 2：CORS（兜底用，已在 `next.config.ts` + Nginx 都加 `Access-Control-Allow-*`）

---

## 5. systemd 关键配置说明

完整配置见 [`deploy/systemd/edu-platform.service`](../deploy/systemd/edu-platform.service)。

| 字段 | 作用 | 关键点 |
|------|------|--------|
| `User=www` | 用非 root 跑 | 防止容器逃逸后拿到 root |
| `Environment=PORT=5000` | 显式端口 | Next.js 16 读 `PORT` |
| `Restart=on-failure` | 崩溃自启 | 5 秒后重试，最多 5 次/60 秒 |
| `TimeoutStopSec=30` | 优雅关停 | 给 Node 时间处理完当前请求 |
| `ProtectSystem=full` | 写保护 | 只允许写 `ReadWritePaths` 列出的目录 |
| `StandardOutput=journal` | 日志进 journald | `journalctl -u edu-platform -f` 查 |

---

## 6. 常用运维命令

```bash
# ----- 服务控制 -----
sudo systemctl status   edu-platform
sudo systemctl start    edu-platform
sudo systemctl stop     edu-platform
sudo systemctl restart  edu-platform
sudo systemctl enable   edu-platform   # 开机自启
sudo systemctl disable  edu-platform

# ----- 查看日志 -----
sudo journalctl -u edu-platform -f              # 实时跟踪
sudo journalctl -u edu-platform -n 200          # 最近 200 行
sudo journalctl -u edu-platform --since "1h ago" # 最近 1 小时
sudo journalctl -u edu-platform -p err          # 只看错误

# ----- Nginx -----
sudo nginx -t                # 配置语法检查
sudo systemctl reload nginx  # 热重载（不中断连接）
sudo systemctl restart nginx # 完全重启
tail -f /var/log/nginx/edu-platform.error.log

# ----- 端口与连接 -----
ss -tulnp | grep ':5000\b'             # Node 是否在监听
ss -tulnp | grep ':80\b'               # Nginx 是否在监听
curl -v http://127.0.0.1:5000/api/health
curl -v http://127.0.0.1/api/health    # 走 Nginx

# ----- 一次性自检 -----
bash deploy/scripts/check.sh
```

---

## 7. 常见报错排查

### 7.1 `502 Bad Gateway`

**原因**：Nginx 反代连不上后端（127.0.0.1:5000 没起来或崩了）。

```bash
# 1) 看后端服务
sudo systemctl status edu-platform
sudo journalctl -u edu-platform -n 50

# 2) 看 Node 进程
ps -ef | grep -E 'next|node' | grep -v grep

# 3) 直连验证
curl -v http://127.0.0.1:5000/api/health
```

**最常见**：
- `EADDRINUSE` 端口被占：`ss -tulnp | grep 5000` 杀掉占用进程
- `Cannot find module` 依赖没装：`sudo -u www pnpm install`
- `.env.production` 缺失导致 Supabase 初始化失败：看 journal 顶部错误

### 7.2 `504 Gateway Timeout`

**原因**：后端响应超过 60s。

```nginx
# 在 nginx.conf 中调大
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

### 7.3 `413 Request Entity Too Large`

**原因**：上传文件超过 `client_max_body_size`。

```nginx
# nginx.conf 调大（生产教学资源建议 500M+）
client_max_body_size 500M;
```

### 7.4 静态资源 404

```bash
# 1) 确认 .next/static 存在
ls -la /www/wwwroot/edu-platform/backend/.next/static/

# 2) 看 nginx 错误日志
sudo tail -f /var/log/nginx/edu-platform.error.log
```

**最常见**：构建后没传 `.next/static`（standalone 模式必须手动复制，见 deploy.sh 步骤 2）。

### 7.5 SELinux 拒绝

CentOS 默认开启 SELinux，Nginx 访问 `/www/wwwroot` 会被拦截。

```bash
# 查看被拒原因
sudo ausearch -m avc -ts recent | tail -20
# 或
sudo cat /var/log/audit/audit.log | grep nginx | tail

# 一键放行
sudo setsebool -P httpd_read_user_content 1
sudo setsebool -P httpd_can_network_connect 1
# 或者对单个目录
sudo chcon -R -t httpd_sys_content_t /www/wwwroot/edu-platform
```

### 7.6 跨域仍报错

本项目走 **同源反代**（`/api/*` 走 Nginx，浏览器看到的是同域），理论上没有 CORS。
如果浏览器还是报 CORS：

1. 确认 `curl -I http://127.0.0.1/api/health` 返回 `200`
2. 看请求 `Origin` 头是否被 Nginx 改了
3. 检查是否走了 CDN/反代后丢失了 `Host` 头

### 7.7 `pnpm: command not found`（systemd 下）

systemd 启动时 `PATH` 不含 `/usr/local/bin`。

**修复**：在 service 文件里用绝对路径 `/usr/bin/pnpm start`，或加：
```ini
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

### 7.8 Next.js standalone 模式缺失依赖

如果开启 `output: 'standalone'` 但启动报缺模块：

```bash
cd /www/wwwroot/edu-platform/backend
# 把缺失的依赖复制到 standalone 目录
cp -r node_modules/<missing_pkg> .next/standalone/node_modules/
```

或者改用 **普通模式**（不开启 standalone）：`next start` 直接跑，更稳但镜像更大。

---

## 8. 性能与安全建议

- [ ] 开启 HTTPS（Let's Encrypt：`certbot --nginx -d your-domain.com`）
- [ ] 配置 `client_max_body_size` 适配教学视频大小
- [ ] 加 fail2ban 防 SSH 爆破
- [ ] 阿里云安全组只开 80/443，Node 的 5000 端口保持 `127.0.0.1` 不外暴
- [ ] 定期 `dnf update`（CentOS Stream 8）
- [ ] logrotate 配 `/var/log/nginx/edu-platform.*.log`
- [ ] Supabase / OSS 密钥放 `.env.production`，权限 600
- [ ] Next.js standalone 模式减小镜像体积

---

## 9. 快速对照表

| 想做的事 | 命令 |
|----------|------|
| 看后端日志 | `journalctl -u edu-platform -f` |
| 看 Nginx 错误 | `tail -f /var/log/nginx/edu-platform.error.log` |
| 重启后端 | `systemctl restart edu-platform` |
| 重载 Nginx | `nginx -t && systemctl reload nginx` |
| 查端口 | `ss -tulnp \| grep -E ':80\|:443\|:5000'` |
| 看磁盘 | `df -h /www/wwwroot` |
| 看内存 | `free -h` |
| 部署 | `bash deploy/scripts/deploy.sh` |
| 自检 | `bash deploy/scripts/check.sh` |
