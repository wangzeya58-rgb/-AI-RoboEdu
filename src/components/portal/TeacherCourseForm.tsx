"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Send,
  Upload,
  X,
  Video,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import {
  PortalShell,
  buildTeacherMenu,
} from "@/components/portal/PortalShell";
import {
  ROLES,
  COURSE_CATEGORIES,
  COURSE_STATUS_LABEL,
  COURSE_STATUS_COLOR,
  MATERIAL_TYPE_LABELS,
  type CourseStatus,
  type MaterialType,
} from "@/lib/auth/roles";
import { authFetch } from "@/lib/auth/client";

interface MaterialItem {
  type: MaterialType;
  name: string;
  url: string;
  size: number;
}

interface CourseFormState {
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  materials: MaterialItem[];
}

interface CourseApiRow extends CourseFormState {
  id: string;
  status: CourseStatus;
  reject_reason?: string | null;
}

const ACCEPT_MAP: Record<MaterialType, string> = {
  video: "video/*",
  document: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt",
  image: "image/*",
};

const MAX_SIZE: Record<MaterialType, number> = {
  video: 200 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  image: 5 * 1024 * 1024,
};

interface CourseFormProps {
  mode: "new" | "edit";
}

function formatSize(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getMaterialIcon(type: MaterialType) {
  if (type === "video") return <Video className="w-4 h-4 text-[#2386FF]" />;
  if (type === "image") return <ImageIcon className="w-4 h-4 text-[#25D366]" />;
  return <FileText className="w-4 h-4 text-[#FF8C42]" />;
}

export function TeacherCourseForm({ mode }: CourseFormProps) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = mode === "edit" ? params?.id : undefined;
  const [form, setForm] = useState<CourseFormState>({
    title: "",
    category: COURSE_CATEGORIES[0].value,
    description: "",
    duration_minutes: 0,
    materials: [],
  });
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<CourseStatus>("draft");
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadCourse() {
      if (mode !== "edit" || !id) {
        setLoading(false);
        return;
      }
      try {
        const res = await authFetch(`/api/courses/${id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.success) {
          setErrorMsg(data.error || "加载课程失败");
          return;
        }
        const c = data.data as CourseApiRow;
        setForm({
          title: c.title || "",
          category: c.category || COURSE_CATEGORIES[0].value,
          description: c.description || "",
          duration_minutes: c.duration_minutes || 0,
          materials: (c.materials || []).map((m) => ({
            type: m.type,
            name: m.name,
            url: m.url,
            size: m.size || 0,
          })),
        });
        setCurrentStatus(c.status);
        setRejectReason(c.reject_reason ?? null);
      } catch (err) {
        console.error(err);
        setErrorMsg("加载课程失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCourse();
    return () => {
      cancelled = true;
    };
  }, [id, mode]);

  useEffect(() => {
    authFetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          const c = { draft: 0, pending: 0, approved: 0, rejected: 0 };
          (data.data as CourseApiRow[]).forEach((row) => {
            if (row.status in c) c[row.status as keyof typeof c]++;
          });
          setCounts(c);
        }
      });
  }, []);

  function handleAddMaterial(type: MaterialType) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT_MAP[type];
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_SIZE[type]) {
        alert(
          `文件大小超过限制（${
            type === "video" ? "200MB" : type === "document" ? "20MB" : "5MB"
          }）`
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setForm((prev) => ({
          ...prev,
          materials: [
            ...prev.materials,
            { type, name: file.name, url: dataUrl, size: file.size },
          ],
        }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function handleRemoveMaterial(idx: number) {
    setForm((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(action: "draft" | "submit") {
    setErrorMsg(null);
    if (!form.title.trim()) {
      setErrorMsg("请填写课程名称");
      return;
    }
    if (form.materials.length === 0) {
      setErrorMsg("请至少上传一份课程素材");
      return;
    }
    try {
      setSubmitting(true);
      const url = mode === "edit" ? `/api/courses/${id}` : "/api/courses";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "保存失败");
        return;
      }
      alert(data.message || "已保存");
      router.push("/course/manage");
    } catch (err) {
      console.error(err);
      setErrorMsg("保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const menu = buildTeacherMenu(counts);
  const canEdit = mode === "new" || currentStatus === "draft" || currentStatus === "rejected";

  if (loading) {
    return (
      <PortalShell role={ROLES.TEACHER} menu={menu} title="加载中...">
        <div className="text-sm text-[#7B8794]">加载中...</div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      role={ROLES.TEACHER}
      menu={menu}
      title={mode === "edit" ? "编辑课程" : "上传新课程"}
      subtitle={
        mode === "edit"
          ? "编辑课程信息后可重新提交审核"
          : "填写课程信息并上传素材，可保存草稿或提交审核"
      }
    >
      <div className="mb-4">
        <Link
          href="/course/manage"
          className="inline-flex items-center gap-1 text-xs text-[#2386FF] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回课程列表
        </Link>
      </div>

      {mode === "edit" && currentStatus && (
        <div className="mb-4 flex items-center gap-3 bg-white border border-[#E5EAF0] rounded-lg px-4 py-3 flex-wrap">
          <span className="text-xs text-[#7B8794]">当前状态：</span>
          <span
            className="inline-block px-2 py-0.5 rounded text-xs"
            style={{
              color: COURSE_STATUS_COLOR[currentStatus],
              background: `${COURSE_STATUS_COLOR[currentStatus]}1A`,
            }}
          >
            {COURSE_STATUS_LABEL[currentStatus]}
          </span>
          {currentStatus === "rejected" && rejectReason && (
            <span className="text-xs text-[#FF4D4F]">
              驳回原因：{rejectReason}
            </span>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 text-xs text-[#FF4D4F] bg-[#FFF1F0] border border-[#FFD7D4] rounded-lg px-3 py-2">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6">
            <h2 className="text-sm font-semibold text-[#151E2B] mb-4">
              基本信息
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#5B6B7B] mb-1.5">
                  课程名称 <span className="text-[#FF4D4F]">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  disabled={!canEdit}
                  placeholder="例如：智能小车视觉识别入门"
                  className="w-full px-3 py-2 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg text-sm text-[#151E2B] placeholder:text-[#9CA8B5] focus:outline-none focus:border-[#2386FF] disabled:text-[#7B8794]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B6B7B] mb-1.5">
                  课程分类 <span className="text-[#FF4D4F]">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  disabled={!canEdit}
                  className="w-full px-3 py-2 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg text-sm text-[#151E2B] focus:outline-none focus:border-[#2386FF]"
                >
                  {COURSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#5B6B7B] mb-1.5">
                  课程简介
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  disabled={!canEdit}
                  rows={4}
                  placeholder="介绍课程目标、适合人群、核心内容等"
                  className="w-full px-3 py-2 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg text-sm text-[#151E2B] placeholder:text-[#9CA8B5] focus:outline-none focus:border-[#2386FF] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5B6B7B] mb-1.5">
                  课程时长（分钟）
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      duration_minutes: Number(e.target.value) || 0,
                    })
                  }
                  disabled={!canEdit}
                  className="w-full px-3 py-2 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg text-sm text-[#151E2B] focus:outline-none focus:border-[#2386FF]"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6">
            <h2 className="text-sm font-semibold text-[#151E2B] mb-2">
              课程素材
            </h2>
            <p className="text-xs text-[#7B8794] mb-4">
              支持视频（≤200MB）、文档 PDF/Word/PPT/Excel 等（≤20MB）、图文
              JPG/PNG 等（≤5MB）
            </p>

            {form.materials.length > 0 && (
              <div className="space-y-2 mb-4">
                {form.materials.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 bg-[#F5F7F9] border border-[#E5EAF0] rounded-lg"
                  >
                    {getMaterialIcon(m.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#151E2B] truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-[#7B8794]">
                        {MATERIAL_TYPE_LABELS[m.type]} · {formatSize(m.size)}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveMaterial(idx)}
                        className="text-[#7B8794] hover:text-[#FF4D4F]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="grid grid-cols-3 gap-3">
                {(["video", "document", "image"] as MaterialType[]).map(
                  (type) => (
                    <button
                      key={type}
                      onClick={() => handleAddMaterial(type)}
                      className="flex flex-col items-center justify-center gap-1.5 py-4 border-2 border-dashed border-[#E5EAF0] hover:border-[#2386FF] rounded-lg text-[#7B8794] hover:text-[#2386FF] transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">
                        上传{MATERIAL_TYPE_LABELS[type]}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-[#E5EAF0] p-6 sticky top-4">
            <h2 className="text-sm font-semibold text-[#151E2B] mb-4">操作</h2>
            <div className="space-y-2">
              {canEdit ? (
                <>
                  <button
                    onClick={() => handleSubmit("submit")}
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-[#2386FF] hover:bg-[#1E76E6] disabled:bg-[#9BC4F8] text-white py-2.5 rounded-lg text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                    {mode === "edit" ? "重新提交审核" : "提交审核"}
                  </button>
                  <button
                    onClick={() => handleSubmit("draft")}
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-white hover:bg-[#F5F7F9] border border-[#E5EAF0] text-[#151E2B] py-2.5 rounded-lg text-sm font-medium"
                  >
                    <Save className="w-4 h-4" />
                    保存为草稿
                  </button>
                </>
              ) : (
                <div className="text-xs text-[#7B8794] bg-[#F5F7F9] rounded-lg p-3">
                  课程处于
                  {COURSE_STATUS_LABEL[currentStatus]}
                  状态，暂不可编辑。如需修改请联系管理员。
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[#E5EAF0] text-[11px] text-[#7B8794] leading-relaxed">
              <p>· 草稿可随时编辑，提交审核后由管理员处理</p>
              <p>· 驳回后可修改并重新提交</p>
              <p>· 已上架课程修改需联系管理员</p>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
