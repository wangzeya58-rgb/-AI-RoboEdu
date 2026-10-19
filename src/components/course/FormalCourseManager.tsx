"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Layers3, Loader2, Pencil, Plus, Send, Users } from "lucide-react";
import { courseScopeLabel, courseStatusLabel } from "@/lib/courses/publication";
import { subscribeFormalCourses } from "@/lib/courses/course-refresh";
import { FormalCourseMaterials } from "./FormalCourseMaterials";
import {
  FormalClassApiError,
  listFormalClasses,
  type FormalClassSummary,
} from "@/lib/classes/formal-class-api";
import {
  createFormalCourse,
  createFormalLesson,
  FormalCourseApiError,
  listFormalCourses,
  listFormalLessons,
  publishFormalCourseToClass,
  updateFormalLesson,
  updateFormalCourse,
  deleteFormalCourse,
  publishFormalPublicCourse,
  unpublishFormalCourseFromClass,
  confirmFormalCourseOwnership,
  type FormalCourseSummary,
  type FormalLessonSummary,
} from "@/lib/courses/formal-course-api";

type Message = { type: "success" | "error" | "info"; text: string } | null;

function formatError(error: unknown, fallback: string): string {
  if (error instanceof FormalCourseApiError || error instanceof FormalClassApiError) {
    if (error.status === 401) return "登录已过期，请重新登录后再试。";
    if (error.status === 403) return "当前账号无权执行该操作。";
    if (error.status === 400) return error.message || "输入内容不合法。";
    if (error.status === 404) return "课程或班级不存在。";
    if (error.status === 409) return error.message || "课程已发布到该班级。";
    return error.message || fallback;
  }
  return fallback;
}

export function FormalCourseManager({ isAdmin = false, initialCourseId = null, newCourse = false }: {
  isAdmin?: boolean; initialCourseId?: string | null; newCourse?: boolean;
}) {
  const [courses, setCourses] = useState<FormalCourseSummary[]>([]);
  const [classes, setClasses] = useState<FormalClassSummary[]>([]);
  const [lessons, setLessons] = useState<FormalLessonSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [publishClassId, setPublishClassId] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [loadedCourseId, setLoadedCourseId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [legacyCreatorId, setLegacyCreatorId] = useState("");
  const createRef = useRef(false);
  const refreshSequence = useRef(0);
  const selectedCourseRef = useRef(selectedCourseId);
  const lessonSaveRef = useRef(false);

  useEffect(() => {
    selectedCourseRef.current = selectedCourseId;
  }, [selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  useEffect(() => {
    setEditTitle(selectedCourse?.title ?? "");
    setEditDescription(selectedCourse?.description ?? "");
    setPublishClassId("");
    setLegacyCreatorId("");
  }, [selectedCourse?.id, selectedCourse?.title, selectedCourse?.description]);

  const refreshCourses = useCallback(async (nextSelectedId?: string) => {
    if (nextSelectedId) { selectedCourseRef.current = nextSelectedId; setSelectedCourseId(nextSelectedId); }
    const sequence = ++refreshSequence.current;
    setLoadingCourses(true);
    try {
      const [nextCourses, nextClasses] = await Promise.all([
        listFormalCourses(),
        listFormalClasses(),
      ]);
      if (sequence !== refreshSequence.current) return false;
      setCourses(nextCourses);
      setClasses(nextClasses);
      const missingInitial = initialCourseId && !nextSelectedId && !nextCourses.some((course) => course.id === initialCourseId);
      if (missingInitial) setMessage({ type: "error", text: "课程不存在或无权访问。" });
      setSelectedCourseId((current) => {
        const selected = nextSelectedId ?? selectedCourseRef.current ?? current ?? initialCourseId;
        if (initialCourseId && !nextSelectedId && !current && !nextCourses.some((course) => course.id === initialCourseId)) {
          return null;
        }
        return selected && nextCourses.some((course) => course.id === selected)
          ? selected
          : nextCourses[0]?.id ?? null;
      });
      return true;
    } catch (error) {
      if (sequence === refreshSequence.current) setMessage({ type: "error", text: formatError(error, "课程列表加载失败，请稍后重试。") });
      return false;
    } finally {
      if (sequence === refreshSequence.current) setLoadingCourses(false);
    }
  }, [initialCourseId]);

  useEffect(() => {
    void refreshCourses();
    const refresh = () => { void refreshCourses(); };
    const unsubscribe = subscribeFormalCourses(refresh);
    window.addEventListener("focus", refresh);
    const invalidate = () => { ++refreshSequence.current; };
    return () => { invalidate(); unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [refreshCourses]);

  useEffect(() => {
    setEditingLessonId(null);
    setLessonTitle("");
    setLessonContent("");
    setLoadedCourseId(null);
    if (!selectedCourseId) {
      setLessons([]);
      return;
    }

    let cancelled = false;
    setLessons([]);
    setLoadingLessons(true);
    listFormalLessons(selectedCourseId)
      .then((items) => {
        if (!cancelled) {
          setLessons(items);
          setLoadedCourseId(selectedCourseId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLessons([]);
          setMessage({ type: "error", text: formatError(error, "章节加载失败，请稍后重试。") });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createRef.current) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setMessage({ type: "error", text: "请填写课程名称。" });
      return;
    }

    createRef.current = true;
    setSavingCourse(true);
    setMessage({ type: "info", text: "正在创建课程..." });
    try {
      const created = await createFormalCourse({
        title: nextTitle,
        description: description.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      if (await refreshCourses(created.id)) setMessage({ type: "success", text: `已创建课程：${created.title}` });
    } catch (error) {
      setMessage({ type: "error", text: formatError(error, "创建课程失败，请稍后重试。") });
    } finally {
      createRef.current = false;
      setSavingCourse(false);
    }
  }

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourse || savingDetails) return;
    setSavingDetails(true);
    try {
      await updateFormalCourse(selectedCourse.id, { title: editTitle, description: editDescription });
      if (await refreshCourses(selectedCourse.id)) setMessage({ type: "success", text: "课程信息已保存。" });
    } catch (error) {
      setMessage({ type: "error", text: formatError(error, "保存课程失败。") });
    } finally { setSavingDetails(false); }
  }

  async function handleDeleteCourse() {
    if (!selectedCourse || savingDetails || !confirm(`确认删除「${selectedCourse.title}」？相关章节、班级关联和学习进度也会删除，无法恢复。`)) return;
    setSavingDetails(true);
    try {
      await deleteFormalCourse(selectedCourse.id);
      setSelectedCourseId(null);
      setLessons([]);
      if (await refreshCourses()) setMessage({ type: "success", text: "课程已删除。" });
    } catch (error) {
      setMessage({ type: "error", text: formatError(error, "删除课程失败。") });
    } finally { setSavingDetails(false); }
  }

  async function handleAddLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId || loadedCourseId !== selectedCourseId || lessonSaveRef.current) return;
    const courseId = selectedCourseId;
    const lessonId = editingLessonId;
    const nextTitle = lessonTitle.trim();
    const nextContent = lessonContent.trim();
    if (!nextTitle || !nextContent) {
      setMessage({ type: "error", text: "请填写章节标题和内容。" });
      return;
    }

    lessonSaveRef.current = true;
    setSavingLesson(true);
    setMessage({ type: "info", text: lessonId ? "正在保存章节..." : "正在添加章节..." });
    try {
      if (lessonId) await updateFormalLesson(courseId, lessonId, { title: nextTitle, content: nextContent });
      else await createFormalLesson(courseId, {
        title: nextTitle, content: nextContent,
        order: Math.max(0, ...lessons.map((lesson) => lesson.order)) + 1,
      });
      const items = await listFormalLessons(courseId);
      if (selectedCourseRef.current === courseId) {
        setLessonTitle("");
        setLessonContent("");
        setEditingLessonId(null);
        setLessons(items);
        setMessage({ type: "success", text: lessonId ? "章节已保存。" : "章节已添加。" });
      }
    } catch (error) {
      if (selectedCourseRef.current === courseId) setMessage({ type: "error", text: formatError(error, "保存章节失败，请稍后重试。") });
    } finally {
      lessonSaveRef.current = false;
      setSavingLesson(false);
    }
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCourseId || !publishClassId || publishing) return;

    setPublishing(true);
    setMessage({ type: "info", text: "正在发布课程到班级..." });
    try {
      await publishFormalCourseToClass(selectedCourseId, publishClassId);
      if (await refreshCourses(selectedCourseId)) setMessage({ type: "success", text: "课程已发布到班级。" });
    } catch (error) {
      setMessage({ type: "error", text: formatError(error, "发布课程失败，请稍后重试。") });
    } finally {
      setPublishing(false);
    }
  }

  async function changePublication(action: () => Promise<unknown>, success: string) {
    if (publishing || !selectedCourseId) return;
    setPublishing(true);
    setMessage(null);
    try {
      await action();
      if (await refreshCourses(selectedCourseId)) setMessage({ type: "success", text: success });
    } catch (error) {
      setMessage({ type: "error", text: formatError(error, "发布状态更新失败，请重试。") });
    } finally { setPublishing(false); }
  }

  return (
    <section className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <div className="rounded-xl border border-[#E5EAF0] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#151E2B]">{isAdmin ? "全部正式课程" : "我的课程"}</h2>
            <p className="mt-1 text-xs text-[#7B8794]">
              {isAdmin ? "管理全平台正式课程；自主创建的课程记录当前管理员为创建者。" : "正式课程可直接发布到自己的班级，无需管理员审核。"}
            </p>
          </div>
          <div className="rounded-lg bg-[#F5F7F9] px-3 py-2 text-xs text-[#5B6B7B]">
            课程 {courses.length} · 班级 {classes.length}
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-[#B7E8C9] bg-[#F0FFF5] text-[#167A3E]"
                : message.type === "error"
                  ? "border-[#FFD7D4] bg-[#FFF1F0] text-[#D93026]"
                  : "border-[#BBD8FF] bg-[#F0F7FF] text-[#1E62B8]"
            }`}
          >
            {message.text}
          </div>
        )}

        <h3 className="mb-3 text-sm font-semibold">新建课程</h3>
        <p className="mb-3 text-xs text-[#7B8794]">创建课程后可添加章节正文与课件附件。</p>
        <form onSubmit={handleCreateCourse} className="grid gap-3 lg:grid-cols-[1fr_1.4fr_auto]">
          <input
            autoFocus={newCourse}
            aria-label="课程名称"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="课程名称"
            className="min-w-0 rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
          />
          <input
            aria-label="课程简介"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="课程简介（可选）"
            className="min-w-0 rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
          />
          <button
            type="submit"
            disabled={savingCourse || savingDetails}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2386FF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E76E6] disabled:cursor-not-allowed disabled:bg-[#9CCBFF]"
          >
            <Plus className="h-4 w-4" />
            {savingCourse ? "创建中" : "创建课程"}
          </button>
        </form>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-[#E5EAF0] bg-white">
          <div className="border-b border-[#E5EAF0] p-4">
            <h3 className="text-sm font-semibold text-[#151E2B]">课程列表</h3>
            <button type="button" disabled={loadingCourses || savingCourse || savingDetails} onClick={() => void refreshCourses()} className="mt-2 text-xs text-blue-600">刷新列表 / 重试</button>
          </div>
          {loadingCourses ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#7B8794]">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载课程...
            </div>
          ) : courses.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#7B8794]">暂无课程。</div>
          ) : (
            <div className="divide-y divide-[#E5EAF0]">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  disabled={savingLesson || publishing || savingDetails || savingCourse}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`w-full p-4 text-left transition ${
                    selectedCourseId === course.id ? "bg-[#F0F7FF]" : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF3FF] text-[#2386FF]">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#151E2B]">{course.title}</div>
                      <div className="mt-1 text-xs text-[#7B8794]">{courseStatusLabel(course.status, course.publicationScope)}</div>
                      <div className="mt-1 text-xs text-[#7B8794]">{courseScopeLabel(course.publicationScope)}</div>
                      {isAdmin && <div className="mt-1 break-all text-xs text-[#7B8794]">创建者：{course.creatorName ?? course.creatorId ?? course.teacherId}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[#E5EAF0] bg-white p-5">
          {!selectedCourse ? (
            <div className="rounded-lg bg-[#F5F7F9] px-4 py-8 text-center text-sm text-[#7B8794]">
              请选择或创建一个课程。
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#151E2B]">{selectedCourse.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5B6B7B]">
                      {selectedCourse.description || "暂无课程简介。"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#B7E8C9] bg-[#F0FFF5] px-2.5 py-1 text-xs text-[#167A3E]">
                    <CheckCircle2 className="h-4 w-4" />
                    {courseStatusLabel(selectedCourse.status, selectedCourse.publicationScope)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{courseScopeLabel(selectedCourse.publicationScope)} · 创建者：{selectedCourse.creatorName ?? selectedCourse.creatorId ?? selectedCourse.teacherId}</p>
              {!selectedCourse.creatorRole && <div className="space-y-3 border border-amber-200 bg-amber-50 p-4 text-sm">
                <p>归属待确认。保留旧访问范围，不会自动公开；确认归属本身不会发布课程。</p>
                {isAdmin && <form onSubmit={(event) => { event.preventDefault(); void changePublication(() => confirmFormalCourseOwnership(selectedCourse.id, legacyCreatorId), "已确认归属，原访问范围未变。"); }}>
                  <label>正式创建者用户 ID<input required aria-label="正式创建者用户 ID" className="my-2 w-full rounded border p-2" value={legacyCreatorId} onChange={(event) => setLegacyCreatorId(event.target.value)} /></label>
                  <button disabled={publishing} className="rounded bg-blue-600 px-3 py-2 text-white">确认旧课程归属</button>
                </form>}
              </div>}

              <form onSubmit={handleSaveDetails} className="space-y-3 border-b pb-4">
                <label className="block text-sm">课程名称<input aria-label="编辑课程名称" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-1 w-full rounded-lg border p-2" required /></label>
                <label className="block text-sm">课程简介<textarea aria-label="编辑课程简介" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
                <button disabled={savingDetails || savingLesson || publishing} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{savingDetails ? "处理中..." : "保存课程信息"}</button>
                <button type="button" onClick={() => void handleDeleteCourse()} disabled={savingDetails || savingLesson || publishing} className="ml-4 text-sm text-red-600 disabled:opacity-50">删除课程</button>
              </form>

              <FormalCourseMaterials key={selectedCourse.id} courseId={selectedCourse.id} manage />
              <form onSubmit={handleAddLesson} className="rounded-lg border border-[#E5EAF0] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#151E2B]">
                  <Layers3 className="h-4 w-4 text-[#2386FF]" />
                  {editingLessonId ? "编辑章节" : "添加章节"}
                </div>
                <div className="space-y-3">
                  <input
                    value={lessonTitle}
                    onChange={(event) => setLessonTitle(event.target.value)}
                    placeholder="章节标题"
                    className="w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                  />
                  <textarea
                    value={lessonContent}
                    onChange={(event) => setLessonContent(event.target.value)}
                    placeholder="章节内容"
                    rows={4}
                    className="w-full resize-none rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF]"
                  />
                  <button
                    type="submit"
                    disabled={savingLesson || savingDetails || loadedCourseId !== selectedCourseId}
                    className="rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E76E6] disabled:cursor-not-allowed disabled:bg-[#9CCBFF]"
                  >
                    {savingLesson ? "保存中" : editingLessonId ? "保存章节" : "添加章节"}
                  </button>
                  {editingLessonId && (
                    <button type="button" disabled={savingLesson} onClick={() => { setEditingLessonId(null); setLessonTitle(""); setLessonContent(""); }} className="ml-3 text-sm text-[#5B6B7B]">取消编辑</button>
                  )}
                </div>
              </form>

              <div className="rounded-lg border border-[#E5EAF0] p-4">
                <div className="mb-3 text-sm font-semibold text-[#151E2B]">章节列表</div>
                {loadingLessons ? (
                  <div className="text-sm text-[#7B8794]">正在加载章节...</div>
                ) : lessons.length === 0 ? (
                  <div className="rounded-lg bg-[#F5F7F9] px-4 py-3 text-sm text-[#7B8794]">
                    暂无章节。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessons.map((lesson) => (
                      <div key={lesson.id} className="rounded-lg bg-[#F8FAFC] px-4 py-3">
                        <div className="text-sm font-medium text-[#151E2B]">
                          {lesson.order}. {lesson.title}
                        </div>
                        <button type="button" disabled={savingLesson} onClick={() => { setEditingLessonId(lesson.id); setLessonTitle(lesson.title); setLessonContent(lesson.content); }} className="mt-2 inline-flex items-center gap-1 text-xs text-[#2386FF]" aria-label={`编辑章节：${lesson.title}`}>
                          <Pencil className="h-3.5 w-3.5" />编辑
                        </button>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#5B6B7B]">
                          {lesson.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedCourse.creatorRole === "admin" ? <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">公共课程发布</h3>
                <p className="text-xs text-gray-500">发布后所有正式学生无需加入班级即可学习；取消发布后停止访问。</p>
                <button disabled={publishing || savingDetails || savingLesson} onClick={() => void changePublication(() => publishFormalPublicCourse(selectedCourse.id, selectedCourse.status !== "published" || selectedCourse.publicationScope !== "public"), selectedCourse.status === "published" && selectedCourse.publicationScope === "public" ? "已取消公共发布。" : "已发布为公共课程。")}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"><Send className="h-4 w-4" />{selectedCourse.status === "published" && selectedCourse.publicationScope === "public" ? "取消公共发布" : "发布为公共课程"}</button>
              </div> : selectedCourse.creatorRole === "teacher" ? <form onSubmit={handlePublish} className="rounded-lg border border-[#E5EAF0] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#151E2B]">
                  <Send className="h-4 w-4 text-[#2386FF]" />
                  发布到班级
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={publishClassId}
                    onChange={(event) => setPublishClassId(event.target.value)}
                    className="w-full min-w-0 max-w-full rounded-lg border border-[#E5EAF0] bg-[#F5F7F9] px-3 py-2.5 text-sm text-[#151E2B] outline-none focus:border-[#2386FF] sm:w-auto sm:min-w-64"
                  >
                    <option value="">选择班级</option>
                    {classes.filter((item) => item.teacherId === selectedCourse.teacherId).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.classCode}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!publishClassId || publishing || savingDetails}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#20BE5B] disabled:cursor-not-allowed disabled:bg-[#9DDDB2]"
                  >
                    <Users className="h-4 w-4" />
                    {publishing ? "发布中" : "发布课程"}
                  </button>
                </div>
                <ul className="mt-4 space-y-2 text-sm">{selectedCourse.classIds?.map((id) => <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{classes.find((item) => item.id === id)?.name ?? "原已发布班级"}</span>
                  <button type="button" disabled={publishing} className="text-red-600 disabled:opacity-50" onClick={() => void changePublication(() => unpublishFormalCourseFromClass(selectedCourse.id, id), "已取消该班级发布。")}>取消班级发布</button>
                </li>)}</ul>
              </form> : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
