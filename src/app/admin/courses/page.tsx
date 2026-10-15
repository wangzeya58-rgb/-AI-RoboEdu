"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  BookOpen,
  CheckCircle2,
  XCircle,
  Archive,
  Edit,
  Trash2,
  Power,
} from "lucide-react";
import {
  PortalShell,
  buildAdminMenu,
} from "@/components/portal/PortalShell";
import {
  ROLES,
  COURSE_STATUS_LABEL,
  COURSE_STATUS_COLOR,
  type CourseStatus,
} from "@/lib/auth/roles";
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
  duration_minutes: number;
  reject_reason?: string | null;
}

function AdminCoursesList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusFilter = searchParams.get("status") as CourseStatus | null;
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    offline: 0,
  });

  async function load() {
    try {
      setLoading(true);
      const url = statusFilter
        ? `/api/courses?status=${statusFilter}`
        : "/api/courses";
      const res = await authFetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setCourses(data.data);
      }
      const allRes = await authFetch("/api/courses");
      const allData = await allRes.json();
      if (allData.success && allData.data) {
        const c = { pending: 0, approved: 0, rejected: 0, offline: 0 };
        allData.data.forEach((row: CourseRow) => {
          if (row.status in c) c[row.status as keyof typeof c]++;
        });
        setCounts(c);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleDelete(id: string) {
    if (!confirm("确认删除该课程？删除后不可恢复")) return;
    const res = await authFetch(`/api/courses/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      load();
    } else {
      alert(data.error || "删除失败");
    }
  }

  async function handleToggleStatus(id: string, currentStatus: CourseStatus) {
    const isOnline = currentStatus === "approved";
    if (!confirm(isOnline ? "确认下架该课程？" : "确认重新上架？")) return;
    const res = await authFetch(`/api/courses/${id}/toggle-status`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.success) {
      load();
    } else {
      alert(data.error || "操作失败");
    }
  }

  const filtered = keyword
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(keyword.toLowerCase()) ||
          c.teacher_name?.toLowerCase().includes(keyword.toLowerCase())
      )
    : courses;

  const menu = buildAdminMenu(counts);

  return (
    <PortalShell
      role={ROLES.ADMIN}
      menu={menu}
      title={
        statusFilter
          ? `课程管理 · ${COURSE_STATUS_LABEL[statusFilter]}`
          : "课程管理"
      }
      subtitle="查看全平台课程并进行审核与上下架管理"
    >
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B8794]" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索课程名称/教师"
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5EAF0] rounded-lg text-sm focus:outline-none focus:border-[#2386FF]"
          />
        </div>
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1FB958] text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          自主上传课程
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#E5EAF0]">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#7B8794]">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-[#D0D7E0] mx-auto mb-3" />
            <div className="text-sm text-[#7B8794]">
              {statusFilter
                ? `${COURSE_STATUS_LABEL[statusFilter]}状态下暂无课程`
                : "暂无课程"}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F5F7F9] text-[#7B8794] text-xs">
              <tr>
                <th className="text-left px-6 py-3 font-medium">课程名称</th>
                <th className="text-left px-6 py-3 font-medium">提交教师</th>
                <th className="text-left px-6 py-3 font-medium">分类</th>
                <th className="text-left px-6 py-3 font-medium">时长</th>
                <th className="text-left px-6 py-3 font-medium">状态</th>
                <th className="text-left px-6 py-3 font-medium">提交时间</th>
                <th className="text-right px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[#E5EAF0] hover:bg-[#F5F7F9]/50"
                >
                  <td className="px-6 py-3 text-[#151E2B] font-medium">
                    <div>{c.title}</div>
                    {c.status === "rejected" && c.reject_reason && (
                      <div className="text-[11px] text-[#FF4D4F] mt-1">
                        驳回原因：{c.reject_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[#5B6B7B]">
                    {c.teacher_name || "-"}
                  </td>
                  <td className="px-6 py-3 text-[#5B6B7B]">{c.category}</td>
                  <td className="px-6 py-3 text-[#5B6B7B]">
                    {c.duration_minutes || 0} 分钟
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs"
                      style={{
                        color: COURSE_STATUS_COLOR[c.status],
                        background: `${COURSE_STATUS_COLOR[c.status]}1A`,
                      }}
                    >
                      {COURSE_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[#7B8794] text-xs">
                    {new Date(c.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {c.status === "pending" && (
                        <Link
                          href={`/admin/courses/review?id=${encodeURIComponent(c.id)}`}
                          className="text-xs text-[#2386FF] hover:underline"
                        >
                          审核
                        </Link>
                      )}
                      <Link
                        href={`/admin/courses/edit?id=${encodeURIComponent(c.id)}`}
                        className="text-xs text-[#5B6B7B] hover:text-[#2386FF]"
                      >
                        编辑
                      </Link>
                      {(c.status === "approved" || c.status === "offline") && (
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className="text-xs text-[#FF8C42] hover:underline"
                        >
                          {c.status === "approved" ? "下架" : "上架"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-xs text-[#FF4D4F] hover:underline"
                      >
                        删除
                      </button>
                    </div>
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

export default function AdminCoursesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[#7B8794]">
          加载中...
        </div>
      }
    >
      <AdminCoursesList />
    </Suspense>
  );
}
