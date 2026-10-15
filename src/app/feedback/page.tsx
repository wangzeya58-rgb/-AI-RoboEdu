'use client';

import Layout from '@/components/Layout';
import { MessageSquare, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';

const feedbackHistory = [
  {
    id: 1,
    title: '训练任务无法启动',
    status: 'resolved',
    time: '2024-01-15 14:30',
    description: '创建训练任务时一直提示"资源不足"',
  },
  {
    id: 2,
    title: '数据集上传失败',
    status: 'pending',
    time: '2024-01-14 10:20',
    description: '上传超过100MB的数据集文件时失败',
  },
  {
    id: 3,
    title: '模型部署到设备后无响应',
    status: 'processing',
    time: '2024-01-13 16:45',
    description: '模型已成功部署到小车，但设备无任何响应',
  },
];

export default function FeedbackPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('bug');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 提交反馈逻辑
    alert('反馈已提交，我们会尽快处理！');
    setTitle('');
    setDescription('');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      resolved: { icon: CheckCircle, text: '已解决', color: 'text-green-600 bg-green-50' },
      pending: { icon: Clock, text: '待处理', color: 'text-yellow-600 bg-yellow-50' },
      processing: { icon: AlertCircle, text: '处理中', color: 'text-blue-600 bg-blue-50' },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </span>
    );
  };

  return (
    <Layout activeMenu="/feedback">
      <div className="p-6">
        {/* 标题区域 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">问题反馈</h1>
          <p className="text-gray-600">遇到问题？提交反馈，我们会尽快为您解决</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 提交反馈表单 */}
          <div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                提交新反馈
              </h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    反馈类型
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bug">Bug报告</option>
                    <option value="feature">功能建议</option>
                    <option value="question">使用问题</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    问题标题
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="简要描述您遇到的问题"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    详细描述
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="请详细描述问题，包括复现步骤、预期结果和实际结果"
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#2386FF] text-white py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  提交反馈
                </button>
              </form>
            </div>
          </div>

          {/* 反馈历史 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">我的反馈记录</h2>
            <div className="space-y-4">
              {feedbackHistory.map((feedback) => (
                <div key={feedback.id} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">{feedback.title}</h3>
                    {getStatusBadge(feedback.status)}
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{feedback.description}</p>
                  <p className="text-xs text-gray-400">{feedback.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
