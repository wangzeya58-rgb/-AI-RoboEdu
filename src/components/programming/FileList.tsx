'use client';

import { useState, useEffect } from 'react';
import { FileCode, Eye, Download, HardDrive, Clock, AlertCircle } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: string;
  time: string;
  type: string;
  description?: string;
}

interface FileListProps {
  category: string;
}

export default function FileList({ category }: FileListProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // 模拟API请求
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      // 获取当前日期
      const today = new Date();
      const formatDate = (daysAgo: number) => {
        const date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0];
      };
      
      const sourceCodeFiles: FileItem[] = [
        {
          id: '1',
          name: '01_motion_control.py',
          size: '42KB',
          time: formatDate(0),
          type: '基础运动实验',
          description:
            '小车基础运动控制程序，实现前进、后退、转向和停止功能，学生可修改运动速度和控制逻辑。',
        },
        {
          id: '2',
          name: '02_camera_vision.py',
          size: '58KB',
          time: formatDate(1),
          type: 'AI视觉实验',
          description:
            '摄像头视觉识别程序，实现图像采集和目标检测功能。',
        },
        {
          id: '3',
          name: '03_sensor_fusion.py',
          size: '64KB',
          time: formatDate(2),
          type: '传感器实验',
          description:
            '多传感器数据处理程序，用于融合摄像头、雷达等感知信息。',
        },
        {
          id: '4',
          name: '04_robot_task.py',
          size: '76KB',
          time: formatDate(3),
          type: '综合任务实验',
          description:
            '综合运动控制、视觉识别和传感器功能，实现智能小车任务。',
        },
        {
          id: '5',
          name: '05_ai_agent_control.py',
          size: '88KB',
          time: formatDate(4),
          type: 'AI智能实验',
          description:
            '连接AI指令与机器人控制，实现自然语言控制实验。',
        },
      ];
      
      // 模拟空数据情况（下载管理默认为空）
      if (category === 'downloads') {
        setFiles([]);
      } else {
        setFiles(sourceCodeFiles);
      }
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [category]);

  // 处理预览
  const handlePreview = (file: FileItem) => {
    setPreviewFile(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3" style={{ color: '#6B7280' }}>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#2386FF', borderTopColor: 'transparent' }} />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: '#9CA3AF' }}>
        <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">暂无文件</p>
        <p className="text-xs mt-1">当前分类下没有可用的文件资源</p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-amber-700">示例文件信息，真实文件下载尚未开放。</p>
      <div className="space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
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
                  {file.name}
                </p>
                {file.description && (
                  <p className="text-xs mt-1 max-w-2xl" style={{ color: '#6B7280' }}>
                    {file.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                    <HardDrive className="w-3 h-3" />
                    {file.size}
                  </span>
                  <span className="text-xs flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                    <Clock className="w-3 h-3" />
                    {file.time}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePreview(file)}
                className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all hover:opacity-80"
                style={{ border: '1px solid #D1D5DB', color: '#374151' }}
              >
                <Eye className="w-3.5 h-3.5" />
                预览
              </button>
              <button
                disabled title="真实文件尚未接入"
                className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all hover:opacity-90"
                style={{ backgroundColor: '#2386FF', color: 'white' }}
              >
                <Download className="w-3.5 h-3.5" />
                下载（尚未开放）
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 预览弹窗 */}
      {previewFile && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-2xl"
            style={{ backgroundColor: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: '#151E2B' }}>
                文件预览
              </h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-sm"
                style={{ color: '#6B7280' }}
              >
                关闭
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6B7280' }}>文件名:</span>
                <span className="text-sm font-medium" style={{ color: '#151E2B' }}>{previewFile.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6B7280' }}>大小:</span>
                <span className="text-sm" style={{ color: '#151E2B' }}>{previewFile.size}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6B7280' }}>更新时间:</span>
                <span className="text-sm" style={{ color: '#151E2B' }}>{previewFile.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: '#6B7280' }}>类型:</span>
                <span className="text-sm" style={{ color: '#151E2B' }}>{previewFile.type}</span>
              </div>
              {previewFile.description && (
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0" style={{ color: '#6B7280' }}>描述:</span>
                  <span className="text-sm" style={{ color: '#151E2B' }}>{previewFile.description}</span>
                </div>
              )}
              <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>
                  此为示例文件信息，实际文件内容尚未接入。
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: '#D1D5DB', color: '#374151' }}
              >
                关闭
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#2386FF', color: 'white' }}
              >
                下载文件（尚未开放）
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
