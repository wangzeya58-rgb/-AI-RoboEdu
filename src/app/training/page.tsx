'use client';

import Layout from '@/components/Layout';
import Link from 'next/link';
import { Rocket, Lightbulb, FlaskConical, ChevronRight } from 'lucide-react';

// 功能卡片组件
function FeatureCards() {
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 我的数据集 */}
        <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Rocket className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">我的数据集</h3>
              <p className="text-sm text-gray-500 mb-4">
                管理和查看您的训练数据集，支持多种格式导入，快速构建高质量数据集用于模型训练
              </p>
              <button disabled className="text-sm text-gray-400 font-medium flex items-center gap-1 cursor-not-allowed">
                进入管理（尚未开放） <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 我的算法训练 */}
        <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">我的算法训练</h3>
              <p className="text-sm text-gray-500 mb-4">
                创建和监控深度学习模型训练任务，实时查看训练进度、损失曲线与性能指标
              </p>
              <button disabled className="text-sm text-gray-400 font-medium flex items-center gap-1 cursor-not-allowed">
                开始训练（尚未开放） <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 我的模型库 */}
        <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">我的模型库</h3>
              <p className="text-sm text-gray-500 mb-4">
                存储和管理训练完成的模型，支持版本控制、模型对比与一键部署到小车设备
              </p>
              <button disabled className="text-sm text-gray-400 font-medium flex items-center gap-1 cursor-not-allowed">
                查看模型（尚未开放） <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Layout activeMenu="/training">
      <div className="p-6">
        {/* 标题区域 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            欢迎开启AI智能小车深度学习之旅
          </h1>
          <div className="flex gap-3">
            <Link href="/help-center" className="px-6 py-2 bg-[#2386FF] text-white rounded-lg hover:bg-blue-600 transition-colors">
              查看指引
            </Link>
            <Link href="/help-center" className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              帮助中心
            </Link>
          </div>
        </div>

        {/* 功能卡片 */}
        <FeatureCards />
      </div>
    </Layout>
  );
}
