# 迭代扩展使用规则

> 本文件说明如何在现有 API 体系下**安全、可控地**新增或调整接口。

## 正式学习进度与教师学习情况

- 新增 `course_learning_progress`（账号/课程、最近章节、最近学习时间）和 `lesson_completions`（账号/章节、明确完成时间），复用现有用户、课程、章节、班级关系。迁移：`0003_pretty_stone_men.sql`，已在本地 `ai_roboedu_dev` 执行；其他环境部署前运行 `DOTENV_CONFIG_PATH=.env.local pnpm run db:migrate`，勿以 db:push 代替正式迁移。
- 正式学生只能查询/保存本人有权限的课程。课程权限每次由服务端检查，客户端不能指定记录所属账号；Demo 不读写这两张表。教师只能查看自己管理的班级、自己发布到该班级的课程及已加入学生。
- 浏览、切章和答题不再自动算完成。点击“标记本章完成”才写入完成记录，重复点击幂等；完成后再次访问不会清除完成状态。总章节数和百分比按当前课程重新计算，空课程不算完成。
- 课程列表显示未开始/学习中/已完成、完成数、百分比和开始/继续入口；播放器从服务端恢复最近章节，刷新及退出重登后保留。Demo 仍仅在本页演示。失败保留待保存操作并提供重试，切换课程会取消旧请求。
- 教师班级详情复用现有页面，增加课程选择和学习情况表，展示学生完成章节、百分比及最近学习时间（进入、切章或完成时更新）。同一正式账号对同一课程的进度跨班级共享，教师只看到本班获准成员，不是新的评分或统计系统。
- 验证：真实数据库/API 的幂等完成、恢复、权限和账号隔离通过；真实浏览器的离线保存重试、刷新和退出重登恢复、100% 完成及教师学习情况通过，运行时异常 0。14 项学习进度/AI 单元与 mock 测试通过；测试账号、课程、班级及进度仅按本次数据清理。
- AI 验收：当前实际配置仍为 `local`，没有真实 Key、模型和服务地址；未发起真实模型请求。真实模型需设置服务端 `AI_CLASSROOM_PROVIDER=openai-compatible`、`AI_CLASSROOM_API_KEY`、`AI_CLASSROOM_MODEL`，必要时设置 `AI_CLASSROOM_BASE_URL`；配置后再用少量请求验收讲解、追问和切章隔离，不将 local 回答算作真实模型验收。
- 回归：`pnpm exec tsx --test scripts/test-learning-progress.ts scripts/test-ai-classroom.ts scripts/test-ai-classroom-access.ts`；原有 `courses:test-db` 和 `scripts/test-course-browser.mjs` 已补充学习进度验证。未修改控制页面、Robot Tool Layer、FastAPI、ROS；未自动提交。

## Phase 5-4：真实教学流程验收与修复

- 已使用本地 `ai_roboedu_dev`、随机测试账号、真实登录 cookie 和真实页面/API，验收教师建课 → 添加两个教学章节 → 修改保存 → 刷新 → 发布自己的班级 → 学生授权学习 → 本地 AI 连续问答。两章分别为“雷达测距实验”和“平均值实验”，使用实际教学正文而不是占位文本。
- 修复教师端缺少已保存章节编辑的问题：复用原章节表单，增加所属教师才能调用的章节 PATCH；同时匹配课程和章节 ID，保留章节顺序，空正文拒绝保存，学生和其他教师不可写入。
- 修复课程选择引发反复加载、切换课程可能回填旧章节/表单的问题；保存期间锁定编辑相关操作，用当前课程身份校验异步返回。
- 修复 `/course`、`/course/manage`、`/teacher/courses` 直接在首屏读取 localStorage 引发的服务端/客户端 hydration 不一致；现在先显示稳定的登录状态读取界面，再进入正式或 Demo 数据链路。真实浏览器重跑未出现运行时异常。
- 修复长课程名在课堂目录中溢出的问题，仅增加换行样式。
- 真实验证：教师保存后重新读取与刷新持久化、两个教师入口、班级分配、学生学习及刷新、多轮本地答疑、章节切换不串答、非成员不可见课程；API 验证未登录 401、越权 403、跨课程编辑 404、重复发布 409、空内容和伪造 system 历史 400、Demo 无权读取正式课程。所有测试记录只按本次账号/随机前缀清理，未覆盖已有课程。
- 模拟验证：沿用 11 项 AI 测试，覆盖模型超时、网络失败、取消/迟到响应、失败重试、缺 Key、空内容/附件限制和权限读取隔离。
- 真实 LLM **未验收**：本机实际运行 `AI_CLASSROOM_PROVIDER=local`，未配置真实 API Key、模型名和服务地址。当前通过的是本地规则答疑与 mock，不代表大模型回答质量通过；配置真实 provider 后仍需少量人工复核章节讲解、追问和实验提示。
- 回归命令：`DOTENV_CONFIG_PATH=.env.local COURSE_API_TEST_BASE_URL=http://127.0.0.1:5000 pnpm run courses:test-db`；`pnpm exec tsx --test scripts/test-ai-classroom.ts scripts/test-ai-classroom-access.ts`；`pnpm run ts-check`；`pnpm run lint:build`；`pnpm run build`。
- 真实页面回归：先启动平台，再用独立 profile 启动 Chrome 的 `--remote-debugging-port=9223`，运行 `pnpm exec tsx --tsconfig tsconfig.json scripts/test-course-browser.mjs`。脚本仅允许本地开发库和 local provider，创建/清理本次测试数据，并关闭该隔离浏览器；不要复用日常浏览器 profile。
- 最短人工验收：正式教师进入课程管理，新建课程并添加两章 → 点击章节“编辑”保存后刷新 → 发布给自己的班级 → 已批准的学生登录 `/course`，依次学习两章并向小老师追问 → 未加入班级的学生确认无课程 → 使用现有账号做验收；自动测试账号运行后已清理。
- 未修改控制页面、Robot Tool Layer、FastAPI、ROS、附件解析或数据库结构；未自动提交或推进下一阶段。

## Phase 5-3：课程 AI 小老师答疑接入

- 复用 Phase 5-2 的 CoursePlayer、AI 小老师、多轮历史和权限校验，不新增聊天窗口或聊天数据库。
- 正式课程只从服务端授权查询获得课程名称、简介、章节标题与正文。当前正式章节没有独立的学习目标/实验步骤字段；正文中已有的目标和步骤一并提供，不虚构字段。Demo 使用现有场景正文、步骤、学习目标与老师提示。
- 模型仅接收一条服务端教学系统规则；课程参考资料使用普通消息中的 JSON，序列化后最多 16000 字符，优先保留当前章节。历史最多 12 条，每条最多 4000 字符。
- 空正文、只有附件/外部链接时明确限制；不提取视频/PDF，不进行 OCR、向量检索或自动访问链接。无实验说明时不编造实验步骤；通用知识需标为“通用补充”。
- 增加“解释本节重点 / 这个实验怎么做 / 给我一点提示”，统一走原聊天提交路径。发送中禁用重复提交；失败保留问题，提供显式重试；成功后一次性记录问答，重试不重复插入学生消息。
- 切换章节取消请求、清空该窗口历史，并检查请求身份以忽略迟到响应；客户端最多等待 40 秒。权限错误不回退到 Demo。
- 配置仍使用 `.env.local` 的 `AI_CLASSROOM_PROVIDER`、`AI_CLASSROOM_BASE_URL`、`AI_CLASSROOM_MODEL`、`AI_CLASSROOM_API_KEY`、`AI_CLASSROOM_TIMEOUT_MS`（默认 30000）。`local` 为规则答疑；`openai-compatible` 为真实模型，缺少 Key 时明确报错。Key 仅放服务端，不使用 `NEXT_PUBLIC_`。
- 验证：11 项课程 AI/权限 mock 测试、`pnpm run ts-check`、`pnpm run lint:build`、`pnpm run build` 通过。浏览器模拟验收覆盖快捷提问、多轮追问、失败重试不重复、发送中保护、切换章节后的迟到响应、空内容/附件及模型未配置提示。权限测试 mock 数据读取，模型测试 mock fetch，不连接真实模型或写入数据库；真实模型的回答质量仍需配置后人工验收。
- 课程页面在窄屏隐藏平台大侧栏、保留课堂目录和小老师，避免答疑窗口被挤窄；布局选项只用于课程页面，控制页面不变。
- 最短验收：正式学生登录 → 进入已授权课程 → 点击三个快捷问题 → 连续追问 → 断网发送并重试 → 切换章节检查历史隔离。Demo 从内置课程进入小老师，不访问正式课程数据。空内容/附件章节应提示未读取正文。
- 本阶段不修改控制页面、Robot Tool Layer、FastAPI、ROS 或课程数据库结构，不自动推进下一阶段。

## 一、何时新增接口

| 场景 | 处理方式 |
| ---- | ---- |
| 新增独立功能模块 | 在 `/api/v1/<新模块>/route.ts` 新建 |
| 现有模块加新动作 | 在 `/api/v1/<模块>/[id]/<动作>/route.ts` 新建 |
| 业务侧需要占位 | 在 `/api/v1/_extensions/<name>/route.ts` 新建（待业务落地后再迁移到正式目录） |
| 不兼容升级 | 在 `/api/v2/<模块>/...` 新建，旧版同时保留 |

## 二、新增接口标准流程

### Step 1. 确定路径
- 命名小写 + 中划线，复数优先：`/courses`、`/teaching-resources`
- 动态资源用 `[id]`：`/courses/[id]`
- 子动作也走文件夹：`/courses/[id]/review`

### Step 2. 选择包装器

```ts
import { withApi } from '@/lib/api/handler';
import { requireSession, requireRole } from '@/lib/api/auth';
import { parseJson, string, optional, number, boolean as booleanV } from '@/lib/api/validation';
import { ApiError } from '@/lib/api/errors';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';

export const GET = withApi(async (req) => {
  const user = requireSession(req);            // 1. 鉴权
  requireRole(user, ['admin', 'teacher']);     // 2. 角色
  const body = await parseJson(req, {          // 3. 入参校验
    name: string,
    age: optional(number),
    is_vip: optional(booleanV as never),
  } as never);

  // 4. 业务
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('xxx').select('*').eq('owner_id', user.id);
  if (error) throw ApiError.internal('查询失败', 14001, error);

  return data;                                  // 5. 业务数据
}, { methods: ['GET'] });                       // 6. 显式声明方法（用于预检与文档）
```

### Step 3. 错误码登记

打开 `src/lib/api/errors.ts`，在对应模块下追加：
```ts
// 14xxx 资源模块
NOT_FOUND:      { code: 14004, message: '资源不存在' },
PERMISSION_DENIED: { code: 14003, message: '无权访问该资源' },
```
或直接抛现有错误：
```ts
throw ApiError.notFound('资源不存在');
throw ApiError.forbidden('无权访问该资源');
```

### Step 4. 更新文档

打开 `docs/API.md`，在对应模块表格追加一行（HTTP 方法 / 路径 / 鉴权 / 说明）。

### Step 5. 写冒烟用例

在 `test_run` 工具中执行：
```bash
curl -X POST http://localhost:5000/api/v1/<path> \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <uuid>' \
  -d '{...}'
```

---

## 三、版本管理规则

### 不破坏 v1 的变更
- 新增字段
- 新增可选参数
- 新增端点
- 文档/错误消息调整
> 直接在 v1 内迭代，不新建版本

### 破坏 v1 的变更（必须升级 v2）
- 删除/重命名字段
- 字段类型变更
- 端点重命名
- 鉴权方式变更

升级步骤：
1. 复制 `src/app/api/v1/<模块>/` → `src/app/api/v2/<模块>/`
2. 修改 v2 内部实现
3. 在 v1 路由顶部加 `@deprecated` 注释，输出 `X-API-Deprecated: true` 响应头
4. 在 `docs/API.md` 中标注 v1 弃用计划（保留期 6 个月）
5. 前端分阶段切换（先灰度，再全量）

---

## 四、扩展占位区使用

`_extensions/empty/route.ts` 是一个**完整可运行**的占位接口，包含：
- `withApi` 包装
- `ApiError.notImplemented` 调用
- ping/pong 示例

**复制到正式模块：**
```bash
cp -r src/app/api/v1/_extensions/empty src/app/api/v1/<新模块名>
# 编辑 _extensions/empty/route.ts，改写业务逻辑
# 目录改名（可选）
mv src/app/api/v1/<新模块名>/empty/route.ts src/app/api/v1/<新模块名>/route.ts
rmdir src/app/api/v1/<新模块名>/empty
```

**复制为子动作：**
```bash
mkdir -p src/app/api/v1/<模块>/[id]/<动作>
cp src/app/api/v1/_extensions/empty/route.ts src/app/api/v1/<模块>/[id]/<动作>/route.ts
```

---

## 五、客户端拦截器

如需全局 token 注入、错误统一提示等：

```ts
// src/lib/api/client-setup.ts（在你需要的页面入口处 import）
import { addRequestInterceptor, addResponseInterceptor, ApiClientError } from '@/lib/api/client';
import { toast } from 'sonner';

addRequestInterceptor(({ url, init }) => {
  // 注入 token（如果将来切到 token 鉴权）
  // const token = localStorage.getItem('token');
  // init.headers = { ...init.headers, Authorization: `Bearer ${token}` };
  return { url, init };
});

addResponseInterceptor(({ response, body }) => {
  if (!body?.success && body?.code !== 0) {
    // 全局 toast
    // toast.error(body?.message);
  }
  return { response, body };
});
```

---

## 六、常见问题

**Q: 如何处理文件上传？**
A: 当前 `_extensions/empty` 是空模板，建议：
- 小文件：转 base64 走 JSON Body
- 大文件：单独建 `_internal/upload/sign` 拿到签名 URL 后 PUT 对象存储

**Q: 如何处理流式响应（SSE）？**
A: 用 `ReadableStream` + `text/event-stream` 响应头，业务模块不暴露：
```ts
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

**Q: 跨工作区如何切换后端？**
A: 通过环境变量 `COZE_SUPABASE_URL` / `COZE_SUPABASE_ANON_KEY` 即可，无需改代码。

**Q: 旧路径 `/api/xxx` 还能用吗？**
A: 是的，`next.config.ts` 中有重写：
```ts
{ source: '/api/:path*', destination: '/api/v1/:path*' }
```
建议新代码统一使用 `/api/v1/...`。
