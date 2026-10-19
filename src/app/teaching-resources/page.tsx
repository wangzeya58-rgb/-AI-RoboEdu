'use client';

import Layout from '@/components/Layout';
import Header from '@/components/teaching-resources/Header';
import ResourcesGrid from '@/components/teaching-resources/ResourcesGrid';

export default function TeachingResourcesPage() {
  return (
    <Layout activeMenu="/teaching-resources" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
      <Header />
      
      {/* 教学资源区 */}
      <section className="px-4 py-6 sm:px-6 lg:px-12">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          教学资源库
        </h3>
        <ResourcesGrid />
      </section>

      {/* 底部 */}
      <footer className="px-4 py-6 sm:px-6 lg:px-12 border-t" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          教学资源持续更新中 | 如需更多资源请联系管理员
        </p>
      </footer>
    </Layout>
  );
}
