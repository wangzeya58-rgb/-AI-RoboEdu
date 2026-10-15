# API 接口文档

> **Aero Lark 教育平台** RESTful API
> 当前主版本：`v1`（兼容 `/api/*` 自动重定向到 `/api/v1/*`）

---

## 一、基础信息

| 项目 | 说明 |
| ---- | ---- |
| Base URL（生产） | `https://<your-domain>/api/v1` |
| Base URL（开发） | `http://localhost:5000/api/v1` |
| 数据格式 | `application/json; charset=utf-8` |
| 鉴权 Header | `x-user-id: <user-uuid>` |
| 通用响应头 | `X-API-Version: v1` |
| CORS | 允许所有来源（`Access-Control-Allow-Origin: *`） |

---

## 二、统一响应格式

```ts
// 成功
{ "success": true,  "code": 0,    "message": "ok",   "data": <T> }

// 失败
{ "success": false, "code": 10001, "message": "未登录", "data": null }
```

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `success` | boolean | 是否成功 |
| `code` | number | 业务码（0=成功，其他见错误码表） |
| `message` | string | 人类可读消息 |
| `data` | any | 业务数据，失败时为 null |

---

## 三、统一错误码

| 范围 | 模块 |
| ---- | ---- |
| `0` | 成功 |
| `1xxxx` | 通用：参数缺失 / 类型错误 / 鉴权 / 权限 |
| `10xxx` | 通用系统错误（未捕获异常） |
| `11xxx` | 鉴权与 Session |
| `12xxx` | 用户模块 |
| `13xxx` | 课程模块 |
| `14xxx` | 资源模块（programs/trainings/resources/models） |
| `15xxx` | 设备/反馈/帮助中心 |
| `20xxx` | API 版本错误（v2 预览） |
| `-1`  | 网络/超时（客户端封装层抛出） |

详细见 `src/lib/api/errors.ts`。

---

## 四、接口清单

### 4.1 健康检查

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/_internal/health` | ❌ | 服务探活 + DB 延迟 |

**响应示例**
```json
{ "success": true, "code": 0, "message": "服务正常",
  "data": { "status": "ok", "version": "v1", "uptimeMs": 12,
            "services": { "supabase": { "ok": true, "latencyMs": 8 } } } }
```

### 4.2 鉴权 Auth

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| POST | `/api/v1/auth/role-login` | ❌ | 老师/管理员按手机号+验证码登录（验证码 = `888888`） |
| POST | `/api/v1/auth/sms/send-code` | ❌ | 发送短信验证码（5 分钟有效，1 分钟防刷） |
| POST | `/api/v1/auth/sms/register`  | ❌ | 学员/老师/管理员注册 |

**登录**
```http
POST /api/v1/auth/role-login
Content-Type: application/json
```
```json
{ "phone": "13800000001", "code": "888888", "role": "teacher" }
```
返回：
```json
{ "success": true, "code": 0, "message": "登录成功",
  "data": { "id": "uuid", "name": "张老师", "phone": "13800000001", "role": "teacher", "class_menu_locked": false } }
```

**注册角色**：`student`（默认）/ `teacher` / `admin`，非法值自动降级为 `student`。

### 4.3 课程 Courses

**正式学习进度**（HttpOnly 登录 cookie，Demo 不可用）

| 方法 | 路径 | 权限与含义 |
| ---- | ---- | ---- |
| GET | `/api/v1/courses/progress` | 正式学生本人所有获准课程的进度摘要 |
| GET | `/api/v1/courses/:id/progress` | 正式学生本人进度；每次检查课程访问权限 |
| POST | `/api/v1/courses/:id/progress` | `{lessonId, completed?: boolean}`；访问默认只更新最近章节，只有 `completed:true` 幂等追加完成记录，不接受他人账号归属 |
| GET | `/api/v1/classes/:id/courses/:courseId/progress` | 所属教师查看自己班级已发布课程的获准学生进度；学生/其他教师拒绝访问 |

摘要包含 `courseId, completedLessonIds, lastLessonId, lastStudiedAt, totalLessons, completedLessons, percent, status`。状态为 `not_started / learning / completed`，百分比由服务端按当前章节计算。教师响应包含 `classId, courseId, courseTitle, totalLessons, students`；每位学生附带账号 ID、姓名及摘要。最近学习时间使用服务端时间。数据库需先应用 `0003_pretty_stone_men` 迁移；无记录的学生返回未开始、0%，空章节课程不能显示100%。

**正式教学课程流程（当前实现，Phase 5-4）**

以下接口使用正式登录产生的 HttpOnly session cookie。正式课程与下方历史审核接口说明分开；当前正式创建请求为 `{title, description?}`，发布到班级表示建立课程分配，不代表管理员审核状态变化。

| 方法 | 路径 | 权限 / 说明 |
| ---- | ---- | ---- |
| POST | `/api/v1/courses` | 正式教师创建自己的课程 |
| GET | `/api/v1/courses/:id/lessons` | 所属教师或已批准加入发布班级的学生读取章节 |
| POST | `/api/v1/courses/:id/lessons` | 所属教师添加 `{title, content, order}` |
| PATCH | `/api/v1/courses/:id/lessons/:lessonId` | 所属教师修改 `{title, content}`，同时校验章节属于该课程；保留原顺序 |
| POST | `/api/v1/courses/:id/classes` | 所属教师分配到自己的班级 `{classId}` |
| GET / POST | `/api/v1/courses/:id/lessons/:lessonId/ai` | 同课程读取权限；POST 使用 `{question, history?}`，上下文由服务端读取 |

章节编辑错误：未登录 401，学生/非所属教师 403，章节与课程不匹配 404，空标题/正文 400。Demo 身份不能读写正式课程。课程 AI 不执行机器人工具。

| 方法 | 路径 | 鉴权 | 角色 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| GET    | `/api/v1/courses` | ✅ | 任意 | 课程列表；管理员看全部，老师/学员仅看自己 |
| POST   | `/api/v1/courses` | ✅ | teacher/admin | 创建课程（`action=draft` 草稿 / `submit` 提交审核 / `publish` 直接上架） |
| GET    | `/api/v1/courses/:id` | ✅ | 任意 | 课程详情（含 materials） |
| PATCH  | `/api/v1/courses/:id` | ✅ | teacher（自己）/ admin | 编辑课程 |
| DELETE | `/api/v1/courses/:id` | ✅ | admin | 删除课程 |
| POST   | `/api/v1/courses/:id/review` | ✅ | admin | 审核 `approve` / `reject`（驳回需传 `reason`） |
| POST   | `/api/v1/courses/:id/toggle-status` | ✅ | admin | 上下架（approved ↔ offline） |

**创建课程（老师提交审核）**
```http
POST /api/v1/courses
x-user-id: <teacher-uuid>
```
```json
{
  "title": "智能小车视觉入门",
  "category": "ai_basics",
  "description": "课程简介",
  "duration_minutes": 60,
  "action": "submit",
  "materials": [
    { "type": "video", "name": "lesson1.mp4", "url": "...", "size": 1024 }
  ]
}
```

**审核（管理员）**
```json
{ "action": "reject", "reason": "内容不完整，请补充示例" }
```

### 4.4 用户 Users

| 方法 | 路径 | 鉴权 | 角色 | 说明 |
| ---- | ---- | ---- | ---- | ---- |
| GET    | `/api/v1/users` | ✅ | admin | 用户列表（可按 `?role=` 过滤） |
| PATCH  | `/api/v1/users/:id` | ✅ | admin | 编辑用户（name/role/class_menu_locked） |
| DELETE | `/api/v1/users/:id` | ✅ | admin | 重置用户业务数据（保留账号） |

### 4.5 程序 Programs（学生源码头）

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/programs` | ✅ | 程序列表，支持 `?category=&teacher_id=` |
| POST | `/api/v1/programs` | ✅ | 创建程序文件 |

### 4.6 培训 Trainings

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/trainings` | ✅ | 培训项目列表 |
| POST | `/api/v1/trainings` | ✅ | 创建培训项目（管理员） |

### 4.7 教学资源 Teaching Resources

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/teaching-resources` | ✅ | 公开教学资源列表，支持搜索/分类 |
| POST | `/api/v1/teaching-resources` | ✅ | 新增教学资源 |

### 4.8 AI 模型 AI Models

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/ai-models` | ✅ | 模型列表（按 `owner_id` 隔离） |
| POST | `/api/v1/ai-models` | ✅ | 新建模型 |

### 4.9 帮助中心 Help Centers（公共）

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/help-centers` | ✅ | 帮助文档列表，支持 `?category=&q=` |
| POST | `/api/v1/help-centers` | ✅ | 新增帮助（管理员） |

### 4.10 问题反馈 Feedbacks

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/feedbacks` | ✅ | 我的反馈 / 全部（管理员） |
| POST | `/api/v1/feedbacks` | ✅ | 提交反馈 |

### 4.11 设备 Devices

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/devices` | ✅ | 设备连接列表（含 USB/WiFi/热点） |
| POST | `/api/v1/devices` | ✅ | 注册新设备 |

### 4.12 仪表盘 Dashboard

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET | `/api/v1/dashboard` | ✅ | 首页统计数据（按角色返回不同 metrics） |

### 4.13 扩展占位

| 方法 | 路径 | 鉴权 | 说明 |
| ---- | ---- | ---- | ---- |
| GET  | `/api/v1/_extensions/empty` | ❌ | 空模板（ping/pong） |
| POST | `/api/v1/_extensions/empty` | ❌ | 占位（返回 501） |

### 4.14 v2 预览

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET/POST | `/api/v2/_preview` | v2 占位，返回 `code=20001` 提示 v2 尚未启用 |

---

## 五、客户端调用

统一封装：`src/lib/api/client.ts`

```ts
import { api, ApiClientError } from '@/lib/api/client';

// GET
const data = await api.get<{ list: Course[] }>('/courses', { status: 'pending' });

// POST
const created = await api.post<Course>('/courses', {
  title: 'xxx', category: 'ai_basics', action: 'submit',
});

// 错误处理
try {
  await api.post('/courses', payload);
} catch (e) {
  if (e instanceof ApiClientError) {
    console.error(e.code, e.message);
  }
}
```

拦截器：
```ts
import { addRequestInterceptor, addResponseInterceptor } from '@/lib/api/client';

addRequestInterceptor(({ url, init }) => {
  // 注入 token
  return { url, init };
});
```

---

## 六、跨域（CORS）

`next.config.ts` 已配置 `/api/*` 全局响应头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id, x-session
Access-Control-Max-Age: 86400
```

预检（OPTIONS）由 Next.js 自动返回 204。
