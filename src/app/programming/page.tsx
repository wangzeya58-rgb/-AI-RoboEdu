'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import { FileCode, Eye, Download, Video, FileText, BookOpen, Image, Folder, Clock, HardDrive } from 'lucide-react';

const programTabs = ['小车源码库', 'Python例程', '固件程序', '下载管理'];

const programs = [
  { name: 'robomaster_core.py', size: '128KB', time: '2024-01-15', type: 'Python' },
  { name: 'chassis_control.c', size: '256KB', time: '2024-01-14', type: 'C' },
  { name: 'vision_detect.py', size: '64KB', time: '2024-01-13', type: 'Python' },
  { name: 'motor_driver.cpp', size: '192KB', time: '2024-01-12', type: 'C++' },
  { name: 'sensor_fusion.py', size: '96KB', time: '2024-01-11', type: 'Python' },
];

const resources = [
  { name: '智能小车入门教程', type: '视频课件', icon: Video, count: '12课时' },
  { name: 'Python编程基础手册', type: 'PDF教案', icon: FileText, count: '86页' },
  { name: 'RoboMaster实训手册', type: '实训手册', icon: BookOpen, count: '完整版' },
  { name: '代码示例素材包', type: '配套素材', icon: Image, count: '128个文件' },
];

export default function ProgrammingPage() {
  const [activeTab, setActiveTab] = useState('小车源码库');

  return (
    <Layout activeMenu="/programming">
      {/* 顶部标题 */}
      <header className="px-12 pt-8 pb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
        <h2 className="text-2xl font-bold" style={{ color: '#151E2B' }}>
          智能小车编程程序
        </h2>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          程序源码管理、教学资源与开发工具
        </p>
      </header>

      {/* 程序文件区 */}
      <section className="px-12 py-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold mb-3" style={{ color: '#151E2B' }}>
            程序文件管理
          </h3>
          {/* 分类标签 */}
          <div className="flex gap-2 mb-4">
            {programTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: activeTab === tab ? '#2386FF' : 'white',
                  color: activeTab === tab ? 'white' : '#374151',
                  border: activeTab === tab ? 'none' : '1px solid #D1D5DB',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 程序列表 */}
        <div className="space-y-3">
          {programs.map((prog, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4 flex items-center justify-between transition-all hover:shadow"
              style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#F3F4F6' }}
                >
                  <FileCode className="w-5 h-5" style={{ color: '#6B7280' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#151E2B' }}>
                    {prog.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                      <HardDrive className="w-3 h-3" />
                      {prog.size}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                      <Clock className="w-3 h-3" />
                      {prog.time}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all hover:opacity-80"
                  style={{ border: '1px solid #D1D5DB', color: '#374151' }}
                >
                  <Eye className="w-3.5 h-3.5" />
                  预览
                </button>
                <button
                  className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all hover:opacity-90"
                  style={{ backgroundColor: '#2386FF', color: 'white' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 教学资源区 */}
      <section className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          教学资源
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {resources.map((res, idx) => {
            const Icon = res.icon;
            return (
              <div
                key={idx}
                className="rounded-lg p-4 transition-all hover:shadow-lg cursor-pointer"
                style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: '#F3F4F6' }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#2386FF' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: '#151E2B' }}>
                  {res.name}
                </p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  {res.type} · {res.count}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 底部 */}
      <footer className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          资源持续更新中 | 最后更新：2024-01-15
        </p>
      </footer>
    </Layout>
  );
}
