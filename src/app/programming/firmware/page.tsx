'use client';

import Layout from '@/components/Layout';
import Header from '@/components/programming/Header';
import Tabs from '@/components/programming/Tabs';
import FileList from '@/components/programming/FileList';

export default function FirmwarePage() {
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <Layout activeMenu="/programming/firmware">
      <Header />
      
      {/* 程序文件区 */}
      <section className="px-12 py-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold mb-3" style={{ color: '#151E2B' }}>
            程序文件管理
          </h3>
          <Tabs />
        </div>
        <FileList category="firmware" />
      </section>

      {/* 底部 */}
      <footer className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          资源持续更新中 | 最后更新：{today}
        </p>
      </footer>
    </Layout>
  );
}
