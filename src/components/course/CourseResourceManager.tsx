"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  FileImage,
  FileText,
  FileVideo,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Presentation,
  Save,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  addCourseAsset,
  createTeacherCourse,
  deleteCourseAsset,
  getCourseAssetBlob,
  listTeacherCourses,
  updateTeacherCourse,
  type CourseAsset,
  type CourseAssetType,
  type TeacherCourse,
} from "@/lib/course/teacher-course-store";

const ASSET_TYPE_LABEL: Record<CourseAssetType, string> = {
  document: "Word 文档",
  presentation: "课件 / PDF",
  image: "图片素材",
  video: "视频素材",
};

const EXTENSIONS_BY_TYPE: Record<CourseAssetType, string[]> = {
  document: [".doc", ".docx"],
  presentation: [".ppt", ".pptx", ".pdf"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
  video: [".mp4", ".webm"],
};

const ACCEPTED_COURSEWARE_EXTENSIONS = Object.values(EXTENSIONS_BY_TYPE).flat();
const COURSEWARE_ACCEPT = ACCEPTED_COURSEWARE_EXTENSIONS.join(",");

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssetIcon(type: CourseAssetType) {
  if (type === "presentation") return <Presentation className="h-5 w-5 text-[#7C5CFF]" />;
  if (type === "document") return <FileText className="h-5 w-5 text-[#2386FF]" />;
  if (type === "image") return <FileImage className="h-5 w-5 text-[#25D366]" />;
  return <FileVideo className="h-5 w-5 text-[#FF8C42]" />;
}

function getFileExtension(file: File) {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_COURSEWARE_EXTENSIONS.find((extension) => lowerName.endsWith(extension)) ?? null;
}

function detectAssetType(file: File): CourseAssetType | null {
  const extension = getFileExtension(file);
  if (!extension) return null;

  const matchedEntry = Object.entries(EXTENSIONS_BY_TYPE).find(([, extensions]) =>
    extensions.includes(extension)
  );

  return (matchedEntry?.[0] as CourseAssetType | undefined) ?? null;
}

function AssetPreview({ asset }: { asset: CourseAsset }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (asset.type !== "image" && asset.type !== "video") {
      setUrl(null);
      return undefined;
    }

    getCourseAssetBlob(asset.id).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id, asset.type]);

  if (asset.type === "image") {
    return (
      <div className="h-16 w-24 overflow-hidden rounded-lg border border-[#E5EAF0] bg-[#F5F7F9]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-[#9CA8B5]" />
          </div>
        )}
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="h-20 w-32 overflow-hidden rounded-lg border border-[#E5EAF0] bg-black">
        {url ? (
          <video src={url} controls className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Video className="h-5 w-5 text-white/70" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-[#E5EAF0] bg-[#F5F7F9]">
      {getAssetIcon(asset.type)}
    </div>
  );
}

export function CourseResourceManager() {
  const searchParams = useSearchParams();
  const routeCourseId = searchParams.get("courseId");
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [newUploadCourseTitle, setNewUploadCourseTitle] = useState("");
  const [newUploadCourseDescription, setNewUploadCourseDescription] = useState("");
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const filteredCourses = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return courses;
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(value) ||
        course.description.toLowerCase().includes(value)
    );
  }, [courses, keyword]);

  async function refreshCourses(nextSelectedId?: string) {
    const rows = await listTeacherCourses();
    setCourses(rows);
    const availableSelected = nextSelectedId ?? selectedCourseId ?? routeCourseId;
    setSelectedCourseId(
      availableSelected && rows.some((course) => course.id === availableSelected)
        ? availableSelected
        : null
    );
  }

  useEffect(() => {
    let cancelled = false;

    listTeacherCourses()
      .then((rows) => {
        if (cancelled) return;
        setCourses(rows);
        setSelectedCourseId(rows.some((course) => course.id === routeCourseId) ? routeCourseId : null);
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage({
            type: "error",
            text: "浏览器课程资源库加载失败，请确认当前浏览器支持 IndexedDB。",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routeCourseId]);

  useEffect(() => {
    setTitle(selectedCourse?.title ?? "");
    setDescription(selectedCourse?.description ?? "");
  }, [selectedCourse]);

  async function handleCreateCourse() {
    setStatusMessage({ type: "info", text: "正在创建课程..." });
    try {
      const course = await createTeacherCourse({
        title: `新建课程 ${courses.length + 1}`,
        description: "用于学校现场演示的教师自建课程，可上传教学课件和课程资源。",
      });
      await refreshCourses(course.id);
      setStatusMessage({ type: "success", text: "课程已创建，可以继续编辑名称、简介并上传资源。" });
    } catch {
      setStatusMessage({ type: "error", text: "创建课程失败，请稍后重试。" });
    }
  }

  async function handleSaveCourse() {
    if (!selectedCourse) return;
    if (!title.trim()) {
      setStatusMessage({ type: "error", text: "请先填写课程名称。" });
      return;
    }

    setSaving(true);
    setStatusMessage({ type: "info", text: "正在保存课程信息..." });
    try {
      await updateTeacherCourse({
        id: selectedCourse.id,
        title,
        description,
      });
      await refreshCourses(selectedCourse.id);
      setStatusMessage({ type: "success", text: "课程名称和简介已保存。" });
    } catch {
      setStatusMessage({ type: "error", text: "保存课程失败，请稍后重试。" });
    } finally {
      setSaving(false);
    }
  }

  function openUploadDialog() {
    if (!selectedCourse && !newUploadCourseTitle.trim()) {
      setStatusMessage({ type: "error", text: "请先填写新课程名称。" });
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const assetType = detectAssetType(file);

    if (!assetType) {
      setStatusMessage({
        type: "error",
        text: `暂不支持该文件类型。支持格式：${ACCEPTED_COURSEWARE_EXTENSIONS.join("、")}`,
      });
      return;
    }

    setUploading(true);
    setStatusMessage({ type: "info", text: `正在上传 ${file.name} 到浏览器课程资源库...` });

    try {
      let targetCourseId = selectedCourse?.id ?? null;

      if (!targetCourseId) {
        const course = await createTeacherCourse({
          title: newUploadCourseTitle.trim(),
          description: newUploadCourseDescription.trim(),
        });
        targetCourseId = course.id;
      }

      if (!targetCourseId) {
        throw new Error("缺少课程目标");
      }

      await addCourseAsset({
        courseId: targetCourseId,
        type: assetType,
        file,
      });
      await refreshCourses(targetCourseId);
      setNewUploadCourseTitle("");
      setNewUploadCourseDescription("");
      window.dispatchEvent(new Event("course-assets-updated"));
      setStatusMessage({ type: "success", text: `${file.name} 上传成功，刷新页面后仍会保留。` });
    } catch {
      setStatusMessage({ type: "error", text: "上传失败，可能是浏览器存储空间不足。" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAsset(asset: CourseAsset) {
    if (!confirm(`确认删除资源「${asset.name}」？`)) return;
    setStatusMessage({ type: "info", text: "正在删除课程资源..." });
    try {
      await deleteCourseAsset(asset);
      await refreshCourses(asset.courseId);
      window.dispatchEvent(new Event("course-assets-updated"));
      setStatusMessage({ type: "success", text: "资源已删除。" });
    } catch {
      setStatusMessage({ type: "error", text: "删除资源失败，请稍后重试。" });
    }
  }

  return (
    <section id="course-resource-manager" className="scroll-mt-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={COURSEWARE_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#151E2B]">课程管理</h2>
          <p className="mt-1 text-xs text-[#7B8794]">
            Demo 阶段使用浏览器 IndexedDB 保存课程和资源文件，不接入后端、数据库或云存储。
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateCourse}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6]"
        >
          <Plus className="h-4 w-4" />
          新建课程
        </button>
      </div>

      {statusMessage && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            statusMessage.type === "success"
              ? "border-[#B7E8C9] bg-[#F0FFF5] text-[#167A3E]"
              : statusMessage.type === "error"
                ? "border-[#FFD7D4] bg-[#FFF1F0] text-[#D93026]"
                : "border-[#BBD8FF] bg-[#F0F7FF] text-[#1E62B8]"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-[#E5EAF0] bg-white">
          <div className="border-b border-[#E5EAF0] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索课程名称或简介"
                className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] py-2 pl-9 pr-3 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#7B8794]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载课程资源库...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-[#D0D7E0]" />
              <p className="text-sm font-medium text-[#151E2B]">暂无课程</p>
              <p className="mt-1 text-xs leading-5 text-[#7B8794]">
                点击“新建课程”，开始建设教学课件和课程资源。
              </p>
              <button
                type="button"
                onClick={handleCreateCourse}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6]"
              >
                <Plus className="h-4 w-4" />
                新建课程
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E5EAF0]">
              {filteredCourses.map((course) => {
                const active = course.id === selectedCourseId;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`block w-full px-4 py-4 text-left transition-colors ${
                      active ? "bg-[#F0F7FF]" : "hover:bg-[#F5F7F9]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          active ? "bg-[#2386FF] text-white" : "bg-[#EEF3F8] text-[#2386FF]"
                        }`}
                      >
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[#151E2B]">
                          {course.title}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7B8794]">
                          {course.description || "暂无课程简介"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#5B6B7B]">
                          <span className="rounded-full bg-white px-2 py-1">
                            课程资源 {course.resources.length}
                          </span>
                          <span>更新 {formatDate(course.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-5">
          {!selectedCourse ? (
            <div className="rounded-xl border border-dashed border-[#C9D6E2] bg-white p-12 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-[#D0D7E0]" />
              <p className="text-sm font-medium text-[#151E2B]">选择或新建课程后开始建设</p>
              <p className="mt-1 text-xs text-[#7B8794]">
                可上传 PPT、Word、图片和视频资源，并直接进入现有课堂播放页面。
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#E5EAF0] bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#151E2B]">编辑课程</h3>
                    <p className="mt-1 text-xs text-[#7B8794]">维护课程名称和简介，用于学校现场课程建设展示。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/course/player?courseId=${selectedCourse.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2386FF] px-3 py-2 text-sm font-medium text-[#2386FF] hover:bg-[#F0F7FF]"
                    >
                      <BookOpen className="h-4 w-4" />
                      进入课堂
                    </Link>
                    <button
                      type="button"
                      onClick={handleSaveCourse}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2386FF] px-3 py-2 text-sm font-medium text-white hover:bg-[#1E76E6] disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      保存课程
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                      课程名称
                    </label>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="例如：AI小车识人停靠实战"
                      className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                      课程状态
                    </label>
                    <div className="flex h-[38px] items-center gap-2 rounded-lg border border-[#D9E8FF] bg-[#F0F7FF] px-3 text-sm text-[#1E62B8]">
                      <Pencil className="h-4 w-4" />
                      平台自建课程 · 本地演示
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                    课程简介
                  </label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="说明课程目标、适用年级、课堂活动和教学资源用途"
                    className="w-full resize-none rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2 text-sm leading-6 text-[#151E2B] outline-none focus:border-[#2386FF]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E5EAF0] bg-white p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#151E2B]">上传课件</h3>
                    <p className="mt-1 text-xs text-[#7B8794]">
                      默认创建新课程；点击左侧已上传课程后，会继续上传到该课程。
                    </p>
                  </div>
                  <div className="rounded-full bg-[#F5F7F9] px-3 py-1 text-xs text-[#5B6B7B]">
                    {selectedCourse ? `上传到：${selectedCourse.title}` : "上传到：新课程"}
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-[#E5EAF0] bg-[#FBFCFE] p-4">
                  {selectedCourse ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#151E2B]">
                          继续上传到：{selectedCourse.title}
                        </div>
                        <p className="mt-1 text-xs text-[#7B8794]">
                          当前课程已有 {selectedCourse.resources.length} 个课程文件。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(null)}
                        className="rounded-lg border border-[#E5EAF0] bg-white px-3 py-2 text-sm text-[#5B6B7B] hover:border-[#2386FF] hover:text-[#2386FF]"
                      >
                        改为新课程
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                          新课程名称
                        </label>
                        <input
                          value={newUploadCourseTitle}
                          onChange={(event) => setNewUploadCourseTitle(event.target.value)}
                          placeholder="例如：K12 3D打印课程"
                          className="w-full rounded-lg border border-[#E5EAF0] bg-white px-3 py-2 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[#5B6B7B]">
                          课程简介
                        </label>
                        <input
                          value={newUploadCourseDescription}
                          onChange={(event) => setNewUploadCourseDescription(event.target.value)}
                          placeholder="可选，填写课程说明"
                          className="w-full rounded-lg border border-[#E5EAF0] bg-white px-3 py-2 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={openUploadDialog}
                  disabled={uploading}
                  className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[#BBD8FF] bg-[#F0F7FF] p-5 text-left transition-colors hover:border-[#2386FF] hover:bg-[#E8F2FF] disabled:opacity-60"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-[#2386FF] shadow-sm">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-[#151E2B]">
                      {uploading ? "正在上传课件..." : "上传课件"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#5B6B7B]">
                      支持 {ACCEPTED_COURSEWARE_EXTENSIONS.join("、")}，上传后会自动识别为课件、文档、图片或视频。
                    </div>
                  </div>
                </button>
              </div>

              <div className="rounded-xl border border-[#E5EAF0] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5EAF0] px-6 py-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#151E2B]">已上传课程资源</h3>
                    <p className="mt-1 text-xs text-[#7B8794]">
                      展示文件信息、上传状态和所属课程；课件和文档暂不做在线编辑。
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FFF5] px-3 py-1 text-xs text-[#167A3E]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    上传成功后本地持久保存
                  </div>
                </div>

                {selectedCourse.resources.length === 0 ? (
                  <div className="p-10 text-center">
                    <Upload className="mx-auto mb-3 h-12 w-12 text-[#D0D7E0]" />
                    <p className="text-sm font-medium text-[#151E2B]">暂无课程资源</p>
                    <p className="mt-1 text-xs text-[#7B8794]">
                      上传 PPT、Word、图片或视频后，会在这里显示资源列表和预览。
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5EAF0]">
                    {selectedCourse.resources.map((asset) => (
                      <div key={asset.id} className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center">
                        <AssetPreview asset={asset} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {getAssetIcon(asset.type)}
                            <p className="truncate text-sm font-semibold text-[#151E2B]">
                              {asset.name}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7B8794]">
                            <span>文件类型：{ASSET_TYPE_LABEL[asset.type]}</span>
                            <span>大小：{formatSize(asset.size)}</span>
                            <span>上传时间：{formatDate(asset.createdAt)}</span>
                            <span>所属课程：{selectedCourse.title}</span>
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F0FFF5] px-2 py-1 text-[11px] text-[#167A3E]">
                            <CheckCircle2 className="h-3 w-3" />
                            上传成功
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(asset)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#FFD7D4] px-3 py-2 text-sm text-[#D93026] hover:bg-[#FFF1F0]"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
