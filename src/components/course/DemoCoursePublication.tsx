"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { DEMO_USERS, type SessionInfo } from "@/lib/auth/client";
import { readClassState, subscribeClassStore } from "@/lib/classes/demo-class-store";
import { confirmDemoCourseOwnership, publishDemoCourse, type TeacherCourse } from "@/lib/course/teacher-course-store";
import { courseScopeLabel, courseStatusLabel } from "@/lib/courses/publication";

export function DemoCoursePublication({ course, session, onSaved }: { course: TeacherCourse; session: SessionInfo; onSaved: () => Promise<void> }) {
  const [classes, setClasses] = useState<ReturnType<typeof readClassState>["classes"]>([]);
  const [classId, setClassId] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setClasses(readClassState().classes.filter((item) => item.teacherId === course.creatorId));
    refresh();
    return subscribeClassStore(refresh);
  }, [course.creatorId]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); await onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-lg border bg-white p-5">
    <h3 className="text-sm font-semibold">课程归属与发布</h3>
    <p className="text-sm">创建者：{course.creatorName ?? "待确认归属"}</p>
    <p className="text-xs text-gray-600">{courseStatusLabel(course.status, course.publicationScope)} · {courseScopeLabel(course.publicationScope)}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!course.creatorId || !course.creatorRole ? <>
      <p className="text-sm text-amber-700">旧课程未记录创建者，未自动归属或公开。确认后仍为草稿，需另外发布。</p>
      {session.role === "admin" && <form onSubmit={(event) => { event.preventDefault(); if (confirm("确认该旧课程的实际创建者？确认本身不会公开课程。")) void run(() => confirmDemoCourseOwnership(course.id, creatorId, session)); }} className="flex flex-wrap gap-3">
        <select aria-label="旧课程创建者" required value={creatorId} onChange={(event) => setCreatorId(event.target.value)} className="min-w-0 rounded border p-2 text-sm">
          <option value="">请选择实际创建者</option>
          {DEMO_USERS.filter((item) => item.session.role !== "student").map((item) => <option key={item.session.id} value={item.session.id}>{item.session.name} · {item.session.role === "admin" ? "公共课程（发布后）" : "班级专属（发布后）"}</option>)}
        </select>
        <button disabled={busy} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">确认旧课程归属</button>
      </form>}
    </> : course.creatorRole === "admin" ? <button disabled={busy} onClick={() => void run(() => publishDemoCourse(course.id, course.status !== "published", undefined, session))} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
      <Send className="h-4 w-4" />{course.status === "published" ? "取消公共发布" : "发布为公共课程"}
    </button> : <>
      <form onSubmit={(event) => { event.preventDefault(); void run(() => publishDemoCourse(course.id, true, classId, session)); }} className="flex flex-wrap gap-3">
        <select aria-label="发布班级" required value={classId} onChange={(event) => setClassId(event.target.value)} className="min-w-0 max-w-full rounded border p-2 text-sm"><option value="">选择教师自己的班级</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select>
        <button disabled={busy || !classId} className="inline-flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"><Send className="h-4 w-4" />发布到班级</button>
      </form>
      {!classes.length && <p className="text-xs text-gray-500">尚无可发布班级，请先创建班级。</p>}
      <ul className="space-y-2 text-sm">{course.classIds?.map((id) => <li key={id} className="flex flex-wrap justify-between gap-2"><span>{classes.find((item) => item.id === id)?.name ?? id}</span><button disabled={busy} onClick={() => void run(() => publishDemoCourse(course.id, false, id, session))} className="text-red-600">取消班级发布</button></li>)}</ul>
    </>}
    <p className="text-xs text-gray-500">Demo 数据仅在同一浏览器中共享，不连接正式数据库；班级课程仅供已批准加入的学生。</p>
  </section>;
}
