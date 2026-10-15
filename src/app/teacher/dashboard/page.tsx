"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import {
  PortalShell,
  buildTeacherMenu,
} from "@/components/portal/PortalShell";
import { ROLES, type CourseStatus } from "@/lib/auth/roles";
import { authFetch } from "@/lib/auth/client";

interface CourseRow {
  id: string;
  title: string;
  category: string;
  description: string;
  status: CourseStatus;
  reject_reason?: string | null;
  created_at: string;
  updated_at?: string | null;
  duration_minutes: number;
  teacher_name?: string | null;
}

interface CourseListResponse {
  success: boolean;
  data?: CourseRow[];
  error?: string;
}

const STATUS_LABEL: Record<CourseStatus, string> = {
  draft: "草稿",
  pending: "待审核",
  approved: "已上架",
  rejected: "已驳回",
  offline: "已下架",
};

const STATUS_COLOR: Record<CourseStatus, string> = {
  draft: "#909399",
  pending: "#2386FF",
  approved: "#25D366",
  rejected: "#FF4D4F",
  offline: "#909399",
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5EAF0] p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ background: `${color}1A`, color }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#151E2B]">{value}</div>
        <div className="text-xs text-[#7B8794] mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await authFetch("/api/courses");
        const data: CourseListResponse = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          setCourses(data.data);
          const c = { draft: 0, pending: 0, approved: 0, rejected: 0 };
          data.data.forEach((row) => {
            if (row.status in c) {
              c[row.status as keyof typeof c]++;
            }
          });
          setCounts(c);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const menu = buildTeacherMenu(counts);
  const recent = courses.slice(0, 5);

  return (
    <PortalShell
      role={ROLES.TEACHER}
      menu={menu}
      title="老师工作台"
      subtitle="管理课程草稿、查看审核进度、上传新课件"
    >
      <div className="flex items-center justify-end mb-6">
        <Link
          href="/course/manage/new"
          className="inline-flex items-center gap-1.5 bg-[#2386FF] hover:bg-[#1E76E6] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          上传新课程
        </Link>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={FileText}
          label="草稿箱"
          value={counts.draft}
          color="#909399"
        />
        <StatCard
          icon={Clock}
          label="待审核"
          value={counts.pending}
          color="#2386FF"
        />
        <StatCard
          icon={CheckCircle2}
          label="已上架"
          value={counts.approved}
          color="#25D366"
        />
        <StatCard
          icon={XCircle}
          label="已驳回"
          value={counts.rejected}
          color="#FF4D4F"
        />
      </div>

      {/* 最近课程 */}
      <div className="bg-white rounded-xl border border-[#E5EAF0]">
        <div className="px-6 py-4 border-b border-[#E5EAF0] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#151E2B] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#2386FF]" />
            最近课程
          </h2>
          <Link
            href="/course/manage"
            className="text-xs text-[#2386FF] hover:underline"
          >
            查看全部
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#7B8794]">加载中...</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-[#D0D7E0] mx-auto mb-3" />
            <div className="text-sm text-[#7B8794] mb-4">还没有上传过课程</div>
            <Link
              href="/course/manage/new"
              className="inline-flex items-center gap-1.5 bg-[#2386FF] hover:bg-[#1E76E6] text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              立即上传
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F5F7F9] text-[#7B8794] text-xs">
              <tr>
                <th className="text-left px-6 py-3 font-medium">课程名称</th>
                <th className="text-left px-6 py-3 font-medium">分类</th>
                <th className="text-left px-6 py-3 font-medium">状态</th>
                <th className="text-left px-6 py-3 font-medium">更新时间</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[#E5EAF0] hover:bg-[#F5F7F9]/50"
                >
                  <td className="px-6 py-3 text-[#151E2B] font-medium">
                    {c.title}
                  </td>
                  <td className="px-6 py-3 text-[#5B6B7B]">{c.category}</td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs"
                      style={{
                        color: STATUS_COLOR[c.status],
                        background: `${STATUS_COLOR[c.status]}1A`,
                      }}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[#7B8794] text-xs">
                    {c.updated_at
                      ? new Date(c.updated_at).toLocaleString("zh-CN")
                      : new Date(c.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/course/manage?courseId=${encodeURIComponent(c.id)}`}
                      className="text-xs text-[#2386FF] hover:underline"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PortalShell>
  );
}
