"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Video,
  FileText,
  Image as ImageIcon,
  User,
  Calendar,
  Clock,
} from "lucide-react";
import {
  PortalShell,
  buildAdminMenu,
} from "@/components/portal/PortalShell";
import {
  ROLES,
  COURSE_STATUS_LABEL,
  COURSE_STATUS_COLOR,
  MATERIAL_TYPE_LABELS,
  type CourseStatus,
  type MaterialType,
} from "@/lib/auth/roles";
import { authFetch } from "@/lib/auth/client";

interface MaterialItem {
  id: string;
  type: MaterialType;
  name: string;
  url: string;
  size: number;
}

interface CourseDetail {
  id: string;
  title: string;
  category: string;
  description: string;
  status: CourseStatus;
  teacher_id: string;
  teacher_name?: string;
  reject_reason?: string | null;
  created_at: string;
  updated_at?: string | null;
  duration_minutes: number;
  materials: MaterialItem[];
}

interface CourseStatusRow {
  status: CourseStatus;
}

function formatSize(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function AdminCourseReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    offline: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await authFetch(`/api/courses/${id}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setCourse(data.data);
        }
        const allRes = await authFetch("/api/courses");
        const allData = await allRes.json();
        if (allData.success && allData.data) {
          const c = { pending: 0, approved: 0, rejected: 0, offline: 0 };
          (allData.data as CourseStatusRow[]).forEach((row) => {
            if (row.status in c) c[row.status as keyof typeof c]++;
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
  }, [id]);

  async function handleReview(action: "approve" | "reject") {
    if (action === "reject" && !rejectReason.trim()) {
      alert("请填写驳回原因");
      return;
    }
    try {
      setSubmitting(true);
      const res = await authFetch(`/api/courses/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "操作成功");
        router.push("/admin/courses?status=pending");
      } else {
        alert(data.error || "操作失败");
      }
    } catch (err) {
      console.error(err);
      alert("操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  const menu = buildAdminMenu(counts);

  if (loading) {
    return (
      <PortalShell role={ROLES.ADMIN} menu={menu} title="课程审核">
        <div className="text-sm text-[#7B8794]">加载中...</div>
      </PortalShell>
    );
  }

  if (!course) {
    return (
      <PortalShell role={ROLES.ADMIN} menu={menu} title="课程审核">
        <div className="text-sm text-[#FF4D4F]">课程不存在或已被删除</div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      role={ROLES.ADMIN}
      menu={menu}
      title="课程审核"
      subtitle="审核老师提交的课程，决定是否上架"
    >
      <div className="mb-4">
        <Link
          href="/admin/courses?status=pending"
          className="inline-flex items-center gap-1 text-xs text-[#2386FF] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回待审核列表
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-[#151E2B]">
                {course.title}
              </h2>
              <span
                className="inline-block px-2 py-0.5 rounded text-xs"
                style={{
                  color: COURSE_STATUS_COLOR[course.status],
                  background: `${COURSE_STATUS_COLOR[course.status]}1A`,
                }}
              >
                {COURSE_STATUS_LABEL[course.status]}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
              <div className="flex items-center gap-2 text-[#5B6B7B]">
                <User className="w-3.5 h-3.5" />
                <span>提交教师：{course.teacher_name || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-[#5B6B7B]">
                <Calendar className="w-3.5 h-3.5" />
                <span>分类：{course.category}</span>
              </div>
              <div className="flex items-center gap-2 text-[#5B6B7B]">
                <Clock className="w-3.5 h-3.5" />
                <span>时长：{course.duration_minutes || 0} 分钟</span>
              </div>
            </div>

            <div className="border-t border-[#E5EAF0] pt-4">
              <h3 className="text-sm font-medium text-[#151E2B] mb-2">
                课程简介
              </h3>
              <p className="text-sm text-[#5B6B7B] whitespace-pre-wrap">
                {course.description || "（无简介）"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6">
            <h3 className="text-sm font-medium text-[#151E2B] mb-3">
              课程素材（{course.materials.length}）
            </h3>
            <div className="space-y-2">
              {course.materials.map((m) => {
                const Icon =
                  m.type === "video"
                    ? Video
                    : m.type === "image"
                      ? ImageIcon
                      : FileText;
                const color =
                  m.type === "video"
                    ? "#2386FF"
                    : m.type === "image"
                      ? "#25D366"
                      : "#FF8C42";
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg"
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#151E2B] truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-[#7B8794]">
                        {MATERIAL_TYPE_LABELS[m.type]} · {formatSize(m.size)}
                      </div>
                    </div>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#2386FF] hover:underline"
                    >
                      查看
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {course.status === "rejected" && course.reject_reason && (
            <div className="bg-[#FFF1F0] border border-[#FFD7D4] rounded-xl p-4 text-sm text-[#FF4D4F]">
              <div className="font-medium mb-1">驳回原因</div>
              <div>{course.reject_reason}</div>
            </div>
          )}
        </div>

        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6 sticky top-4">
            <h2 className="text-sm font-semibold text-[#151E2B] mb-4">
              审核操作
            </h2>

            {course.status === "pending" ? (
              <div className="space-y-3">
                {showRejectForm && (
                  <div>
                    <label className="block text-xs text-[#5B6B7B] mb-1.5">
                      驳回原因 <span className="text-[#FF4D4F]">*</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={4}
                      placeholder="请说明驳回原因，便于老师修改..."
                      className="w-full px-3 py-2 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg text-sm focus:outline-none focus:border-[#2386FF] resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReview("reject")}
                        disabled={submitting}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#FF4D4F] hover:bg-[#E64547] disabled:bg-[#FFA39E] text-white py-2 rounded-lg text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        确认驳回
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectReason("");
                        }}
                        className="px-3 py-2 bg-white border border-[#E5EAF0] text-[#5B6B7B] rounded-lg text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                {!showRejectForm && (
                  <>
                    <button
                      onClick={() => handleReview("approve")}
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1FB958] disabled:bg-[#7CE2A0] text-white py-2.5 rounded-lg text-sm font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      审核通过并上架
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-[#FF4D4F] text-[#FF4D4F] hover:bg-[#FFF1F0] py-2.5 rounded-lg text-sm font-medium"
                    >
                      <XCircle className="w-4 h-4" />
                      驳回修改
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#7B8794] bg-[#F5F7F9] rounded-lg p-3">
                该课程当前状态为
                {COURSE_STATUS_LABEL[course.status]}，无需审核。
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[#E5EAF0] space-y-1.5">
              <Link
                href={`/admin/courses/edit?id=${encodeURIComponent(course.id)}`}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-white border border-[#E5EAF0] text-[#151E2B] py-2 rounded-lg text-xs hover:border-[#2386FF]"
              >
                编辑课程内容
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
