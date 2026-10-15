import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TrainingHeader() {
  return (
    <header className="px-12 pt-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-all hover:bg-gray-50"
          style={{ borderColor: '#D1D5DB', color: '#374151' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">返回首页</span>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold" style={{ color: '#151E2B' }}>
            AI智能小车训练平台
          </h2>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            从数据标注到模型部署的全流程AI训练系统
          </p>
        </div>
      </div>
    </header>
  );
}
