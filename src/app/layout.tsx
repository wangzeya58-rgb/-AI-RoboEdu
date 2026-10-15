import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '智能AI小车实训教育平台',
    template: '%s | 智能AI小车实训教育平台',
  },
  description:
    '智能AI小车实训教育平台是大疆工业深色科技风的智能机器人教育平台，提供课程、算法训练、模型库等模块。',
  keywords: [
    'AI小车',
    '实训教育',
    '智能教育',
    '课程管理',
    '算法训练',
    'AI模型',
  ],
  authors: [{ name: 'Edu Platform Team' }],
  generator: 'Edu Platform',
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {/*
         * 运行时配置：部署到阿里云后，编辑 /assets/runtime-config.js 即可修改后端地址，
         * 无需重新构建。
         */}
        <Script src="/assets/runtime-config.js" strategy="afterInteractive" />
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
