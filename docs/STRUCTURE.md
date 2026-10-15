# 目录结构说明

> Aero Lark 教育平台 - 标准化分层结构

## 一、整体目录

```
.
├── docs/                          # 项目文档
│   ├── API.md                     # 接口文档
│   ├── STRUCTURE.md               # 本文件 - 目录结构说明
│   └── ITERATION.md               # 迭代扩展使用规则
├── public/                        # 静态资源
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (pages)/               # 业务页面
│   │   │   ├── page.tsx           # 首页
│   │   │   ├── login/             # 登录页
│   │   │   ├── register/          # 注册页（学员/老师/管理员 三身份）
│   │   │   ├── teacher/           # 老师工作台
│   │   │   ├── admin/             # 管理员后台
│   │   │   └── ...                # 其他业务页面
│   │   ├── api/                   # API 路由（详见下方）
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/                # 通用组件
│   │   ├── ui/                    # shadcn/ui 原子组件
│   │   ├── Sidebar.tsx
│   │   ├── Layout.tsx
│   │   └── portal/                # 教师/管理员门户组件
│   ├── lib/                       # 工具库
│   │   ├── api/                   # API 核心库
│   │   │   ├── response.ts        # 统一响应包装
│   │   │   ├── errors.ts          # 错误码与 ApiError
│   │   │   ├── handler.ts         # withApi handler 包装器
│   │   │   ├── validation.ts      # 参数校验工具
│   │   │   ├── auth.ts            # 鉴权工具（requireSession/requireRole）
│   │   │   ├── roles.ts           # 角色与权限定义
│   │   │   └── client.ts          # 客户端 fetch 封装
│   │   └── utils.ts
│   ├── storage/
│   │   └── database/
│   │       ├── supabase-client.ts # Supabase 客户端封装
│   │       └── shared/schema.ts   # Drizzle/共享类型
│   └── middleware.ts              # Next.js 全局中间件（CORS/日志/安全头）
├── next.config.ts                 # Next.js 配置（含 rewrites/headers）
├── tsconfig.json
└── package.json
```

## 二、API 路由分层

```
src/app/api/
├── v1/                            # 当前主版本（v1）
│   ├── auth/                      # 鉴权模块
│   │   ├── role-login/route.ts    # POST 老师/管理员登录
│   │   └── sms/
│   │       ├── send-code/route.ts # POST 发送验证码
│   │       └── register/route.ts  # POST 注册
│   ├── courses/                   # 课程模块
│   │   ├── route.ts               # GET 列表 / POST 创建
│   │   └── [id]/
│   │       ├── route.ts           # GET 详情 / PATCH 编辑 / DELETE 删除
│   │       ├── review/route.ts    # POST 审核
│   │       └── toggle-status/route.ts  # POST 上下架
│   ├── users/                     # 用户管理
│   │   ├── route.ts               # GET 列表
│   │   └── [id]/route.ts          # PATCH / DELETE
│   ├── programs/                  # 程序文件
│   ├── trainings/                 # 培训项目
│   ├── teaching-resources/        # 教学资源
│   ├── ai-models/                 # AI 模型
│   ├── help-centers/              # 帮助中心（公共）
│   ├── feedbacks/                 # 问题反馈
│   ├── devices/                   # 设备连接
│   ├── dashboard/                 # 首页统计
│   ├── _internal/                 # 内部接口（不开放给前端）
│   │   └── health/route.ts
│   └── _extensions/               # 扩展占位（供后续新增）
│       └── empty/route.ts         # 空模板（复制即用）
└── v2/                            # 下一版本（占位，未启用）
    └── _preview/route.ts
```

### 2.1 正式接口区（`/api/v1/...`）

业务接口，规范如下：

| 规则 | 说明 |
| ---- | ---- |
| 命名 | 全部小写 + 中划线，如 `teaching-resources` |
| 文件 | 每个端点一个 `route.ts` |
| 入口 | 通过 `withApi(handler, { methods })` 包装 |
| 响应 | 使用 `ok(data)` / `fail(message, code)`，禁止手写 `NextResponse.json` |
| 鉴权 | `requireSession(req)` + `requireRole(user, ['admin', 'teacher'])` |
| 校验 | `parseJson(req, schema)` 校验 Body，`requireString(req, 'key')` 校验单字段 |
| 错误 | 抛 `ApiError.badRequest('xxx')` 等，统一由 `withApi` 捕获 |

### 2.2 内部接口区（`/api/v1/_internal/...`）

> 以下划线开头，表示"非业务"，不对外文档化、不计入主接口清单。

适用：
- 健康检查 `_internal/health`
- 内部统计 / 监控探针
- 系统级批处理

### 2.3 扩展预留区（`/api/v1/_extensions/...`）

> 给后续"快速加新接口"准备模板。

`_extensions/empty/route.ts` 是一个**空模板**，包含：
- `withApi` 包装
- `ApiError.notImplemented` 占位

复制此目录到目标模块目录即可开始业务开发。

### 2.4 多版本目录（`/api/v2/...`）

为不兼容演进预留。当前仅 `_preview` 占位接口。

**升级规则**：
1. 不破坏 v1 的字段语义 → 继续在 v1 迭代
2. v1 字段调整 / 路径重写 → 新增 v2 路径
3. v2 启用前必须保留 v1 至少 6 个月

## 三、前端分层

```
src/app/
├── (pages)            # 业务页面
│   ├── page.tsx       # 首页
│   ├── login/
│   ├── register/
│   ├── teacher/       # 老师工作台
│   ├── admin/         # 管理员后台
│   ├── training/      # 学员 AI 训练
│   ├── programming/   # 我的程序
│   ├── help-center/   # 帮助中心
│   └── feedback/      # 问题反馈
└── api/               # 路由处理器（详见上）
```

## 四、关键模块索引

| 模块 | 入口文件 |
| ---- | ---- |
| 鉴权 | `src/lib/api/auth.ts` |
| 角色 | `src/lib/api/roles.ts` |
| API Handler 包装 | `src/lib/api/handler.ts` |
| 错误定义 | `src/lib/api/errors.ts` |
| 响应工具 | `src/lib/api/response.ts` |
| 客户端 SDK | `src/lib/api/client.ts` |
| Supabase 客户端 | `src/storage/database/supabase-client.ts` |
| 中间件 | `src/middleware.ts` |
| Next.js 配置 | `next.config.ts` |
