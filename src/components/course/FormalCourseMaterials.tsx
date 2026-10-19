"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, RefreshCw, Trash2, Upload } from "lucide-react";
import { deleteFormalMaterial, FormalCourseApiError, listFormalMaterials, uploadFormalMaterial } from "@/lib/courses/formal-course-api";
import { COURSE_MATERIAL_ACCEPT, type FormalCourseMaterial } from "@/lib/courses/material-types";
import { subscribeFormalCourses } from "@/lib/courses/course-refresh";

export function FormalCourseMaterials({ courseId, manage = false }: { courseId: string; manage?: boolean }) {
  const [items, setItems] = useState<FormalCourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<FormalCourseMaterial | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(false);
  const identity = useRef(courseId);
  identity.current = courseId;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]); setSelected(null);
    listFormalMaterials(courseId, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setItems(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "附件读取失败。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, revision]);
  useEffect(() => subscribeFormalCourses(() => setRevision((value) => value + 1)), []);

  async function mutate(action: () => Promise<unknown>) {
    if (operation.current) return;
    const original = courseId;
    operation.current = true; setBusy(true); setError("");
    try { await action(); if (identity.current === original) { if (input.current) input.current.value = ""; setRevision((value) => value + 1); } }
    catch (cause) {
      if (identity.current === original) {
        setError(cause instanceof Error ? cause.message : "附件操作失败，请重试。");
        if (cause instanceof FormalCourseApiError && cause.status === 401) window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
    } finally { operation.current = false; setBusy(false); }
  }

  return <section className="min-w-0 space-y-3 border-t pt-4" aria-label="正式课程附件">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">课程附件</h3>
      <button type="button" title="刷新附件" aria-label="刷新附件" disabled={busy || loading} onClick={() => setRevision((value) => value + 1)} className="p-2 disabled:opacity-40"><RefreshCw className="h-4 w-4" /></button>
    </div>
    <p className="text-xs text-gray-600">附件未自动解析为 AI 上下文；AI 答疑以章节正文为依据。Office 文件仅提供下载。</p>
    {manage && <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
      event.preventDefault(); const file = input.current?.files?.[0];
      if (!file) { setError("请先选择课件文件。"); return; }
      void mutate(() => uploadFormalMaterial(courseId, file, AbortSignal.timeout(120000)));
    }}>
      <input ref={input} type="file" aria-label="选择课程附件" accept={COURSE_MATERIAL_ACCEPT} disabled={busy} className="min-w-0 max-w-full text-sm" />
      <button disabled={busy} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-40"><Upload className="h-4 w-4" />{busy ? "处理中..." : "上传课件"}</button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}<button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-3 underline">重试读取附件</button></p>}
    {loading ? <p role="status" className="text-sm text-gray-500">正在读取附件...</p> : !error && items.length === 0 ? <p className="text-sm text-gray-500">暂无附件。</p> : null}
    <ul className="divide-y">
      {items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <span className="min-w-0 flex-1 break-all">{item.name} <span className="text-xs text-gray-500">({Math.ceil(item.size / 1024)} KB)</span></span>
        {!item.available ? <span className="text-xs text-amber-700">旧附件存储待核对，未自动迁移</span> : <>
          {item.preview && <button type="button" title="预览附件" aria-label={`预览 ${item.name}`} onClick={() => setSelected(item)} className="p-2"><Eye className="h-4 w-4" /></button>}
          <a title="下载附件" aria-label={`下载 ${item.name}`} href={item.downloadUrl} className="p-2"><Download className="h-4 w-4" /></a>
        </>}
        {manage && <button type="button" title="删除附件" aria-label={`删除 ${item.name}`} disabled={busy} onClick={() => { if (window.confirm(`删除附件「${item.name}」？此操作不可撤销。`)) void mutate(() => deleteFormalMaterial(courseId, item.id)); }} className="p-2 text-red-700 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
      </li>)}
    </ul>
    {selected && <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="break-all">{selected.name}</span><button type="button" onClick={() => setSelected(null)}>关闭预览</button></div>
      {selected.preview === "pdf" ? <object data={selected.contentUrl} type="application/pdf" className="h-[480px] w-full"><a href={selected.downloadUrl}>浏览器不支持 PDF 预览，请下载。</a></object>
        : selected.preview === "video" ? <video controls preload="metadata" src={selected.contentUrl} className="max-h-[480px] w-full" onError={() => setError("视频读取失败，请检查访问权限或下载后查看。更新浏览器以支持该编码。")} />
        : <img src={selected.contentUrl} alt={selected.name} className="max-h-[480px] max-w-full object-contain" onError={() => setError("图片读取失败，请重试或检查访问权限。")} />}
    </div>}
  </section>;
}
