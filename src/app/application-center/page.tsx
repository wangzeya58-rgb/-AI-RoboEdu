'use client';

import Layout from '@/components/Layout';
import Link from 'next/link';
import { Cpu, HardDrive, Play, BookOpen, Download, Settings, CheckCircle, ArrowRight } from 'lucide-react';

const modules = [
  {
    name: '小车模型部署',
    href: null,
    desc: '将训练好的AI模型一键部署到RoboMaster小车',
    icon: Download,
    color: '#2386FF',
    bgColor: '#E8F4FD',
    features: ['模型版本选择', '设备连接配置', '远程一键部署'],
  },
  {
    name: '硬件联动调试',
    href: '/car-control',
    desc: '实时调试小车传感器与执行器联动效果',
    icon: Settings,
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    features: ['传感器数据监控', '执行器控制', '实时参数调整'],
  },
  {
    name: '实景仿真测试',
    href: '/simulator',
    desc: '在虚拟环境中测试模型性能与鲁棒性',
    icon: Play,
    color: '#10B981',
    bgColor: '#D1FAE5',
    features: ['虚拟场景构建', '仿真运行测试', '性能指标分析'],
  },
  {
    name: '应用案例库',
    href: null,
    desc: '丰富的AI小车应用案例与最佳实践',
    icon: BookOpen,
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    features: ['行业应用案例', '代码示例参考', '部署最佳实践'],
  },
];

const recentDeployments = [
  { name: '目标检测模型v2.1', device: 'RM-001', time: '2024-01-15 14:30', status: '成功' },
  { name: '车道线识别v1.0', device: 'RM-002', time: '2024-01-14 10:20', status: '成功' },
  { name: '避障模型v1.5', device: 'RM-003', time: '2024-01-13 16:45', status: '成功' },
];

export default function ApplicationCenterPage() {
  return (
    <Layout activeMenu="/application-center">
      {/* 顶部标题 */}
      <header className="px-12 pt-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-2xl font-bold" style={{ color: '#151E2B' }}>
          AI模型应用中心
        </h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          模型部署、硬件调试与仿真测试一体化平台
        </p>
      </header>

      {/* 功能模块区 */}
      <section className="px-12 py-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          核心功能
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div
                key={idx}
                className="rounded-xl p-6 transition-all hover:shadow-lg"
                style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: mod.bgColor }}
                  >
                    <Icon className="w-6 h-6" style={{ color: mod.color }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold mb-1" style={{ color: '#151E2B' }}>
                      {mod.name}
                    </h4>
                    <p className="text-sm mb-3" style={{ color: '#6B7280' }}>
                      {mod.desc}
                    </p>
                    <div className="space-y-1.5">
                      {mod.features.map((feat, fidx) => (
                        <div key={fidx} className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                          <CheckCircle className="w-3.5 h-3.5" style={{ color: mod.color }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {mod.href ? <Link href={mod.href}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: mod.color }}
                >进入模块<ArrowRight className="w-4 h-4" /></Link> : <button disabled
                  className="mt-4 w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ backgroundColor: mod.color, color: 'white' }}
                >
                  尚未开放
                  <ArrowRight className="w-4 h-4" />
                </button>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 近期部署记录 */}
      <section className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          部署记录（示例数据）
        </h3>
        <div className="space-y-3">
          {recentDeployments.map((deploy, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 flex items-center justify-between transition-all hover:shadow"
              style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#E8F4FD' }}
                >
                  <Cpu className="w-5 h-5" style={{ color: '#2386FF' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#151E2B' }}>
                    {deploy.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                      <HardDrive className="w-3 h-3" />
                      {deploy.device}
                    </span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                      {deploy.time}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                  style={{ backgroundColor: '#D1FAE5', color: '#10B981' }}
                >
                  <CheckCircle className="w-3 h-3" />
                  {deploy.status}
                </span>
                <button disabled title="部署详情尚未开放"
                  className="px-3 py-1.5 rounded text-xs font-medium transition-all hover:opacity-80"
                  style={{ border: '1px solid #D1D5DB', color: '#374151' }}
                >
                  查看详情（尚未开放）
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

    </Layout>
  );
}
