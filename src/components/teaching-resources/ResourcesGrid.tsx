"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, BookOpen, ChevronRight, FileText, GraduationCap, ImageIcon, Loader2, RefreshCw, Video } from "lucide-react";
import { useCurrentSession } from "@/lib/auth/use-current-session";
import type { SessionInfo } from "@/lib/auth/client";
import { getCourseAssetBlob, type CourseAsset } from "@/lib/course/teacher-course-store";
import { useCourseCatalog } from "@/lib/courses/use-course-catalog";
import { courseScopeLabel, courseStatusLabel } from "@/lib/courses/publication";

const builtIns = [
  { id: "ai-car-face-docking-01", title: "AI小车认识与识人停靠", icon: GraduationCap, href: "/course/player?courseId=ai-car-face-docking-01" },
  { id: "video", title: "智能小车入门教程", icon: Video },
  { id: "python", title: "Python编程基础手册", icon: FileText },
  { id: "manual", title: "RoboMaster实训手册", icon: BookOpen },
  { id: "examples", title: "代码示例素材包", icon: ImageIcon },
];

function UploadedAssetPreview({ asset, session }: { asset: CourseAsset; session: SessionInfo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setUrl(null); setFailed(false);
    if (asset.type !== "image" && asset.type !== "video") return;
    getCourseAssetBlob(asset.id, session).then((blob) => {
      if (!active) return;
      if (!blob) throw new Error("文件数据不存在");
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset.id, asset.type, session]);
  if (failed) return <span className="text-xs text-red-700">预览读取失败</span>;
  // eslint-disable-next-line @next/next/no-img-element
  if (asset.type === "image" && url) return <img src={url} alt={asset.name} className="h-full w-full object-cover" />;
  if (asset.type === "video" && url) return <video src={url} muted preload="metadata" className="h-full w-full object-cover" />;
  return <FileText className="h-6 w-6 text-blue-600" />;
}

export default function TeachingResourcesGrid() {
  const { session, ready, error: sessionError, retry: retrySession } = useCurrentSession();
  const { items, loading, error, retry } = useCourseCatalog(session, ready);
  const failure = sessionError || error;
  return <div className="space-y-8">
    <section aria-label="上传与正式课程" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">课程与上传课件</h2>
        <button type="button" title="刷新课程" aria-label="刷新课程" onClick={() => { if (sessionError) retrySession(); else retry(); }} disabled={loading} className="rounded p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {failure && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="flex items-start gap-2"><AlertCircle className="h-4 w-4 shrink-0" />课程读取失败：{failure}</p>
        <p>当前列表可能不是最新数据。下方内置示例不是上传课程的替代数据。</p>
        <button onClick={() => { if (sessionError) retrySession(); else retry(); }} className="font-medium underline">重试读取课程</button>
      </div>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />正在读取课程...</p>}
      {ready && !session && !failure && <p className="text-sm text-gray-600"><Link href="/login?next=/teaching-resources" className="text-blue-600">登录</Link>后查看有权限的课程与上传课件。</p>}
      {!loading && !failure && session && items.length === 0 && <p className="text-sm text-gray-600">暂无可访问课程。旧课程待管理员确认归属；草稿仅创建者和管理员可见。</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((course) => {
          const preview = course.resources?.find((asset) => asset.type === "image" || asset.type === "video");
          const unknown = !course.creatorId || !course.creatorRole;
          return <Link key={course.id} data-course-id={course.id} href={course.href} className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
            <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-gray-50">
              {preview && session ? <UploadedAssetPreview asset={preview} session={session} /> : <GraduationCap className="h-8 w-8 text-blue-600" />}
            </div>
            <h3 className="break-words text-sm font-semibold text-gray-900">{course.title}</h3>
            <p className="text-xs text-gray-500">来源：{course.source === "demo" ? "Demo 本地课程" : "正式数据库课程"}</p>
            <p className={`text-xs ${unknown ? "text-amber-700" : "text-gray-600"}`}>{unknown ? "待确认归属" : `创建者：${course.creatorName || course.creatorId}`}</p>
            <p className="text-xs text-gray-600">{courseStatusLabel(course.status)} · {courseScopeLabel(course.publicationScope)}</p>
            <p className="text-xs text-gray-500">{course.resources ? `${course.resources.length} 个课程文件` : "章节课程正文"}</p>
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600">{course.canManage ? unknown ? "确认归属与查看课件" : "管理课程与课件" : "进入课程"}<ChevronRight className="h-3 w-3" /></span>
          </Link>;
        })}
      </div>
    </section>
    <section aria-label="内置示例课程" className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">内置示例课程与素材</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {builtIns.map(({ id, title, icon: Icon, href }) => {
          const content = <><Icon className="mb-3 h-6 w-6 text-blue-600" /><h3 className="break-words text-sm font-medium text-gray-900">{title}</h3><p className="my-3 text-xs text-gray-500">来源：项目内置示例</p><span className="text-xs text-blue-600">{href ? "进入课程" : "示例资源 · 尚未开放"}</span></>;
          return href ? <Link key={id} href={href} className="rounded-lg border border-gray-200 bg-white p-4">{content}</Link> : <div key={id} className="rounded-lg border border-gray-200 bg-white p-4">{content}</div>;
        })}
      </div>
    </section>
  </div>;
}
