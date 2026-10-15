/**
 * 运行时配置脚本（示例 / 模板）
 * ----------------------------------------------------------------
 * 把 public/assets/runtime-config.js 复制到部署的 out/assets/ 目录后，
 * 找到 `API_BASE` 字段，按实际情况填好后端 API 地址。
 *
 * 常见场景：
 *   1. 前后端同源（同一域名）：
 *        API_BASE: ''                       // 前端直接请求 /api/v1/xxx
 *        或者 API_BASE: 'https://your-domain.com/api/v1'
 *
 *   2. 前后端分离（前端 OSS 静态托管，后端独立 ECS）：
 *        API_BASE: 'https://api.your-domain.com/api/v1'
 *
 *   3. 本地测试：
 *        API_BASE: 'http://localhost:5000/api/v1'
 *
 * 改完保存即可，无需重新构建。
 */
(function () {
  window.__APP_CONFIG__ = Object.assign(window.__APP_CONFIG__ || {}, {
    // ============================================
    // 必填项 ↓
    // ============================================
    API_BASE: 'https://api.your-domain.com/api/v1',
    CAR_API_BASE: 'http://127.0.0.1:8000',

    // ============================================
    // 可选项 ↓
    // ============================================
    APP_NAME: '智能AI小车实训教育平台',
    APP_VERSION: '1.0.0',
  });
})();
