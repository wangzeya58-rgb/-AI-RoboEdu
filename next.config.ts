import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Full Node.js installation; dist/server.js runs the Next.js production server. */

  /* 开发域名白名单（仅 dev 环境生效） */
  allowedDevOrigins: ['*.dev.coze.site'],

  /* 当前资源主要为本地/静态资源，关闭 next/image 优化避免部署侧额外配置 */
  images: {
    unoptimized: true,
  },

  /* 静态站点需要的额外友好配置 */
  trailingSlash: false,

  // Preserve the request origin so auth redirects do not change host-only cookie scope.
  skipProxyUrlNormalize: true,

  /* 关闭 telemetry */
  productionBrowserSourceMaps: false,

  experimental: {
    proxyClientMaxBodySize: Number(process.env.COURSE_UPLOAD_MAX_BYTES ?? 52428800) + 65536,
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
  },
};

export default nextConfig;
