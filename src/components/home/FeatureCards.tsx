import { Rocket, Lightbulb, FlaskConical, ChevronRight } from 'lucide-react';

export default function HomeFeatureCards() {
  return (
    <section className="px-12 pb-8">
      <div className="grid grid-cols-3 gap-6">
        {/* 我的数据集 */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ backgroundColor: '#E8F4FD' }}
          >
            <Rocket className="w-6 h-6" style={{ color: '#2386FF' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#151E2B' }}>
            我的数据集
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            管理和查看您的训练数据集，支持多种格式导入，快速构建高质量数据集用于模型训练
          </p>
          <button
            className="mt-4 flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            style={{ color: '#2386FF' }}
          >
            进入管理
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 我的算法训练 */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ backgroundColor: '#FEF3C7' }}
          >
            <Lightbulb className="w-6 h-6" style={{ color: '#F59E0B' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#151E2B' }}>
            我的算法训练
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            创建和监控深度学习模型训练任务，实时查看训练进度、损失曲线与性能指标
          </p>
          <button
            className="mt-4 flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            style={{ color: '#2386FF' }}
          >
            开始训练
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 我的模型库 */}
        <div
          className="rounded-xl p-6 transition-all hover:shadow-lg"
          style={{
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ backgroundColor: '#D1FAE5' }}
          >
            <FlaskConical className="w-6 h-6" style={{ color: '#10B981' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#151E2B' }}>
            我的模型库
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            存储和管理训练完成的模型，支持版本控制、模型对比与一键部署到小车设备
          </p>
          <button
            className="mt-4 flex items-center gap-1 text-sm font-medium transition-all hover:gap-2"
            style={{ color: '#2386FF' }}
          >
            查看模型
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
