/**
 * 运行时配置脚本
 * ----------------------------------------------------------------
 * 部署到阿里云 OSS / CDN / 静态服务器后，编辑本文件即可切换后端地址。
 * 不需要重新构建。
 *
 * 配置项：
 *   API_BASE  - 后端 API 基础地址
 *               - 留空 ''  → 使用同源 /api/v1（需要后端与前端同源部署）
 *               - 完整 URL → 例如 'https://api.your-domain.com/api/v1'
 *               - 相对路径 → 例如 '/api/v1'
 */
(function () {
  window.__APP_CONFIG__ = Object.assign(window.__APP_CONFIG__ || {}, {
    // ====== 必填：后端 API 基础地址 ======
    API_BASE: '', // 默认同源，留空；部署到独立后端时改为 https://api.xxx.com/api/v1
    CAR_API_BASE: 'http://127.0.0.1:8000',

    // ====== 可选：应用元信息 ======
    APP_NAME: '智能AI小车实训教育平台',
    APP_VERSION: '1.0.0',
    BUILD_TIME: '__BUILD_TIME__',
  });
})();
