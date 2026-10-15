"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getFormalClassCourseProgress, listFormalClassCourses, type FormalClassCourseSummary } from "@/lib/courses/formal-course-api";
import { LEARNING_STATUS_LABELS, type ClassCourseLearningProgress } from "@/lib/courses/learning-progress";

export default function ClassLearningProgress({ classId }: { classId: string }) {
  const [courses, setCourses] = useState<FormalClassCourseSummary[]>([]);
  const [courseId, setCourseId] = useState("");
  const [report, setReport] = useState<ClassCourseLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    listFormalClassCourses(classId).then((items) => {
      if (cancelled) return;
      setCourses(items);
      setCourseId((current) => items.some((item) => item.course.id === current) ? current : items[0]?.course.id ?? "");
    }).catch((loadError) => {
      if (!cancelled) { setCourses([]); setCourseId(""); setError(loadError instanceof Error ? loadError.message : "课程加载失败"); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, retry]);

  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    setReport(null);
    setLoading(true);
    setError(null);
    getFormalClassCourseProgress(classId, courseId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setReport(data);
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "学习情况加载失败");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [classId, courseId, retry]);

  return (
    <section aria-label="班级学习情况" className="min-w-0 border-t pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">学习情况</h3>
        <button type="button" aria-label="刷新学习情况" title="刷新学习情况" onClick={() => setRetry((value) => value + 1)} className="rounded-md border p-2"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {courses.length > 0 && <select aria-label="查看课程学习情况" value={courseId} onChange={(event) => setCourseId(event.target.value)} className="mb-4 w-full max-w-full rounded-md border bg-white px-3 py-2 text-sm">{courses.map((item) => <option key={item.course.id} value={item.course.id}>{item.course.title}</option>)}</select>}
      {error ? <div role="alert" className="text-sm text-red-700">{error}<button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-3 underline">重试加载学习情况</button></div> : loading ? <p role="status" className="text-sm text-gray-500">正在加载学习情况...</p> : !courses.length ? <p className="text-sm text-gray-500">此班级暂无已发布课程。</p> : report?.students.length === 0 ? <p className="text-sm text-gray-500">此班级暂无已加入学生。</p> : report && report.courseId === courseId ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">{report.courseTitle}学生学习情况</caption>
            <thead><tr className="border-b text-xs text-gray-500"><th className="p-2">学生</th><th className="p-2">完成章节</th><th className="p-2">课程进度</th><th className="p-2">最近学习</th></tr></thead>
            <tbody>{report.students.map((student) => <tr key={student.userId} className="border-b"><td className="max-w-48 break-words p-2">{student.name}<span className="block text-xs text-gray-500">{student.username}</span></td><td className="p-2">{student.completedLessons}/{student.totalLessons}</td><td className="p-2">{student.percent}%<span className="block text-xs text-gray-500">{LEARNING_STATUS_LABELS[student.status]}</span></td><td className="p-2 text-xs">{student.lastStudiedAt ? new Date(student.lastStudiedAt).toLocaleString("zh-CN") : "尚未学习"}</td></tr>)}</tbody>
          </table>
          {report.totalLessons === 0 && <p className="mt-2 text-xs text-gray-500">该课程暂无章节，不计为已完成。</p>}
        </div>
      ) : null}
    </section>
  );
}
