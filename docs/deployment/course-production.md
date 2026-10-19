# AI RoboEdu 正式课程部署准备

## 架构和边界

本项目是 Next.js 16 Node.js 服务，不是静态站点。需要 PostgreSQL 16（Drizzle 正式迁移）、持久化附件目录和 HTTPS 反向代理。现有网站若仅支持上传 HTML，不能承载本系统；建议独立子域名，例如 `edu.example.com`，不要未经适配部署到子路径。

本轮复用 `course_materials`，没有新增 schema 或 migration。附件 `url` 列存储内部 `local:v1:UUID.extension` 标识，不是公开路径；物理文件在配置目录，数据库保存文件名、类型、大小、课程关联。文件读取、Range 视频请求、下载每次都使用正式 Cookie Session 和当前课程权限，禁止 Nginx alias 暴露附件目录。取消发布或移除成员后，新的读取、章节、进度和 AI 请求会被拒绝；已下载到用户电脑的副本无法收回。

管理员自建课程发布为公共课程，所有正式学生可学；教师课程只对已批准且获得该课分配的班级学生开放。草稿不可供学生读取。管理员编辑教师课程不会改变其创建者或自动公开。Demo 保持原浏览器 IndexedDB/localStorage，不与正式接口合并或自动迁移。

## 支持的附件

| 格式 | 网页能力 |
| --- | --- |
| PDF | 浏览器原生预览，不支持时下载 |
| PNG、JPG/JPEG、WebP | 图片预览和下载 |
| MP4、WebM | 浏览器支持相应音视频编码时播放，支持 Range；否则下载 |
| PPT、PPTX、DOC、DOCX | 下载，在 Office/兼容软件打开；不宣称网页解析 |

复用当前 Demo 的格式集合，不接受 HTML、SVG、脚本、任意 ZIP 或可执行文件。扩展名、MIME、文件头、单文件大小和管理权限均在服务端校验。Office 容器签名检查不等于病毒扫描或完整文档解析；公网开放前按学校要求配置反恶意软件/内容审查。默认上限 50 MiB，单进程同时读取最多两个上传请求，应用采用有界内存缓冲，建议至少 2 GiB 可用内存并在代理层设置限速/并发限制。提升文件上限时同步调整 Next.js 构建配置、代理和内存预算。

附件与章节独立；附件不会伪装成可完成章节，也不会自动提取正文给 AI。课程 AI 使用当前课程简介、真实章节正文和学生问题。本地规则 provider 明确标注非大模型；真实模型需要单独配置和验收。

## 配置

复制 `.env.production.example` 到服务器受保护的配置文件（例如 `/etc/ai-roboedu/production.env`），绝不可直接使用模板占位符。

- `DATABASE_URL`：正式独立数据库，用户名/密码特殊字符必须 URL 编码。远程数据库使用可信 TLS，切勿关闭证书验证来绕过错误。
- `AUTH_SESSION_SECRET`：独立随机值至少 32 字符，推荐 `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` 在服务器生成；不要粘贴到聊天或日志。
- `ENABLE_DEMO_AUTH=false`：正式验收必须关闭；服务器不使用 `NEXT_PUBLIC_ENABLE_DEMO_AUTH` 作为权限依据。关闭后旧 Demo Cookie 也无效。开发环境可显式 `true`，正式登录失败不会自动切 Demo。
- `APP_ORIGIN=https://edu.example.com`：准确公网 origin，不带结尾斜线/路径，代理保留 Host、X-Forwarded-Host、X-Forwarded-Proto。
- `COURSE_FILE_STORAGE_DIR=/var/lib/ai-roboedu/course-files`：绝对路径，源码目录之外；Linux 目录归运行用户所有且 0700，文件 0600。开发不配置则使用用户目录下 `.local/share/ai-roboedu/course-files`。Windows 开发可设 `D:/AI-RoboEdu-data/course-files`，不能在项目内。
- `COURSE_UPLOAD_MAX_BYTES=52428800`：构建和运行使用同值；反代为 51m（包含表单开销）。修改上限需要重建 Next.js。
- `NODE_ENV=production`、`BIND_HOST=127.0.0.1`、`PORT=5000`。Node 和数据库端口不对公网开放。Docker 部署时 Node 可监听容器内部 `0.0.0.0`，宿主映射仍限定代理访问；附件目录必须挂载独立持久卷。
- `AI_CLASSROOM_PROVIDER=local` 可离线运行，但不是真实 LLM。真实使用时配置 `openai-compatible`、`AI_CLASSROOM_BASE_URL`、`AI_CLASSROOM_MODEL`、`AI_CLASSROOM_API_KEY`，密钥仅服务端持有。学生内容会发送供应商，先确认学校隐私政策。

Next.js 会加载项目 `.env.production.local`，但命令行 Drizzle/tsx 使用 dotenv，必须显式指定 `DOTENV_CONFIG_PATH` 或通过受信进程管理器注入相同环境。不要把开发 `.env.local` 复制到服务器，且避免它覆盖正式配置。运行目录不要残留旧开发环境文件。

## 安装、迁移、启动（人工确认目标后执行）

以下是部署操作说明，本轮未操作任何生产服务器。

1. 确认域名、网站现有路由及代理归属，备份旧服务和配置；创建非 root 运行用户。使用 Node.js 22 LTS、pnpm 9（与锁文件一致），在全新发布目录安装，不在正在运行的目录直接覆盖构建。
2. `pnpm install --frozen-lockfile`。本项目使用完整 Node 安装和 `dist/server.js`，不混用 `.next/standalone/server.js`。保留 `public`、`.next`、`dist`、`drizzle`、`scripts`、锁文件和依赖；构建需要 devDependencies。
3. 配置环境并创建外部持久目录，核对磁盘容量/权限。既有数据库先备份，人工检查 `drizzle` journal 与数据库 `drizzle.__drizzle_migrations` 是否一致，不重写已执行迁移。
4. Linux/Bash：`DOTENV_CONFIG_PATH=/etc/ai-roboedu/production.env pnpm run db:migrate`。只运行正式迁移；禁止 push/reset/drop/truncate。生产目标和备份恢复能力不明确时停止。
5. 首次管理员初始化使用既有 `db:seed-admin`：在受保护的临时 `.env.bootstrap` 中配置相同数据库及 `BOOTSTRAP_ADMIN_USERNAME`、`BOOTSTRAP_ADMIN_PASSWORD`、`BOOTSTRAP_ADMIN_NAME`，执行 `DOTENV_CONFIG_PATH=.env.bootstrap pnpm run db:seed-admin`。密码至少 16 字符、大小写和数字，拒绝默认弱密码和占位符；已有管理员时拒绝重复初始化。初始化后移除临时引导凭据；不提供默认正式账号。教师/学生正式账号须由现有受控账号运维流程提供，本轮不扩展用户管理。
6. 构建时注入同一上传上限等环境，执行 `pnpm run validate`、`pnpm run build`。可用 `node --env-file=/etc/ai-roboedu/production.env ./node_modules/tsx/dist/cli.mjs scripts/check-course-deployment.ts` 执行部署预检（DB 只读、创建后删除一个独立存储探针，不改业务数据）。占位符/HTTP/Demo 启用/不可写目录会失败。
7. 人工检查 `deploy/systemd/edu-platform.service` 的路径、用户名、pnpm 绝对路径、EnvironmentFile，再安装。服务使用 `pnpm start`，启动脚本现在明确进入 production 并绑定 `BIND_HOST`；或 `node --env-file=/etc/ai-roboedu/production.env dist/server.js`。Windows 本地生产验证可使用此 node 命令，避免依赖 Bash。
8. 配置有效 TLS 后审核并合并 `deploy/nginx/edu-platform.conf`，`nginx -t` 后人工 reload。不要同时安装两个 upstream 重名的模板。旧 `deploy.sh` 的远程 rsync --delete 和 `server-init.sh` 的盲目系统初始化均已停用，避免删除密钥/持久数据或改动现有网站的防火墙、目录权限；不要执行历史一键部署方式。`simple.conf` 只适合本地或已有可信 HTTPS 终止层，不适合公网 HTTP 登录。`APP_ORIGIN=https://实际域名 bash deploy/scripts/check.sh` 可只读检查登录页面和未认证 API，但不能代替数据库/存储预检。
9. 正式 HTTPS 域名下独立浏览器验收登录、教师入班审核、上传、草稿隔离、发布、下载、学习进度、AI 和退出。生产 Cookie 为 Secure，直接从局域网 HTTP 地址访问生产模式不受支持。

Linux 手工启动/停止使用审核后的 `systemctl start/stop edu-platform`。代码更新只替换发布目录/符号链接，不动数据库、附件卷、外部配置。先做兼容性审查和备份，再增量迁移、切换版本、重启和冒烟；回滚代码不等于回滚数据库，不自动执行逆向破坏性迁移。

## 数据和文件备份恢复

数据库与附件必须成对备份。数据库独立备份不含文件字节；Git 也不是 IndexedDB 或文件卷备份。现有开发数据已在本地备份目录保留；本轮不会自动迁移或公开它们。

备份窗口暂停应用写入（维护模式或停服务），记录发布版本、迁移 journal、附件目录清单及哈希；使用 `pg_dump --format=custom --file=<受保护的备份路径>/database.dump`（连接信息从受限 PGPASSFILE/PGSERVICEFILE 注入，不写入命令历史），以及 `tar -C /var/lib/ai-roboedu -cpf <备份路径>/course-files.tar course-files`。确认退出状态和 SHA-256，备份目标须在应用源码/运行卷之外，权限 0700/0600、加密、异机副本、明确保留周期。完成再恢复服务写入。

恢复先在**新的隔离数据库**和**新的存储目录**演练：`pg_restore --no-owner --no-acl --dbname=<新库名> <备份路径>/database.dump`（不加 --clean），解包到隔离目录，恢复归属/权限，将隔离应用配置指向同一备份对。核对数据库材料记录和文件大小/哈希、迁移历史、授权下载及进度，再安排人工切换。不向现有业务库覆盖恢复，不通过删除原数据“修复”。

上传使用临时文件、fsync、同目录原子发布和数据库事务，插入失败会回收本次文件；磁盘满/网络失败不会显示成功。进程在文件发布和数据库提交间崩溃仍可能留下不可访问孤立文件；附件/课程删除后的物理清理失败会记录运维告警。定期只读比对元数据与文件清单，确认备份和维护窗口后才人工处置，不自动清理未知旧文件。丢失文件时返回明确 404，不假装附件仍可读。单机磁盘方案暂不支持多实例各自保存文件；横向扩容须共享可靠卷或后续对象存储适配。

## Demo 导入正式系统方案（本轮不自动执行）

1. 在原浏览器/origin 导出完整课程、assets/assetBlobs 和原始附件字节，保存课程/课件 ID、关联、文件名、大小、SHA-256 和导出时间；先核对备份可读。不要清理 Firefox IndexedDB，也不要依赖 Git 携带浏览器数据。
2. 导入前预览每个 Demo 课程和附件，人工选择一个**正式**创建者；无法确认的保持待确认，不猜测。管理员课程默认草稿、明确选择后才公开；教师课程默认草稿，人工映射到其有权管理的正式班级，不直接复制 Demo 班级/成员/ID 为正式外键。
3. 正式 API 创建新课程/章节并逐个上传附件；原 Demo ID 只写受保护的外部导入清单，不覆盖正式 UUID、不修改原本地数据。记录 `原origin+courseId+导出内容摘要 -> 正式courseId` 和附件哈希/目标ID，作为重试去重凭据；重复导入先展示已映射项，内容变更须人工选择更新还是新建，不仅按文件名猜测重复。
4. 附件失败时保留草稿并列出失败项，发布前核对附件/章节完整性、归属和目标范围；经管理员确认后调用已有发布接口。取消操作不删除源数据；回滚只针对本次专用新记录且再次确认。

此为明确的受控迁移方案，尚未实现一键导入器；当前可按清单人工使用正式表单/API 导入，不能宣称现有本地课件已自动上云。

## 上线前仍需提供的信息

- 现有网站域名、希望使用主域/子域、当前是宝塔/Nginx/Apache/Docker/静态托管，以及能否增加 Node.js 常驻进程。
- 服务器 OS、CPU/内存/磁盘、Node/pnpm 版本、运行用户及应用目录；已有容器、代理和端口规划（勿发送密码）。
- 正式 PostgreSQL 的位置、版本、网络/TLS、独立数据库和备份方案；不要将本地开发库误认为生产库。
- HTTPS 证书和反向代理管理方式、上传大小、磁盘配额、持久卷、备份目标与保留期。
- 正式管理员/教师/学生账号提供方式；模型供应商/模型/学校数据政策，密钥在服务器安全配置，不通过聊天传递。

尚未验证真实生产域名/TLS、真实 LLM、Office 客户端兼容、病毒扫描和恢复演练；这些是上线验收项，不由本地构建成功替代。
