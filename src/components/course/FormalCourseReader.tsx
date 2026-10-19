"use client";

import { useEffect, useState } from "react";
import { getFormalCourse, listFormalLessons } from "@/lib/courses/formal-course-api";
import { toPlayerLesson } from "@/lib/courses/course-player-lesson";
import { subscribeFormalCourses } from "@/lib/courses/course-refresh";
import type { CourseLesson } from "@/lib/course/types";
import CoursePlayer from "./CoursePlayer";
import { FormalCourseMaterials } from "./FormalCourseMaterials";

export function FormalCourseReader({ courseId, preview }: { courseId: string; preview: boolean }) {
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setLesson(null);
    Promise.all([getFormalCourse(courseId, controller.signal), listFormalLessons(courseId, controller.signal)])
      .then(([course, lessons]) => { if (!controller.signal.aborted) setLesson(toPlayerLesson(course, lessons)); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "课程读取失败，请重试。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, revision]);
  useEffect(() => subscribeFormalCourses(() => setRevision((value) => value + 1)), []);
  if (loading) return <p role="status" className="p-6 text-sm text-gray-600">正在读取正式课程...</p>;
  if (error) return <div role="alert" className="p-6 text-sm text-red-700">课程读取失败：{error}<button onClick={() => setRevision((value) => value + 1)} className="ml-3 underline">重试读取课程</button></div>;
  if (!lesson?.scenes.length) return <div className="p-6"><p className="text-sm text-gray-600">该课程尚未添加章节，附件不计入章节学习进度。</p><FormalCourseMaterials key={courseId} courseId={courseId} /></div>;
  return <CoursePlayer key={`${courseId}:${revision}`} lesson={lesson} formal preview={preview} />;
}
