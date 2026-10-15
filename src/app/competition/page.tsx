'use client';

import Layout from '@/components/Layout';
import { Trophy, Calendar, Users, Award, FileText, ChevronRight, MapPin, Clock } from 'lucide-react';

const competitions = [
  {
    name: 'RoboMaster校内选拔赛',
    level: '校内赛',
    date: '2024-03-15',
    location: '校内实训中心',
    status: '报名中',
    participants: 128,
  },
  {
    name: '广东省智能车竞赛',
    level: '省赛',
    date: '2024-05-20',
    location: '华南理工大学',
    status: '待开始',
    participants: 256,
  },
  {
    name: '全国大学生智能车竞赛',
    level: '国赛',
    date: '2024-08-10',
    location: '北京科技大学',
    status: '待开始',
    participants: 512,
  },
];

const awards = [
  { name: 'RoboMaster分区赛', award: '一等奖', team: '深职院一队', year: '2023' },
  { name: '广东省智能车竞赛', award: '二等奖', team: '深职院AI组', year: '2023' },
  { name: '全国智能车竞赛', award: '三等奖', team: '深职院代表队', year: '2022' },
];

export default function CompetitionPage() {
  return (
    <Layout activeMenu="/competition">
      {/* Banner标题栏 */}
      <header
        className="px-12 pt-10 pb-8"
        style={{ background: 'linear-gradient(135deg, #2386FF 0%, #1E6FD8 100%)' }}
      >
        <h2 className="text-2xl font-bold text-white">AI小车竞赛赛事</h2>
        <p className="text-sm mt-1 text-white text-opacity-90">
          参与各类智能车竞赛，展示训练成果，争夺荣誉奖项
        </p>
        <div className="flex gap-3 mt-4">
          <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white" style={{ color: '#2386FF' }}>
            赛事规则
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium border-2 border-white text-white">
            我要报名
          </button>
        </div>
      </header>

      {/* 赛事列表区 */}
      <section className="px-12 py-6">
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          近期赛事
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {competitions.map((comp, idx) => (
            <div
              key={idx}
              className="rounded-lg p-5 transition-all hover:shadow-lg"
              style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor:
                      comp.level === '国赛' ? '#FEE2E2' : comp.level === '省赛' ? '#FEF3C7' : '#E8F4FD',
                  }}
                >
                  <Trophy
                    className="w-5 h-5"
                    style={{ color: comp.level === '国赛' ? '#EF4444' : comp.level === '省赛' ? '#F59E0B' : '#2386FF' }}
                  />
                </div>
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor:
                      comp.level === '国赛' ? '#FEE2E2' : comp.level === '省赛' ? '#FEF3C7' : '#E8F4FD',
                    color: comp.level === '国赛' ? '#EF4444' : comp.level === '省赛' ? '#F59E0B' : '#2386FF',
                  }}
                >
                  {comp.level}
                </span>
              </div>
              <p className="text-sm font-semibold mb-2" style={{ color: '#151E2B' }}>
                {comp.name}
              </p>
              <div className="space-y-1.5 mb-4">
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                  <Calendar className="w-3 h-3" />
                  {comp.date}
                </p>
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                  <MapPin className="w-3 h-3" />
                  {comp.location}
                </p>
                <p className="text-xs flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                  <Users className="w-3 h-3" />
                  已报名 {comp.participants} 人
                </p>
              </div>
              <button
                className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
                style={{
                  backgroundColor: comp.status === '报名中' ? '#2386FF' : '#F3F4F6',
                  color: comp.status === '报名中' ? 'white' : '#6B7280',
                }}
              >
                {comp.status === '报名中' ? '立即报名' : '查看详情'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 赛事规则 */}
      <section className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          赛事规则与指南
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { name: '竞赛规则手册', icon: FileText },
            { name: '评分标准说明', icon: Award },
            { name: '报名流程指南', icon: Users },
            { name: '竞赛时间安排', icon: Clock },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-lg p-4 flex items-center gap-3 transition-all hover:shadow cursor-pointer"
                style={{ backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: '#F3F4F6' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#6B7280' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: '#151E2B' }}>
                  {item.name}
                </span>
                <ChevronRight className="w-4 h-4 ml-auto" style={{ color: '#9CA3AF' }} />
              </div>
            );
          })}
        </div>
      </section>

      {/* 获奖公示 */}
      <section className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: '#151E2B' }}>
          获奖公示
        </h3>
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'white' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>
                  赛事名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>
                  获奖等级
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>
                  获奖团队
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>
                  年份
                </th>
              </tr>
            </thead>
            <tbody>
              {awards.map((award, idx) => (
                <tr key={idx} className="border-t" style={{ borderColor: '#E5E7EB' }}>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: '#151E2B' }}>
                    {award.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor:
                          award.award === '一等奖' ? '#FEE2E2' : award.award === '二等奖' ? '#FEF3C7' : '#D1FAE5',
                        color:
                          award.award === '一等奖' ? '#EF4444' : award.award === '二等奖' ? '#F59E0B' : '#10B981',
                      }}
                    >
                      {award.award}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>
                    {award.team}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>
                    {award.year}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 底部 */}
      <footer className="px-12 py-6 border-t" style={{ borderColor: '#E5E7EB' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>
          赛事信息由竞赛组委会提供 | 报名截止前可修改参赛信息
        </p>
      </footer>
    </Layout>
  );
}
