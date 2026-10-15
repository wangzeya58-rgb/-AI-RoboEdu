import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* 服务端部署模式：生成 .next/standalone，配合 dist/server.js / systemd 运行 */
  output: 'standalone',

  /* 开发域名白名单（仅 dev 环境生效） */
  allowedDevOrigins: ['*.dev.coze.site'],

  /* 当前资源主要为本地/静态资源，关闭 next/image 优化避免部署侧额外配置 */
  images: {
    unoptimized: true,
  },

  /* 静态站点需要的额外友好配置 */
  trailingSlash: false,

  /* 关闭 telemetry */
  productionBrowserSourceMaps: false,

  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
  },
};

export default nextConfig;
