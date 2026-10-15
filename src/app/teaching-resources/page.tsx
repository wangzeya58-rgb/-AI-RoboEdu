'use client';

import { Suspense } from 'react';
import Layout from '@/components/Layout';
import Header from '@/components/teaching-resources/Header';
import ResourcesGrid from '@/components/teaching-resources/ResourcesGrid';
import { CourseResourceManager } from '@/components/course/CourseResourceManager';

export default function TeachingResourcesPage() {
  return (
    <Layout activeMenu="/teaching-resources">
      <Header />
      
      {/* 教学资源区 */}
      <section className="px-12 py-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          教学资源库
        </h3>
        <ResourcesGrid />
      </section>

      <section className="px-12 pb-8">
        <Suspense
          fallback={
            <div className="rounded-xl border border-[#E5EAF0] bg-white p-8 text-sm text-[#7B8794]">
              正在加载课程资源库...
            </div>
          }
        >
          <CourseResourceManager />
        </Suspense>
      </section>

      {/* 底部 */}
      <footer className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          教学资源持续更新中 | 如需更多资源请联系管理员
        </p>
      </footer>
    </Layout>
  );
}
