## 一、环境准备

请安装：

- Git
- Node.js 24.x
- pnpm 9.0.0
- PostgreSQL 16，或 Docker 数据库环境

各系统说明：

| 系统 | 说明 |
|---|---|
| Windows | 使用 PowerShell；容器数据库可使用 Docker Desktop |
| macOS Intel | 使用 Terminal；Node.js 选择 x64，Docker Desktop 选择 Intel 版本 |
| Ubuntu | 使用 bash / zsh；容器数据库安装 Docker Engine 和 Compose 插件 |

已安装 Corepack 时执行：

corepack enable
corepack prepare pnpm@9.0.0 --activate

如果没有 Corepack，请参考 pnpm 安装说明。

检查环境：

node --version
pnpm --version
git --version

本项目使用 pnpm 管理依赖，不使用 npm 或 yarn。

## 二、下载项目

三种系统均可执行：

git clone https://github.com/wangzeya58-rgb/-AI-RoboEdu.git AI-RoboEdu
cd AI-RoboEdu
pnpm install --frozen-lockfile

后续命令均在项目根目录执行。

不要跨操作系统复制 node_modules，应重新安装依赖。

## 三、配置环境变量

首次配置时，从示例创建 .env.local。已有配置不要覆盖。

Windows PowerShell：

Copy-Item .env.example .env.local

macOS Intel / Ubuntu：

cp .env.example .env.local

编辑 .env.local：

DATABASE_URL=postgres://ai_roboedu_dev:REPLACE_WITH_DB_PASSWORD@127.0.0.1:5432/ai_roboedu_dev

AUTH_SESSION_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS

ENABLE_DEMO_AUTH=true
NEXT_PUBLIC_ENABLE_DEMO_AUTH=true

AI_CLASSROOM_PROVIDER=local

ROBOT_TOOL_BASE_URL=http://127.0.0.1:8000

BOOTSTRAP_ADMIN_USERNAME=admin.local
BOOTSTRAP_ADMIN_PASSWORD=REPLACE_WITH_ADMIN_PASSWORD
BOOTSTRAP_ADMIN_NAME=Local Admin

注意：

- 替换所有占位值。
- 会话密钥使用至少 32 个字符的独立随机值。
- 管理员密码至少 8 个字符。
- 数据库密码包含特殊字符时，连接 URL 中的密码需进行 URL 编码。
- 不要提交 .env.local、真实密码或 API Key。
- 执行迁移前检查终端是否存在指向其他数据库的同名环境变量。

## 四、准备数据库

### 方式 A：Docker Compose

在项目根目录创建 .env.dev-db：

AI_ROBOEDU_DEV_DB=ai_roboedu_dev
AI_ROBOEDU_DEV_USER=ai_roboedu_dev
AI_ROBOEDU_DEV_PASSWORD=REPLACE_WITH_DB_PASSWORD
AI_ROBOEDU_DEV_DB_HOST=127.0.0.1
AI_ROBOEDU_DEV_DB_PORT=5432

数据库名、用户名、密码和端口必须与 .env.local 一致。

启动 Docker 后执行：

docker compose --env-file .env.dev-db -f compose.dev-db.yml up -d
docker compose --env-file .env.dev-db -f compose.dev-db.yml ps

等待数据库状态为 healthy。

查看日志：

docker compose --env-file .env.dev-db -f compose.dev-db.yml logs --tail 50 postgres

数据保存在命名卷中。已有数据卷时，修改配置文件不会自动修改数据库密码。不要随意删除数据卷。

### 方式 B：本机 PostgreSQL

也可使用本机 PostgreSQL 15 / 16。

创建专用用户和数据库，授予迁移所需权限，并将连接信息填写到 .env.local。

不要使用生产数据库进行本地开发或测试。

## 五、迁移数据库和初始化管理员

三种系统使用相同命令：

node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/seed-admin.ts

这里显式加载 .env.local，避免独立脚本遗漏环境配置。

使用仓库已有迁移，不需要重新生成迁移或执行 db:push。

如果数据库中已有管理员，初始化脚本会拒绝重复创建，不会重置密码。

## 六、启动网页

Windows、macOS Intel、Ubuntu 均执行：

pnpm exec next dev --hostname 127.0.0.1 --port 5000

浏览器访问：

http://localhost:5000

终端保持运行，按 Ctrl+C 停止。

如果端口被占用：

pnpm exec next dev --hostname 127.0.0.1 --port 5001

随后访问 http://localhost:5001。

> 本说明直接使用 Next.js CLI。仓库原有开发和部署脚本依赖 Bash，部分还使用 Linux 命令，不建议在 Windows PowerShell 中直接运行。

## 七、登录与体验

### 正式账号

使用初始化时配置的管理员用户名和密码登录。

正式流程包括：

1. 准备教师和学生账号。
2. 创建班级和课程。
3. 教师编辑章节并发布课程。
4. 学生查看授权课程。
5. 学生主动标记章节完成，保存学习进度。
6. 围绕当前章节向 AI 小老师提问。

### Demo 账号

本地开启 Demo 后可使用：

| 角色 | 用户名 | 密码 |
|---|---|---|
| 学生 | student | 123456 |
| 教师 | teacher | 123456 |
| 管理员 | admin | 123456 |

Demo 与正式账号数据隔离，不能将 Demo 体验视为正式数据库验收。

对外部署时关闭 Demo 开关，不要开放演示账号。

## 八、配置 AI 小老师

默认：

AI_CLASSROOM_PROVIDER=local

此模式无需真实模型 Key，但不代表已连接云端模型。

接入兼容 Chat Completions 的服务时，配置：

AI_CLASSROOM_PROVIDER=openai-compatible
AI_CLASSROOM_BASE_URL=https://YOUR_PROVIDER_HOST/v1
AI_CLASSROOM_MODEL=YOUR_MODEL_NAME
AI_CLASSROOM_API_KEY=YOUR_API_KEY
AI_CLASSROOM_TIMEOUT_MS=30000

使用服务商提供的实际地址和模型名称，修改后重启网页。

API Key 仅保存在服务端环境变量中，不要添加 NEXT_PUBLIC_ 前缀，也不要写入前端源码。

课程 AI 用于知识讲解、章节答疑和实验提示，不调用机器人动作工具。

## 九、小车与仿真器

- /car-control：实车控制平台。
- /simulator：独立仿真器控制页面。
- 小车 FastAPI 默认地址为 http://127.0.0.1:8000。
- 页面保存的 FastAPI 地址与服务端 ROBOT_TOOL_BASE_URL 是不同配置项。
- 浏览器与机器人不在同一电脑时，需要填写机器人主机的局域网地址。
- 实车和仿真器使用独立控制接口与运动话题，不得混用。
- Windows / macOS 能运行网页，不表示能直接运行现有 ROS Noetic 小车程序。
- 未连接设备时出现视频、雷达不可用提示属于正常情况。

课程学习和 AI 答疑不需要启动 ROS，也不需要发送任何运动指令。

## 十、本地生产构建

完成环境配置和数据库迁移后执行：

pnpm exec next build --webpack
pnpm exec tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

Windows PowerShell：

$env:COZE_PROJECT_ENV = "PROD"
$env:PORT = "5000"
$env:HOSTNAME = "127.0.0.1"
node --env-file=.env.local dist/server.js

macOS Intel / Ubuntu：

COZE_PROJECT_ENV=PROD PORT=5000 HOSTNAME=127.0.0.1 node --env-file=.env.local dist/server.js

访问 http://localhost:5000。

本项目包含服务端和数据库功能，不是双击 HTML 即可运行的静态网站。

对外部署前应关闭 Demo、替换密钥并配置 HTTPS。服务器部署资料见 docs/DEPLOY.md (./docs/DEPLOY.md)。

## 十一、常见问题

| 问题 | 处理方式 |
|---|---|
| 找不到 pnpm | 检查安装和 PATH，重新打开终端 |
| PowerShell 阻止 pnpm.ps1 | 可使用 pnpm.cmd，不要关闭全局安全策略 |
| 不认识 --env-file | 检查是否使用 Node.js 24.x |
| Windows 找不到 bash 或 ss | 使用本文的 Next.js CLI 启动命令 |
| 数据库连接失败 | 检查服务、端口、密码和环境文件 |
| 5432 端口冲突 | 同步修改容器宿主机端口与 DATABASE_URL |
| 数据表不存在 | 执行数据库迁移，确认连接同一数据库 |
| 管理员已存在 | 使用已有账号，不要重复初始化或删除用户数据 |
| AI 未连接真实模型 | 检查 provider、模型、地址及 Key，然后重启 |
| 视频或雷达不可用 | 检查独立 FastAPI 服务和 ROS 传感器节点 |

## 十二、项目结构

src/app/                 页面和服务端 API
src/components/          课程播放器、AI 小老师及 UI
src/lib/                 认证、课程、班级、AI 和控制 API
src/storage/database/    数据库连接与 schema
src/server.ts            自定义 HTTP 服务入口
drizzle/                 数据库迁移
scripts/                 测试与部署脚本
public/                  静态资源
docs/                    接口及项目文档
