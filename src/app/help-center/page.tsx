'use client';

import Layout from '@/components/Layout';
import { BookOpen, Video, FileText, HelpCircle, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';

const helpCategories = [
  {
    icon: BookOpen,
    title: '入门指南',
    description: '快速了解平台功能，开始您的AI学习之旅',
    articles: 12,
    color: 'blue',
  },
  {
    icon: Video,
    title: '视频教程',
    description: '观看详细视频教程，手把手教学',
    articles: 24,
    color: 'purple',
  },
  {
    icon: FileText,
    title: '技术文档',
    description: '查阅完整的技术文档和API说明',
    articles: 36,
    color: 'green',
  },
  {
    icon: HelpCircle,
    title: '常见问题',
    description: '快速找到常见问题的解决方案',
    articles: 48,
    color: 'orange',
  },
];

const popularArticles = [
  { title: '如何开始第一次AI训练？', category: '入门指南', views: 1256 },
  { title: '数据集导入格式说明', category: '技术文档', views: 987 },
  { title: '模型部署到小车设备教程', category: '视频教程', views: 856 },
  { title: '训练参数调优指南', category: '技术文档', views: 743 },
  { title: '如何处理训练失败问题？', category: '常见问题', views: 621 },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Layout activeMenu="/help-center">
      <div className="p-6">
        {/* 标题区域 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">帮助中心</h1>
          <p className="text-gray-600">查找您需要的帮助文档和教程</p>
        </div>

        {/* 搜索栏 */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索帮助文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 分类卡片 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">帮助分类</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {helpCategories.map((category) => {
              const Icon = category.icon;
              const colorClasses = {
                blue: 'bg-blue-100 text-blue-600',
                purple: 'bg-purple-100 text-purple-600',
                green: 'bg-green-100 text-green-600',
                orange: 'bg-orange-100 text-orange-600',
              };
              return (
                <div key={category.title} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colorClasses[category.color as keyof typeof colorClasses]}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{category.title}</h3>
                  <p className="text-sm text-gray-500 mb-3">{category.description}</p>
                  <p className="text-xs text-gray-400">{category.articles} 篇文章</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 热门文章 */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">热门文章</h2>
          <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
            {popularArticles.map((article, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">{article.title}</h3>
                  <p className="text-xs text-gray-400">{article.category} · {article.views} 次浏览</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
