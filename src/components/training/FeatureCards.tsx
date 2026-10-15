import { Rocket, Lightbulb, FlaskConical, ChevronRight, Tag, Database, Cpu, Download, TestTube } from 'lucide-react';

export default function TrainingFeatureCards() {
  return (
    <section className="px-12 py-8">
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
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
            管理训练数据集，支持多种数据格式导入与预处理
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Tag className="w-3.5 h-3.5" />
              <span>创建标注 - 图像标注与数据标注工具</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Database className="w-3.5 h-3.5" />
              <span>原始数据处理 - 数据清洗与格式转换</span>
            </div>
          </div>
          <button
            className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#2386FF', color: 'white' }}
          >
            进入数据集
            <ChevronRight className="w-4 h-4 inline-block ml-1" />
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
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
            创建训练任务，实时监控训练进度与性能指标
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Cpu className="w-3.5 h-3.5" />
              <span>数据集训练 - 选择数据集进行模型训练</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Rocket className="w-3.5 h-3.5" />
              <span>生成AI小车模型 - 自动生成推理模型</span>
            </div>
          </div>
          <button
            className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#F59E0B', color: 'white' }}
          >
            开始训练
            <ChevronRight className="w-4 h-4 inline-block ml-1" />
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
          <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B7280' }}>
            管理训练完成的模型，支持版本控制与部署
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Database className="w-3.5 h-3.5" />
              <span>模型管理 - 版本控制与模型对比</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <Download className="w-3.5 h-3.5" />
              <span>下发部署 - 一键部署到小车设备</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
              <TestTube className="w-3.5 h-3.5" />
              <span>推理测试 - 实时验证模型效果</span>
            </div>
          </div>
          <button
            className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#10B981', color: 'white' }}
          >
            查看模型库
            <ChevronRight className="w-4 h-4 inline-block ml-1" />
          </button>
        </div>
      </div>
    </section>
  );
}
