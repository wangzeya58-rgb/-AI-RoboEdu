# AI RoboEdu

智能机器人教育平台，包含课程学习、班级管理、学习进度、AI 小老师、小车控制及仿真器入口。

本文介绍 **Windows、macOS（Intel）和 Ubuntu 的本地部署**。网页、课程 API 和认证服务在同一个 Next.js 项目内，不需要另建 NestJS 服务。数据库使用 PostgreSQL + Drizzle，不使用 Prisma。

> 本仓库不包含小车 FastAPI、ROS 或仿真器本体。学习课程不需要连接小车；打开网页也不会自动启动 ROS。机器人服务需要另外部署。

## 1. 环境准备

建议使用 Node.js 24.x、pnpm 9.0.0、Git 和 PostgreSQL 16。数据库可使用本机 PostgreSQL，或使用项目提供的 Docker Compose 配置。

| 系统 | 安装方式 | 终端 |
| --- | --- | --- |
| Windows | 安装 Git、Node.js 24.x；使用容器数据库时安装并启动 Docker Desktop，启用 WSL 2 / Linux containers | PowerShell |
| macOS Intel | 安装 Git、Node.js 24.x 的 x64 版本；Docker Desktop 选择 Intel chip 版本 | Terminal（zsh / bash） |
| Ubuntu | 安装 Git、Node.js 24.x；使用容器数据库时安装 Docker Engine 和 Compose 插件 | bash / zsh |

安装参考：[Node.js](https://nodejs.org/en/download)、[pnpm](https://pnpm.io/installation)、[Windows Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)、[Mac Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/)、[Ubuntu Docker Engine](https://docs.docker.com/engine/install/ubuntu/)。Docker 的系统要求以官方说明为准。

已安装 Corepack 时，可用以下命令启用项目指定的 pnpm；Windows 若遇到安装目录权限问题，可在管理员终端中执行这两条命令：

```sh
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

若提示找不到 Corepack，请按 pnpm 官方安装说明安装 pnpm。不要使用 npm 或 yarn 安装本项目依赖。

检查环境：

```sh
node --version
pnpm --version
git --version
```

使用 Docker 数据库时，再检查：

```sh
docker --version
docker compose version
```

## 2. 下载源码与安装依赖

以下命令三种系统通用：

```sh
git clone https://github.com/wangzeya58-rgb/-AI-RoboEdu.git AI-RoboEdu
cd AI-RoboEdu
pnpm install --frozen-lockfile
```

后续命令均在包含 `package.json` 的项目根目录执行。不要跨系统复制 `node_modules`，换系统后重新安装依赖。

## 3. 配置本地环境

首次部署时，从示例创建 `.env.local`。已有配置时不要覆盖。

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

macOS Intel / Ubuntu：

```sh
cp .env.example .env.local
```

编辑 `.env.local`，至少设置以下内容；示例中的密码必须自行替换：

```dotenv
DATABASE_URL=postgres://ai_roboedu_dev:REPLACE_WITH_DB_PASSWORD@127.0.0.1:5432/ai_roboedu_dev
AUTH_SESSION_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS

ENABLE_DEMO_AUTH=true
NEXT_PUBLIC_ENABLE_DEMO_AUTH=true

AI_CLASSROOM_PROVIDER=local
ROBOT_TOOL_BASE_URL=http://127.0.0.1:8000

BOOTSTRAP_ADMIN_USERNAME=admin.local
BOOTSTRAP_ADMIN_PASSWORD=REPLACE_WITH_ADMIN_PASSWORD
BOOTSTRAP_ADMIN_NAME=Local Admin
```

- `AUTH_SESSION_SECRET` 使用独立随机值，至少 32 个字符。
- 管理员密码至少 8 个字符，不要使用示例占位内容。
- 数据库密码若含 `@`、`:`、`/`、`#` 等字符，在 `DATABASE_URL` 中必须进行 URL 编码；数据库本身配置的仍是原密码。
- `.env.local` 和 `.env.dev-db` 已加入 Git 忽略规则。不要提交密钥、数据库密码或真实账号密码。
- 若终端已设置同名环境变量，应先检查它们是否指向其他环境，避免迁移或初始化错误的数据库。

## 4. 启动 PostgreSQL

### 方式 A：Docker Compose（跨平台）

在项目根目录创建 `.env.dev-db`，写入：

```dotenv
AI_ROBOEDU_DEV_DB=ai_roboedu_dev
AI_ROBOEDU_DEV_USER=ai_roboedu_dev
AI_ROBOEDU_DEV_PASSWORD=REPLACE_WITH_DB_PASSWORD
AI_ROBOEDU_DEV_DB_HOST=127.0.0.1
AI_ROBOEDU_DEV_DB_PORT=5432
```

这里的数据库名、用户名、密码和端口必须与 `.env.local` 的 `DATABASE_URL` 一致。使用专门的本地开发数据库，不要连接生产数据库。

确认 Docker 已运行，再执行：

```sh
docker compose --env-file .env.dev-db -f compose.dev-db.yml up -d
docker compose --env-file .env.dev-db -f compose.dev-db.yml ps
```

等待 PostgreSQL 状态为 `healthy`。如启动失败，查看日志：

```sh
docker compose --env-file .env.dev-db -f compose.dev-db.yml logs --tail 50 postgres
```

数据保存在命名卷中。重新启动容器不会清空数据；已有数据卷时，修改环境文件不会自动修改数据库账号密码。不要用删除数据卷的方式处理已有课程数据库。

### 方式 B：本机 PostgreSQL

已有 PostgreSQL 15 / 16 时，可不安装 Docker。使用数据库管理工具或 `psql` 创建专用用户和数据库，使该用户拥有数据库及迁移所需权限，再填写 `.env.local`。

连接方式示例（需要已安装 `psql`）：

```sh
psql -h 127.0.0.1 -U ai_roboedu_dev -d ai_roboedu_dev
```

## 5. 迁移数据库与创建管理员

数据库可连接后，三种系统都执行：

```sh
node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/seed-admin.ts
```

这里显式加载 `.env.local`，因为独立的 Drizzle 和初始化脚本不会像 Next.js 一样自动读取该文件。

迁移使用仓库已有的 `drizzle/` 文件，不需要重新生成迁移或执行 `db:push`。数据库已有管理员时，初始化脚本会拒绝重复创建，不会重置密码。

## 6. 启动网页

Windows、macOS Intel、Ubuntu 使用同一条命令：

```sh
pnpm exec next dev --hostname 127.0.0.1 --port 5000
```

浏览器访问：**http://localhost:5000**。终端需要保持运行，按 `Ctrl+C` 停止网页。

这里直接使用 Next.js CLI，避免依赖 Coze CLI、Bash 或 Linux 的 `ss` 命令。仓库原有 `pnpm run dev` / `pnpm run start` 是基于 shell 的部署脚本，不作为本说明的 Windows 原生启动方式。

端口被占用时先停止旧服务，或改用：

```sh
pnpm exec next dev --hostname 127.0.0.1 --port 5001
```

此时访问 http://localhost:5001。不要为了启动本项目而强制结束未知服务。

### 登录与最短验收

1. 访问 `/login`，使用初始化时设置的 `admin.local` 和自己的管理员密码登录。
2. 使用现有账号管理流程准备教师、学生账号，验证班级、发布课程及授权访问。
3. 学生进入课程播放器，切换章节、主动标记完成，刷新后确认进度保留。
4. 打开 AI 小老师，验证当前章节问答；默认 `local` 模式不代表真实模型已经接通。

仅需界面体验时，可在启用 Demo 的本地环境使用：

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 学生 Demo | `student` | `123456` |
| 教师 Demo | `teacher` | `123456` |
| 管理员 Demo | `admin` | `123456` |

Demo 与正式账号数据隔离，不能把 Demo 结果当成正式数据库验证。对外部署时不要开放这些演示账号，关闭两个 Demo 开关并检查部署环境。

## 7. 可选：配置真实 AI 小老师

在 `.env.local` 中配置已有的兼容 Chat Completions 的模型服务：

```dotenv
AI_CLASSROOM_PROVIDER=openai-compatible
AI_CLASSROOM_BASE_URL=https://YOUR_PROVIDER_HOST/v1
AI_CLASSROOM_MODEL=YOUR_MODEL_NAME
AI_CLASSROOM_API_KEY=YOUR_API_KEY
AI_CLASSROOM_TIMEOUT_MS=30000
```

使用服务商实际提供的地址和模型名称，修改后重启网页进程。Key 只放服务端环境变量，不要加 `NEXT_PUBLIC_` 前缀，不要写入前端源码。

未配置模型时保持 `AI_CLASSROOM_PROVIDER=local`，可继续开发课程和账号功能，但这不是云端模型验收。课程 AI 负责教学答疑，不调用机器人动作工具。

## 8. 可选：连接小车或仿真器

- `/car-control` 是实车控制页，页面中填写小车 FastAPI 地址，默认 `http://127.0.0.1:8000`。
- `/simulator` 使用独立的仿真控制接口；实车与仿真器不能共用运动控制出口。
- 浏览器运行在另一台电脑时，`127.0.0.1` 指浏览器所在电脑，应改为机器人服务所在主机的局域网地址，并检查防火墙和 CORS。
- 服务端 Robot Tool Layer 使用 `.env.local` 中的 `ROBOT_TOOL_BASE_URL`；它与页面保存的地址是不同配置项。
- Windows / macOS 部署此网页不等于可以直接运行当前 ROS Noetic 小车程序。小车 FastAPI、ROS 和 FSGP 的环境与启动方式请在各自仓库配置。
- 未连接硬件时不要按运动按钮。网页部署和课程验收不需要发送控制指令。

## 9. 可选：本地生产构建

先完成环境配置、数据库迁移，再执行以下跨平台构建命令：

```sh
pnpm exec next build --webpack
pnpm exec tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify
```

Windows PowerShell 启动生产服务：

```powershell
$env:COZE_PROJECT_ENV = "PROD"
$env:PORT = "5000"
$env:HOSTNAME = "127.0.0.1"
node --env-file=.env.local dist/server.js
```

macOS Intel / Ubuntu：

```sh
COZE_PROJECT_ENV=PROD PORT=5000 HOSTNAME=127.0.0.1 node --env-file=.env.local dist/server.js
```

访问 http://localhost:5000。生产服务仍需数据库及环境配置，并非双击 HTML 即可运行的静态网站。正式对外部署前，关闭 Demo，替换密钥并配置 HTTPS；原有服务器部署资料保留在 [docs/DEPLOY.md](./docs/DEPLOY.md)。

## 10. 常见问题

| 问题 | 检查方式 |
| --- | --- |
| `pnpm` 找不到 / PowerShell 禁止运行脚本 | 检查 pnpm 安装和终端权限；若仅 `.ps1` 被策略阻止，可使用 `pnpm.cmd`，无需关闭全局安全策略 |
| Node 不认识 `--env-file` | 确认正在使用 Node.js 24.x，而非系统中的旧版本 |
| Windows 提示找不到 `bash` 或 `ss` | 使用本文的 `pnpm exec next dev`，不要直接运行 Linux 部署脚本 |
| 数据库连接被拒绝 | 检查 PostgreSQL 是否启动、端口是否一致，以及 `.env.local` 是否正确加载 |
| 5432 端口冲突 | 改 `.env.dev-db` 中的宿主机端口，同时更新 `DATABASE_URL`，然后重新启动容器 |
| `relation does not exist` | 确认在同一数据库执行了第 5 节的迁移 |
| 管理员已经存在 | 使用已有正式管理员，不要重复初始化或直接删除用户数据 |
| AI 返回本地提示而非真实回答 | 检查 provider、地址、模型、Key，重启网页；不要在截图或日志中泄露 Key |
| 雷达、视频未连接 | 分别检查 FastAPI 与 ROS 传感器节点；网页本身不会启动它们 |
| GitHub 下载出现 TLS 错误 | 可尝试 `git -c http.version=HTTP/1.1 clone https://github.com/wangzeya58-rgb/-AI-RoboEdu.git AI-RoboEdu`；不要关闭 TLS 校验 |

## 11. 项目结构与检查

```text
src/app/                 页面与 /api/v1 服务端路由
src/components/          课程播放器、AI 小老师及 UI 组件
src/lib/                 认证、班级、课程、AI 和控制 API
src/storage/database/    Drizzle schema 与数据库连接
src/server.ts            自定义 HTTP 服务入口
drizzle/                 数据库迁移
scripts/                 测试、构建及部署脚本
public/                  静态资源与运行时配置
docs/                    接口、进度及部署文档
```

常用静态检查及不依赖真实机器人的测试：

```sh
pnpm run ts-check
pnpm run lint:build
pnpm exec tsx scripts/test-car-control.ts
```

数据库集成测试可能写入测试数据，运行前请阅读对应脚本并确认使用专用开发数据库。本文列出了跨平台命令，但 Windows 和 Intel Mac 的实际安装、启动仍需在对应机器验收，不将 Ubuntu 验证结果视为三平台均已实测通过。
