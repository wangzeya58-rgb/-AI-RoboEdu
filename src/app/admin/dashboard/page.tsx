"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, Clock, CheckCircle2, XCircle, Archive } from "lucide-react";
import {
  PortalShell,
  buildAdminMenu,
} from "@/components/portal/PortalShell";
import { ROLES, type CourseStatus } from "@/lib/auth/roles";
import { authFetch } from "@/lib/auth/client";

interface CourseRow {
  id: string;
  title: string;
  category: string;
  description: string;
  status: CourseStatus;
  teacher_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

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

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    offline: 0,
  });
  const [pendingList, setPendingList] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const allRes = await authFetch("/api/courses");
        const allData = await allRes.json();
        if (cancelled) return;
        if (allData.success && allData.data) {
          const c = { pending: 0, approved: 0, rejected: 0, offline: 0 };
          allData.data.forEach((row: CourseRow) => {
            if (row.status in c) {
              c[row.status as keyof typeof c]++;
            }
          });
          setCounts(c);
        }
        const pendingRes = await authFetch("/api/courses?status=pending");
        const pendingData = await pendingRes.json();
        if (pendingData.success && pendingData.data) {
          setPendingList(pendingData.data.slice(0, 5));
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

  const menu = buildAdminMenu(counts);

  return (
    <PortalShell
      role={ROLES.ADMIN}
      menu={menu}
      title="管理员工作台"
      subtitle="审核老师课程、管理上下架状态、发布平台内容"
    >
      <div className="flex items-center justify-end mb-6">
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1FB958] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          自主上传课程
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
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
        <StatCard
          icon={Archive}
          label="已下架"
          value={counts.offline}
          color="#909399"
        />
      </div>

      <div className="bg-white rounded-xl border border-[#E5EAF0]">
        <div className="px-6 py-4 border-b border-[#E5EAF0] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#151E2B] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2386FF]" />
            待审核课程
          </h2>
          <Link
            href="/admin/courses?status=pending"
            className="text-xs text-[#2386FF] hover:underline"
          >
            查看全部
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-[#7B8794]">加载中...</div>
        ) : pendingList.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-[#D0D7E0] mx-auto mb-3" />
            <div className="text-sm text-[#7B8794]">暂无待审核课程</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F5F7F9] text-[#7B8794] text-xs">
              <tr>
                <th className="text-left px-6 py-3 font-medium">课程名称</th>
                <th className="text-left px-6 py-3 font-medium">提交教师</th>
                <th className="text-left px-6 py-3 font-medium">分类</th>
                <th className="text-left px-6 py-3 font-medium">提交时间</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingList.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[#E5EAF0] hover:bg-[#F5F7F9]/50"
                >
                  <td className="px-6 py-3 text-[#151E2B] font-medium">
                    {c.title}
                  </td>
                  <td className="px-6 py-3 text-[#5B6B7B]">
                    {c.teacher_name || "-"}
                  </td>
                  <td className="px-6 py-3 text-[#5B6B7B]">{c.category}</td>
                  <td className="px-6 py-3 text-[#7B8794] text-xs">
                    {new Date(c.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      href={`/admin/courses/review?id=${encodeURIComponent(c.id)}`}
                      className="text-xs text-[#2386FF] hover:underline"
                    >
                      审核
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
