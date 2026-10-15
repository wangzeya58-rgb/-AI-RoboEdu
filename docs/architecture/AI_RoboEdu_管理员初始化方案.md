# AI RoboEdu 管理员初始化方案

> Phase 3B-3 已提供命令行初始化脚本，不提供公开 Web 注册入口。

## 目标

正式产品不能继续依赖 Demo 账号 `admin / 123456`。首次部署时需要一个可审计、可关闭、不可被公网随意调用的公司管理员初始化流程。

## 推荐方案

采用一次性命令行初始化：

```bash
DATABASE_URL=postgres://... \
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_PASSWORD='change-me' \
BOOTSTRAP_ADMIN_NAME='公司管理员' \
pnpm run db:seed-admin
```

当前脚本：`scripts/seed-admin.ts`，对应命令：`pnpm run db:seed-admin`。

脚本约束：

- 只在服务器命令行执行，不提供公开 Web 注册入口。
- 如果数据库中已存在 `role = 'admin'` 的用户，默认拒绝再次初始化。
- 密码写入 `password_hash`，当前使用 Node 内置 `crypto.scrypt`。
- 密码明文只允许来自环境变量或交互输入，不能写入源码、日志或 migration。
- 初始化完成后输出用户 ID、用户名和创建时间，不输出密码。

## 数据写入

管理员记录写入 `users` 表：

- `username`：来自 `BOOTSTRAP_ADMIN_USERNAME`
- `password_hash`：由后续脚本使用安全哈希生成
- `name`：来自 `BOOTSTRAP_ADMIN_NAME`
- `role`：`admin`
- `created_at`：数据库当前时间

## 安全边界

- Demo 登录保留给迁移期使用，但不能作为正式管理员权限来源。
- 服务端鉴权上线后，管理员权限必须从数据库 session 读取。
- 后续如果增加 Web 初始化端点，必须要求部署密钥、内网访问限制和一次性关闭开关。

## 后续落地步骤

1. 配置 `DATABASE_URL`、`AUTH_SESSION_SECRET`。
2. 执行 `pnpm run db:migrate`。
3. 执行 `pnpm run db:seed-admin`。
4. 启动服务后执行 `pnpm run auth:test-login` 做登录联调。
5. 完成真实登录后，生产环境不要开启 `NEXT_PUBLIC_ENABLE_DEMO_AUTH`。
