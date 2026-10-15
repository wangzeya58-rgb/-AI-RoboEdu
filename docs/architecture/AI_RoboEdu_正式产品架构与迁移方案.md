# AI RoboEdu 正式产品架构与迁移方案

> 范围：Phase 3A 只做架构审查与迁移方案设计，不修改现有业务代码，不开始 Phase 3B。
> 项目路径：`/home/zyw/edu-drone-pagebackend/后端/projects`
> 审查日期：2026-10-11

## 1. 现有代码审查结果

### 1.1 身份、Session、角色

相关文件：

- `src/lib/auth/client.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/roles.ts`
- `src/lib/api/auth.ts`
- `src/lib/api/roles.ts`

当前能力：

- Phase 1 已提供统一 Demo 登录，账号为 `student`、`teacher`、`admin`，登录态保存在 `localStorage` 的 `al_session`。
- `getRoleHome` 能按角色跳转：学生 `/`、教师 `/teacher`、管理员 `/admin`。
- 前端组件通过 `al-session-change` 事件刷新登录状态。
- `authFetch` 会把 `x-user-id`、`x-user-role`、`x-user-name` 写入请求头。
- `src/lib/auth/session.ts` 与 `src/lib/api/auth.ts` 都是从请求头读取用户和角色。
- `src/lib/api/roles.ts` 已写明“服务端以 route 内校验为准”的权限思想，但当前没有真实 session 校验。

主要问题：

- `localStorage` 中的用户 ID 和角色完全由浏览器控制，不能作为正式权限依据。
- 请求头 `x-user-role` 可被用户伪造。正式产品必须由服务端 session/JWT 推导用户身份和权限。
- `src/lib/auth/roles.ts` 存在 `USER: 'student'` 兼容别名，而 `src/lib/api/roles.ts` 又有 `user` 角色，正式模型需要统一。
- Demo 用户没有学校维度、账号生命周期、密码安全、禁用状态、审计记录。

### 1.2 班级、学生申请与审核

相关文件：

- `src/lib/classes/demo-class-store.ts`
- `src/app/class/join/page.tsx`
- `src/app/teacher/classes/page.tsx`
- `src/app/teacher/page.tsx`
- `src/app/admin/page.tsx`

当前能力：

- Phase 2 已有本地班级闭环：教师创建班级，学生输入班级 ID 生成 `pending` 申请，教师批准/拒绝/移除学生。
- 本地数据结构已接近正式模型雏形：`DemoClass`、`DemoClassMember`、`pending | approved | rejected`。
- 学生首页会按当前学生 ID 展示已加入、待审核、已拒绝班级。
- 教师端的班级人数和待审核数来自本地数据，不再写死。
- 管理员首页可查看全部 Demo 班级与成员申请状态。

主要问题：

- 所有班级与申请数据在当前浏览器 `localStorage`，多台电脑、多用户无法同步。
- `DemoClass.id` 同时承担内部 ID 与可分享班级码的用途，正式产品必须拆分。
- `authorizedTeacherIds` 仅存在于本地类型，没有后台授权、学校边界和审计。
- 教师“只能操作自己班级”目前由前端函数判断，正式产品必须由服务端校验。

### 1.3 课程模型、课程资源和 IndexedDB

相关文件：

- `src/lib/course/types.ts`
- `src/lib/course/lessons.ts`
- `src/lib/course/course-runtime.ts`
- `src/lib/course/teacher-course-store.ts`
- `src/components/course/CourseResourceManager.tsx`
- `src/app/course/page.tsx`
- `src/app/course/player/page.tsx`
- `src/components/course/CoursePlayer.tsx`

当前能力：

- `src/lib/course/types.ts` 定义了课程播放需要的 `CourseLesson`、`CourseScene`、`ResourceScene`、`CourseProgress`。
- `src/lib/course/lessons.ts` 提供内置公开课程 `mockLessons`。
- `CoursePlayer` 是较清晰的纯前端播放器组件，输入 `CourseLesson` 后负责场景切换、测验答题和 AI 老师面板。
- `teacher-course-store.ts` 使用 IndexedDB 保存教师自建课程、资源元数据和 Blob 文件。
- `CourseResourceManager` 支持新建课程、编辑名称/简介、上传 PDF/PPT/Word/图片/视频、删除资源。
- `/course/player` 能把 IndexedDB 中的教师资源转换为 `ResourceScene`，并通过 `objectUrl` 播放 PDF、图片、视频；PPT/Word 当前仅提示不支持直接预览。

主要问题：

- 教师上传的课程和文件只存在本机 IndexedDB，无法跨电脑、跨账号同步。
- IndexedDB Blob 无服务端访问控制，不能实现班级专属资源授权。
- 课程中心 `/course` 只展示内置 `mockLessons`，没有接入正式课程列表。
- 播放器进度只存在组件 state，没有持久化到用户学习进度。
- 文件格式转换能力缺失：PPT/Word 没有服务端转换或预览流水线。

### 1.4 教师和管理员课程页面

相关文件：

- `src/app/teacher/dashboard/page.tsx`
- `src/app/admin/courses/page.tsx`
- `src/app/admin/courses/new/page.tsx`
- `src/app/admin/courses/edit/page.tsx`
- `src/app/admin/courses/review/page.tsx`
- `src/components/portal/PortalShell.tsx`

当前能力：

- 教师/管理员存在较完整的 Portal 风格页面。
- 多个页面已经按 `/api/courses` 读取、审核、编辑、删除、上下架课程。
- 管理菜单和课程状态枚举已经存在。

主要问题：

- 项目内没有 `src/app/api` 目录，也没有任何 `route.ts`。这些页面调用的 `/api/courses` 当前缺少实际 Next Route Handler。
- `docs/API.md` 描述了 `/api/v1/courses` 等接口，但实际路由未落地。
- `src/lib/api/client.ts` 默认读取 `localStorage` 的 `aerolark_session`，而 Phase 1 登录写入的是 `al_session`，存在历史命名不一致。

### 1.5 数据库、API、部署与依赖

相关文件：

- `src/storage/database/shared/schema.ts`
- `src/storage/database/shared/relations.ts`
- `src/storage/database/supabase-client.ts`
- `src/lib/api/handler.ts`
- `src/lib/api/response.ts`
- `docs/API.md`
- `docs/DEPLOY.md`
- `deploy/nginx/*`
- `deploy/systemd/edu-platform.service`
- `scripts/build.sh`
- `src/server.ts`
- `package.json`

当前能力：

- `package.json` 已有 `pg`、`drizzle-orm`、`drizzle-kit`、`drizzle-zod`、`@supabase/supabase-js`、`@aws-sdk/client-s3`、`@aws-sdk/lib-storage` 等依赖。
- `schema.ts` 已有用户、课程、课程材料、反馈、训练、模型等表草稿。
- `src/lib/api/handler.ts` 已有统一响应、错误处理、CORS、request id 包装器。
- `src/storage/database/supabase-client.ts` 已有 Supabase client 封装，但依赖 `COZE_SUPABASE_*` 环境变量。
- `src/server.ts` 是自定义 Next.js HTTP server。
- 部署文档和 systemd/nginx 已围绕单个 Next 服务、端口 `5000`、反向代理 `/api/*` 设计。

主要问题：

- 数据库 schema 不覆盖学校、学校成员、班级、班级教师、班级成员申请、课程班级分配、学习进度。
- `relations.ts` 没有包含 `courses`、`course_materials` 关系。
- API 文档与实际代码不一致：文档描述 `/api/v1`，实际没有 Route Handler；`next.config.ts` 当前也没有文档中提到的 `/api/* -> /api/v1/*` rewrites。
- 当前认证封装仍是“信任前端 header”的临时方案。

## 2. 推荐系统架构

### 2.1 推荐方案

推荐 Phase 3B 起采用：

**Next.js Route Handlers + PostgreSQL + 对象存储，后续按负载再拆独立后端服务。**

理由：

- 现有 UI、PortalShell、课程播放器、部署脚本、nginx/systemd 都已围绕 Next 单服务组织。
- 现有依赖已经包含 `pg`、Drizzle、Supabase SDK、S3 SDK，不需要先引入大型后端框架。
- 班级、课程、资源权限本质上是常规 CRUD 与鉴权，Route Handlers 足够支撑第一版正式交付。
- 教学设备控制的 FastAPI/ROS 与学校数据平台边界清晰，应继续作为独立设备控制服务，不应混入主业务数据库服务。
- 先把认证、数据库、文件访问控制补齐，比一次性拆成前后端多服务风险更低。

### 2.2 何时拆独立后端

满足以下任一条件时，再考虑独立后端服务：

- 课程文件转换、视频转码、PPT/Word 解析需要队列和后台 worker。
- 多校并发上传与下载压力明显超过单个 Next 服务能力。
- 需要复杂设备调度、长连接、消息队列、实验任务编排。
- 公司内部已有统一 Java/Go/Python 后端规范，需要接入企业身份、审计和运维体系。

### 2.3 部署形态

第一阶段正式部署：

```text
浏览器
  -> Nginx HTTPS
  -> Next.js 16 standalone / Route Handlers
  -> PostgreSQL
  -> 对象存储（S3/OSS/Supabase Storage）
  -> FastAPI/ROS 设备服务（仅 Ubuntu 实验设备或内网设备）
```

关键边界：

- Windows/macOS 浏览器只访问 Web 平台和文件下载/预览接口。
- Ubuntu 实验设备运行 FastAPI/ROS，用于真实小车控制；Web 平台保存设备配置、实验课程和授权，不直接把 ROS 暴露给公网。
- 文件二进制进入对象存储，数据库只保存元数据、权限范围、存储 key、大小、哈希和版本。

## 3. 正式数据模型与关系

建议统一使用 UUID 作为内部主键。所有可分享给人的短码都作为单独字段，不复用主键。

### 3.1 User 用户

用途：平台账号，不直接代表学校身份。

字段建议：

- `id uuid pk`
- `email varchar unique null`
- `phone varchar unique null`
- `username varchar unique null`
- `password_hash text null`
- `name varchar`
- `global_role varchar`：`company_admin | user`
- `status varchar`：`active | disabled`
- `last_login_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

说明：

- 学生、教师不是全局角色，而应主要通过 `SchoolMembership` 和 `ClassTeacher/ClassMember` 推导。
- 公司管理员是全局角色，可以跨学校管理。

### 3.2 School 学校

字段建议：

- `id uuid pk`
- `name varchar`
- `code varchar unique`
- `status varchar`
- `created_by uuid fk users.id`
- `created_at timestamptz`
- `updated_at timestamptz`

说明：

- `school.code` 是运营/管理识别码，不用于学生直接入班。

### 3.3 SchoolMembership 学校与用户关系

字段建议：

- `id uuid pk`
- `school_id uuid fk schools.id`
- `user_id uuid fk users.id`
- `role varchar`：`school_admin | teacher | student`
- `status varchar`：`active | invited | disabled`
- `created_at timestamptz`
- `updated_at timestamptz`
- unique：`(school_id, user_id, role)`

说明：

- 一个用户可以在多个学校有身份。
- 学校管理员只能管理本学校资源；公司管理员可跨学校。

### 3.4 Class 班级

字段建议：

- `id uuid pk`
- `school_id uuid fk schools.id`
- `name varchar`
- `description text`
- `class_code varchar unique`
- `status varchar`：`active | archived`
- `created_by uuid fk users.id`
- `created_at timestamptz`
- `updated_at timestamptz`

关键区分：

- `id` 是内部数据库主键，不展示为邀请入口。
- `class_code` 是可分享班级码，用于学生申请加入。应支持重置、过期或禁用。
- 用户 ID 只识别用户；班级 ID 识别数据库实体；班级码识别邀请入口。

### 3.5 ClassTeacher 班级教师关系

字段建议：

- `id uuid pk`
- `class_id uuid fk classes.id`
- `teacher_id uuid fk users.id`
- `role varchar`：`owner | manager | assistant`
- `assigned_by uuid fk users.id`
- `created_at timestamptz`
- unique：`(class_id, teacher_id)`

说明：

- 一个教师可以管理多个班级。
- 一个班级可以有主讲老师、助教、授权管理员。
- 教师必须属于同一学校，除非由公司管理员跨校授权。

### 3.6 ClassMember 学生加入申请与成员关系

字段建议：

- `id uuid pk`
- `class_id uuid fk classes.id`
- `student_id uuid fk users.id`
- `status varchar`：`pending | approved | rejected | removed`
- `requested_at timestamptz`
- `reviewed_at timestamptz null`
- `reviewed_by uuid fk users.id null`
- `reject_reason text null`
- `removed_at timestamptz null`
- unique：`(class_id, student_id)`

说明：

- 一个学生可以加入多个班级。
- 拒绝后是否允许重新申请应产品化配置；默认建议保留同一行，允许教师或学校管理员重置为 `pending`，避免重复记录污染。

### 3.7 Course 课程

字段建议：

- `id uuid pk`
- `school_id uuid fk schools.id null`
- `owner_teacher_id uuid fk users.id null`
- `title varchar`
- `subtitle text null`
- `description text`
- `category varchar`
- `level varchar`
- `duration_minutes integer`
- `visibility varchar`：`public | school | class`
- `status varchar`：`draft | pending | approved | rejected | offline | archived`
- `reviewed_by uuid fk users.id null`
- `reviewed_at timestamptz null`
- `reject_reason text null`
- `version integer`
- `created_at timestamptz`
- `updated_at timestamptz`

说明：

- 游客无需登录可看 `visibility=public` 且 `status=approved` 的课程。
- 学校共享课程要求用户属于 `course.school_id` 且课程已上架。
- 班级专属课程必须通过 `CourseClass` 分配，并校验当前用户是对应班级已批准成员或班级教师。

### 3.8 CourseClass 课程与班级关联

字段建议：

- `id uuid pk`
- `course_id uuid fk courses.id`
- `class_id uuid fk classes.id`
- `assigned_by uuid fk users.id`
- `assigned_at timestamptz`
- `available_from timestamptz null`
- `available_until timestamptz null`
- unique：`(course_id, class_id)`

说明：

- 一门课程可以分配给多个班级。
- 教师删除分配只影响该班级可见性，不应删除课程本体。

### 3.9 Resource 课程文件

字段建议：

- `id uuid pk`
- `course_id uuid fk courses.id`
- `uploaded_by uuid fk users.id`
- `type varchar`：`pdf | image | video | presentation | document | other`
- `name varchar`
- `mime_type varchar`
- `size_bytes bigint`
- `storage_provider varchar`：`s3 | oss | supabase | local`
- `storage_key text`
- `sha256 varchar null`
- `preview_status varchar`：`none | pending | ready | failed`
- `sort_order integer`
- `created_at timestamptz`
- `deleted_at timestamptz null`

说明：

- 数据库不存大文件，只存元数据和对象存储 key。
- 私有资源不暴露永久公开 URL；由服务端校验权限后返回短时签名 URL 或流式代理。

### 3.10 CourseScene 课程播放场景

字段建议：

- `id uuid pk`
- `course_id uuid fk courses.id`
- `resource_id uuid fk resources.id null`
- `type varchar`：`intro | concept | quiz | resource | experiment`
- `title varchar`
- `summary text`
- `content jsonb`
- `teacher_script jsonb`
- `sort_order integer`
- `created_at timestamptz`
- `updated_at timestamptz`

说明：

- 兼容现有 `CourseScene` TypeScript 类型。
- `content jsonb` 可保存测验选项、讲解段落、资源播放参数、实验步骤。

### 3.11 LearningProgress 学习进度

字段建议：

- `id uuid pk`
- `user_id uuid fk users.id`
- `course_id uuid fk courses.id`
- `class_id uuid fk classes.id null`
- `current_scene_id uuid null`
- `completed_scene_ids uuid[]` 或单独 `learning_progress_scenes`
- `quiz_answers jsonb`
- `progress_percent integer`
- `last_accessed_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`
- unique：`(user_id, course_id, class_id)`

说明：

- 学生同一门课在不同班级下学习时，可以保留不同进度。
- 游客公开课程进度可存在浏览器本地；登录后可合并到服务端。

## 4. 权限规则与权限矩阵

### 4.1 核心规则

- 游客：只能读取公开且已上架课程及公开资源预览。
- 学生：可以申请加入班级；批准后读取本班课程和班级专属资源；不能上传课程。
- 教师：可以创建自己学校内班级，审核自己管理班级的学生申请，创建和维护自己的课程，分配课程到自己管理的班级。
- 学校管理员：管理本学校用户、教师、学生、班级和学校课程。
- 公司管理员：跨学校管理账号、学校、班级、课程、资源、上下架与审计。

### 4.2 权限矩阵

| 操作 | 游客 | 学生 | 教师 | 学校管理员 | 公司管理员 |
| --- | --- | --- | --- | --- | --- |
| 浏览公开课程 | 允许 | 允许 | 允许 | 允许 | 允许 |
| 查看班级专属课程 | 禁止 | 已批准班级成员 | 管理该班级 | 本学校 | 全部 |
| 申请加入班级 | 禁止 | 允许 | 禁止 | 禁止 | 禁止 |
| 创建班级 | 禁止 | 禁止 | 本学校允许 | 本学校允许 | 全部 |
| 审核学生入班 | 禁止 | 禁止 | 管理该班级 | 本学校 | 全部 |
| 上传课程/课件 | 禁止 | 禁止 | 允许 | 允许 | 允许 |
| 分配课程到班级 | 禁止 | 禁止 | 自己管理班级 | 本学校 | 全部 |
| 删除课程 | 禁止 | 禁止 | 草稿/自有课程 | 本学校 | 全部 |
| 管理学校 | 禁止 | 禁止 | 禁止 | 本学校有限管理 | 全部 |
| 管理公司管理员 | 禁止 | 禁止 | 禁止 | 禁止 | 超级管理员 |

## 5. API 设计

建议使用 `/api/v1`，保留 `withApi` 包装器思路，但替换真实认证。

### 5.1 Auth

- `POST /api/v1/auth/login`：账号密码登录。
- `POST /api/v1/auth/logout`：清理服务端 session cookie。
- `GET /api/v1/auth/me`：返回当前用户、学校身份、全局权限。
- `POST /api/v1/auth/change-password`：修改密码。
- `POST /api/v1/admin/bootstrap`：仅首次初始化公司管理员，必须受部署密钥保护。

认证要求：

- 密码使用 Argon2id 或 bcrypt 哈希，不能明文或可逆加密。
- Session 使用 `HttpOnly`、`Secure`、`SameSite=Lax/Strict` cookie。
- 服务端从 session 查用户，不信任 `localStorage` 角色和 `x-user-role`。
- CSRF：同源 Route Handler 可使用 SameSite + CSRF token；如后续跨域，必须引入 CSRF 或 Bearer token 策略。

### 5.2 Schools

- `GET /api/v1/schools`
- `POST /api/v1/schools`
- `GET /api/v1/schools/:id`
- `PATCH /api/v1/schools/:id`
- `GET /api/v1/schools/:id/members`
- `POST /api/v1/schools/:id/members`
- `PATCH /api/v1/schools/:id/members/:membershipId`

### 5.3 Classes

- `GET /api/v1/classes`：按当前用户返回可管理/已加入班级。
- `POST /api/v1/classes`：教师或学校管理员创建班级。
- `GET /api/v1/classes/:id`
- `PATCH /api/v1/classes/:id`
- `POST /api/v1/classes/:id/rotate-code`：重置班级码。
- `POST /api/v1/classes/join-requests`：学生用 `class_code` 申请加入。
- `GET /api/v1/classes/:id/members`
- `PATCH /api/v1/classes/:id/members/:memberId`：批准、拒绝、移除。
- `POST /api/v1/classes/:id/teachers`：授权教师。
- `DELETE /api/v1/classes/:id/teachers/:teacherId`

### 5.4 Courses

- `GET /api/v1/courses`：公开课程、我的课程、本班课程按参数过滤。
- `POST /api/v1/courses`
- `GET /api/v1/courses/:id`
- `PATCH /api/v1/courses/:id`
- `DELETE /api/v1/courses/:id`
- `POST /api/v1/courses/:id/submit`
- `POST /api/v1/courses/:id/review`
- `POST /api/v1/courses/:id/classes`：分配给班级。
- `DELETE /api/v1/courses/:id/classes/:classId`
- `GET /api/v1/courses/:id/scenes`
- `PUT /api/v1/courses/:id/scenes`：保存课程播放结构。

### 5.5 Resources

- `POST /api/v1/resources/upload-url`：服务端生成短时上传 URL。
- `POST /api/v1/resources/complete`：前端直传完成后登记元数据。
- `GET /api/v1/resources/:id/download-url`：鉴权后返回短时下载 URL。
- `GET /api/v1/resources/:id/preview`：可选，服务端代理/转换后预览。
- `DELETE /api/v1/resources/:id`

### 5.6 Learning

- `GET /api/v1/learning/progress?courseId=&classId=`
- `PUT /api/v1/learning/progress`
- `POST /api/v1/learning/quiz-answer`

## 6. 文件存储方案

### 6.1 推荐方式

正式产品推荐：

- 课程文件使用对象存储：阿里云 OSS、S3 兼容服务或 Supabase Storage。
- 数据库只保存资源元数据和 `storage_key`。
- 上传采用服务端签名直传，避免大文件占满 Next 服务器带宽和磁盘。
- 下载/播放采用服务端鉴权后返回短时签名 URL，过期时间建议 5-15 分钟。

### 6.2 权限控制

资源访问流程：

1. 用户请求 `GET /api/v1/resources/:id/download-url`。
2. 服务端读取 `resources -> course -> visibility/course_classes/class_members/class_teachers`。
3. 服务端确认用户有权限。
4. 服务端返回短时签名 URL 或通过 Route Handler 流式代理。

禁止：

- 把私有课程资源放在永久公开路径。
- 前端自行拼对象存储 URL。
- 用 `localStorage.role` 判断是否允许下载。

### 6.3 教师修改/删除课程对已分配班级的影响

建议规则：

- 课程草稿修改：不影响学生，因为未发布。
- 已发布课程修改：生成新版本 `version + 1`，保留旧版本审计记录。
- 已分配班级默认看到最新已发布版本；如果学校需要稳定教学，可增加“锁定版本”字段。
- 删除课程：建议软删除 `archived/deleted_at`，已分配班级不可见，但学习进度和审计保留。
- 删除资源：软删除元数据，异步清理对象存储；已发布课程删除资源需生成新版本。

## 7. 迁移路线与验收标准

目标是复用 Phase 1/2 的页面和交互，不一次性重写平台。

### 阶段 0：冻结 Demo 边界

保留：

- 统一登录页 UI 和角色入口。
- 学生首页、加入班级页面、教师班级页、管理员概览页的交互结构。
- `CoursePlayer` 组件和 `CourseScene` 类型。
- IndexedDB 上传流程作为“本地导入/兼容读取”能力，暂不删除。

替换目标：

- `localStorage` session。
- `localStorage` 班级 store。
- IndexedDB 作为正式课程资源主存储。
- header 伪鉴权。

验收：

- 明确所有 Demo 文案和正式接口切换点。
- 页面仍可在 Demo 模式下运行。

### 阶段 1：数据库 schema 与迁移脚本

工作：

- 补齐 `users/schools/school_memberships/classes/class_teachers/class_members/courses/course_classes/resources/course_scenes/learning_progress` schema。
- 统一 role 枚举，移除 `user/student` 混用。
- 写数据库迁移和 seed：初始化公司管理员、默认学校、示例公开课程。

验收：

- 本地 PostgreSQL 或 Supabase 环境可执行迁移。
- 管理员账号可由安全初始化流程创建。

### 阶段 2：真实认证与服务端鉴权

工作：

- 新增 `login/logout/me`。
- 使用 HttpOnly cookie session。
- Route Handler 统一 `requireUser`、`requireCompanyAdmin`、`requireSchoolRole`、`requireClassTeacher`。
- 前端 `getSession` 改为从 `/auth/me` 加载，localStorage 仅可作为非敏感 UI cache。

验收：

- 修改浏览器 localStorage 不能提升权限。
- 未登录游客可浏览公开课程。
- 未授权用户无法访问班级专属资源接口。

### 阶段 3：班级 API 替换 localStorage

工作：

- `/class/join` 改调用 `POST /classes/join-requests`。
- `/teacher/classes` 改调用 `classes/members` API。
- `/teacher` 和 `/admin` 统计改从 API 获取。
- 保留页面布局和交互，不重写 UI。

验收：

- 两台电脑登录同一学生/教师账号可看到同步数据。
- 学生加入多个班级、教师管理多个班级正常。
- 申请重复、已加入、已拒绝状态由数据库唯一约束保证。

### 阶段 4：课程与资源 API 替换 IndexedDB

工作：

- 课程管理页改为服务端课程和资源 API。
- 文件上传改为签名直传对象存储。
- 资源列表从数据库读取。
- IndexedDB 中已有本地课程提供“导出/导入到服务器”迁移入口。

课程播放器适配：

- 保留 `CoursePlayer`。
- 新增服务端 `CourseLesson` 适配器：`GET /api/v1/courses/:id/player` 返回播放器需要的结构。
- 对 `ResourceScene`，服务端只返回资源 ID 和预览接口，不返回未鉴权永久 URL。

验收：

- 教师上传资源后，另一台电脑登录同一账号可查看。
- 班级学生只能打开本班课程资源。
- 公开课程游客可播放；班级专属课程游客不可播放。

### 阶段 5：管理员、学校与课程审核闭环

工作：

- 公司管理员管理学校、账号、班级、课程。
- 学校管理员管理本学校。
- 课程审核、上下架、分配班级、资源删除形成审计。

验收：

- 公司管理员可跨学校查看。
- 学校教师不能越权查看其他学校班级与资源。
- 课程从草稿到审核、上架、分配、下架路径完整。

### 阶段 6：学习进度和设备集成

工作：

- 学习进度写入 `learning_progress`。
- 课程场景可关联实验设备任务。
- Ubuntu 实验设备通过 FastAPI/ROS 提供控制能力，平台侧只保存设备授权、连接配置和实验记录。

验收：

- 学生跨设备恢复学习进度。
- Web 平台权限不等于 ROS 权限；设备控制必须经过服务端授权和本地设备服务校验。

## 8. 已有本地课程资源迁移

是否需要迁移：需要，但不能自动静默迁移。

原因：

- IndexedDB 数据只在教师当前浏览器内。
- 文件可能很大，自动上传会消耗网络和存储。
- 需要教师确认课程归属学校、可见范围和分配班级。

建议方案：

- 提供“导出本地课程包”功能：导出课程元数据 JSON 和资源文件。
- 提供“导入到服务器”功能：教师选择学校、课程可见性、目标班级后上传。
- 对无法预览的 PPT/Word，导入后进入服务端转换队列或继续标记为下载资源。

## 9. 风险与待确认事项

### 9.1 当前代码风险

- API 文档与实际代码不一致：文档已有 `/api/v1`，实际无 `src/app/api`。
- `authFetch` 与 `api client` 使用不同 localStorage key：`al_session` 与 `aerolark_session`。
- 课程页面同时存在 IndexedDB 本地课程和 `/api/courses` 远端课程假设，正式迁移要先统一数据源。
- 现有 Drizzle schema 不完整，且 `relations.ts` 漏掉课程关系。
- localStorage/header 信任模式必须在正式发布前移除。

### 9.2 产品待确认

- 学校管理员是否由公司管理员创建，还是支持学校自助注册。
- 学生加入班级被拒后，是否允许重新申请。
- 一个教师跨学校任教是否允许。
- 公开课程是否允许游客下载资源，还是仅允许在线播放。
- 已发布课程修改后，班级是否自动使用最新版，还是锁定分配时版本。
- PPT/Word 是否必须在线播放；如果必须，需要确认服务端转换方案。
- 真实设备控制是否需要校内局域网部署网关，还是公网可访问。

## 10. 结论

AI RoboEdu 当前已经有可复用的前端流程和播放器基础，但正式交付学校前，核心缺口是服务端可信身份、数据库同步、文件存储和权限控制。推荐不要推翻现有页面，而是以 Next.js Route Handlers + PostgreSQL + 对象存储逐步替换 Demo 数据层；FastAPI/ROS 保持为设备控制服务，通过平台授权接入。这样可以最快把 Phase 1/2 的交互转成正式产品能力，并降低一次性重写带来的回归风险。
