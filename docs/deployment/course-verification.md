# 正式课程部署准备：本地验证记录

验证日期：2026-10-19。仅本地开发环境，未提交、推送或连接生产服务器。

## 环境与数据保护

- PostgreSQL 16.15，现有 Docker 容器 `ai-roboedu-postgres-dev`，端口仅 `127.0.0.1:5432`，数据库已核实为 `ai_roboedu_dev`。
- 既有迁移记录 6 条；本轮复用 `course_materials`，没有新增、修改或执行 migration，没有 push/reset/drop/truncate。
- 数据库联调前备份：`/home/zyw/roboedu-backups/pre-attachments-20261019.dump`，权限 0600；原 Demo 备份 `/home/zyw/roboedu-backups/demo-courses-qPWBHj` 保留。未操作原 Firefox IndexedDB 或其课件文件。
- 正式附件全流程测试使用专用临时目录、独立 5098 服务、2 个临时教师、2 个临时学生和1个临时管理员；测试结束只清理本次记录/文件，校验原课程 ID 列表未变。
- 原开发库没有正式用户/班级/课程/附件；测试后恢复到该状态。随后管理员初始化测试也只创建并清理专用临时管理员。默认三个 Demo 账号仍不是正式账号。

## 已执行结果

| 检查 | 结果与边界 |
| --- | --- |
| `pnpm run validate` | 通过：TypeScript + 全项目 ESLint |
| `pnpm run build` | 通过：Next.js production + dist/server.js；有既存 middleware 命名弃用和 Babel/SWC 提示，不影响本轮构建 |
| `pnpm run courses:test-materials` | 3 项单元测试通过：全部支持格式的文件头/MIME/名称/大小校验；不覆盖、目录边界、拒绝符号链接；跨站及异常表单/伪造身份字段拒绝 |
| `DOTENV_CONFIG_PATH=.env.local COURSE_TEST_BROWSER=true pnpm run courses:test-materials-db` | 真实 PostgreSQL、真实 API、独立 Chrome 会话均通过，详见下方 |
| `courses:test-db`（显式指向本地5000） | 既有真实课程 API、章节编辑、AI 上下文、跨教师隔离、进度并发/恢复/班级报告全部通过 |
| `courses:test-publication-db`（显式指向本地5000） | 真实公共课/班级课、不可变创建者、旧归属确认、取消发布及成员撤销通过 |
| `classes:test-auth` | 本地服务启动后通过：未认证401、Demo正式写入403。首次在服务未启动时连接拒绝，启动后已重跑通过 |
| `courses:test-demo-access` | Mock IndexedDB 存取隔离测试通过；不冒充真实 PostgreSQL 测试 |
| `courses:test-demo-browser` | 独立 Chrome 测试 profile 中通过：旧归属、原始附件保留、发布/审批、列表刷新、取消权限和 IndexedDB 错误重试；无正式业务 API 读写、无运行/hydration错误 |
| `deploy:check` | 本地数据库 + 源码外真实可写目录通过；HTTPS origin 仅检查配置格式，没有验证生产域名证书/网络 |
| `deploy/scripts/check.sh`、Bash语法、`git diff --check` | 通过；HTTP检查为登录页200、未认证课程API401，不将其当DB健康检查 |
| 管理员初始化 | 默认/占位弱密码被拒绝；随机强密码创建正式管理员并成功登录；重复初始化拒绝；只清理本次临时管理员 |

tsx 在受限沙箱初次执行时遇到本地 IPC 的 EPERM，取得授权后重跑并完成；不是业务接口失败。

## 真实完整流程覆盖

1. 独立 Chrome BrowserContext 分别登录正式管理员、教师、学生、同一学生的第二会话和游客；不复用 Cookie/localStorage。实际操作现有表单创建课程、添加章节、上传生成的真实 PNG 课件、公共发布/发布到自己的班级。
2. 已批准学生从课程中心看到公共课与班级课，播放器中图片实际加载（校验 naturalWidth），下载接口响应和字节有效；标记完成、刷新页面和第二个独立会话均恢复数据库进度。本地 AI 答疑展示真实接口响应，并标明非大模型。
3. 桌面1440×1100、移动390×844截图检查；移动无横向溢出。截图：`/tmp/roboedu-deployment-desktop.png`、`/tmp/roboedu-deployment-mobile.png`。
4. 服务端验证：学生/其他教师不能上传；草稿、其他班级成员、未登录均拒绝；Demo教师不能写正式表；文件内容、扩展名、MIME错误没有新增关联。下载 SHA-256 与上传源一致，中文文件名使用合法响应 Header，Range返回206、非法Range返回416。
5. 停掉并重新创建独立 production Node进程/数据库连接池，附件字节、权限和进度保留。关闭Demo后既有Demo签名Cookie返回401、Demo登录返回403。
6. 取消公共发布/移除班级成员后，课程详情、章节、附件列表、附件读取、进度和AI均返回403；删除附件后404，删除本次课程后专用物理文件被清理。
7. 将测试服务存储位置指向本次创建的不可作为目录的专用文件，上传返回500且元数据数量不增加；切回原测试目录后附件仍可读。将**测试进程**数据库地址指向本机不可连接端口，正式登录返回503；浏览器显示错误且没有自动Demo登录。没有停止或改动实际 PostgreSQL 容器。
8. 退出后正式附件API返回401；浏览器没有未捕获运行错误、中文Header异常或hydration异常。

## 本轮文件范围

以下是本轮涉及文件；工作区原本已有其他阶段修改，本轮没有重写它们，也未改用户原有 README 内容。

附件后端和API：
```text
src/lib/courses/material-types.ts
src/lib/courses/course-file-storage.ts
src/lib/courses/material-http.ts
src/lib/courses/server-material-service.ts
src/lib/courses/server-course-service.ts
src/lib/courses/formal-course-api.ts
src/lib/api/handler.ts
src/app/api/v1/courses/[id]/materials/route.ts
src/app/api/v1/courses/[id]/materials/[materialId]/route.ts
src/app/api/v1/courses/[id]/materials/[materialId]/content/route.ts
```

复用课程页面/组件和认证：
```text
src/components/course/FormalCourseMaterials.tsx
src/components/course/FormalCourseManager.tsx
src/components/course/FormalCourseReader.tsx
src/components/course/CourseStage.tsx
src/components/course/CoursePlayer.tsx
src/app/course/page.tsx
src/app/login/page.tsx
src/components/auth/LoginForm.tsx
src/lib/auth/client.ts
src/lib/auth/demo-users.ts
src/lib/auth/server-session.ts
src/middleware.ts
```

配置、部署、验证：
```text
.env.example
.env.production.example
.gitignore
next.config.ts
package.json
src/server.ts
src/storage/database/db.ts
scripts/start.sh
scripts/seed-admin.ts
scripts/check-course-deployment.ts
scripts/test-course-material-validation.ts
scripts/test-course-materials-db.ts
scripts/test-course-materials-browser.mjs
deploy/nginx/edu-platform.conf
deploy/nginx/edu-platform.simple.conf
deploy/systemd/edu-platform.service
deploy/scripts/deploy.sh
deploy/scripts/server-init.sh
deploy/scripts/check.sh
docs/deployment/course-production.md
docs/deployment/course-verification.md
```

没有新增依赖。未修改课程数据库结构、既有migration、机器人控制、FastAPI/ROS或OpenMAIC。

## 待验收与限制

- 真实LLM未配置，未调用付费模型；本轮验证的是本地规则provider，附件正文未提取。
- Chrome独立会话不是所有浏览器内核的兼容验收；Windows/Firefox实机、PDF原生查看器、Office客户端及具体视频编码仍需部署目标环境检查。
- 单元测试验证Office容器文件头，不代表完整Office文件解析或病毒扫描。默认50MiB上限做了校验逻辑测试，不代表大并发压测。
- 未安装/执行Nginx或systemd、未连接正式域名、未操作生产服务器；生产TLS、备份异机副本与完整恢复演练仍待现场确认。
- Demo到正式的导入方案在部署文档中，包含归属/范围预览和哈希去重清单；未开发一键导入器、未自动导入/公开任何本地课件。
- 正式账号初始化后仍需受控提供教师/学生账号；没有新增完整账号运营页面。
