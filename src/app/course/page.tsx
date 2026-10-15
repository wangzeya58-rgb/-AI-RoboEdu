"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Clock, Settings2, Target } from "lucide-react";
import Layout from "@/components/Layout";
import CoursePlayer from "@/components/course/CoursePlayer";
import type { CourseLesson } from "@/lib/course/types";
import { getSession, type SessionInfo } from "@/lib/auth/client";
import {
  FormalClassApiError,
  isDemoSessionId,
  listFormalStudentMemberships,
} from "@/lib/classes/formal-class-api";
import {
  FormalCourseApiError,
  listFormalClassCourses,
  listFormalLessons,
  listFormalCourseProgress,
  type FormalCourseSummary,
  type FormalLessonSummary,
} from "@/lib/courses/formal-course-api";
import { mockLessons } from "@/lib/course/lessons";
import { LEARNING_STATUS_LABELS, type CourseLearningProgress } from "@/lib/courses/learning-progress";

interface StudentCourseItem {
  course: FormalCourseSummary;
  classNames: string[];
}

export default function CoursePage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    setSession(getSession());
    setSessionReady(true);
  }, []);
  const useFormalStudentCourses = session?.role === "student" && !isDemoSessionId(session.id);

  if (!sessionReady) return (
    <Layout activeMenu="/course" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
      <p role="status" className="p-6 text-sm text-gray-500">正在读取登录状态...</p>
    </Layout>
  );

  if (useFormalStudentCourses) {
    return (
      <Layout activeMenu="/course" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
        <FormalStudentCourseCenter />
      </Layout>
    );
  }

  return (
    <Layout activeMenu="/course" className="max-md:[&>aside]:hidden [&>main]:min-w-0">
      <div className="p-6">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <BookOpen className="h-4 w-4" />
            AI Classroom MVP
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI RoboEdu 课程中心</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
                第一版课程系统使用本地课程数据，支持顺序播放、AI 老师讲解和课堂互动问题。机器人实验将在后续阶段接入。
              </p>
            </div>
            <Link
              href="/course/manage"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Settings2 className="h-4 w-4" />
              课程管理
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {mockLessons.map((lesson) => (
            <Link
              key={lesson.info.id}
              href={`/course/player?courseId=${lesson.info.id}`}
              className="group rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {lesson.info.level}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {lesson.info.durationMinutes} 分钟
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-950">{lesson.info.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">{lesson.info.subtitle}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Target className="h-4 w-4 text-[#25D366]" />
                  学习目标
                </div>
                <ul className="space-y-2">
                  {lesson.info.objectives.map((objective) => (
                    <li key={objective} className="text-sm leading-6 text-gray-600">
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function FormalStudentCourseCenter() {
  const [courses, setCourses] = useState<StudentCourseItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<FormalLessonSummary[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedCourseId, setLoadedCourseId] = useState<string | null>(null);
  const [progressByCourse, setProgressByCourse] = useState<Record<string, CourseLearningProgress>>({});
  const [retryToken, setRetryToken] = useState(0);
  const updateProgress = useCallback((value: CourseLearningProgress) => {
    setProgressByCourse((current) => ({ ...current, [value.courseId]: value }));
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((item) => item.course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoadingCourses(true);
      setError(null);
      try {
        const memberships = await listFormalStudentMemberships();
        const approvedMemberships = memberships.filter((item) => item.status === "approved");
        const classCourseGroups = await Promise.all(
          approvedMemberships.map(async (membership) => ({
            className: membership.class.name,
            courses: await listFormalClassCourses(membership.classId),
          })),
        );

        const courseMap = new Map<string, StudentCourseItem>();
        for (const group of classCourseGroups) {
          for (const item of group.courses) {
            const existing = courseMap.get(item.course.id);
            if (existing) {
              if (!existing.classNames.includes(group.className)) {
                existing.classNames.push(group.className);
              }
            } else {
              courseMap.set(item.course.id, {
                course: item.course,
                classNames: [group.className],
              });
            }
          }
        }

        const nextCourses = Array.from(courseMap.values());
        const savedProgress = await listFormalCourseProgress();
        if (!cancelled) {
          setCourses(nextCourses);
          setProgressByCourse(Object.fromEntries(savedProgress.map((value) => [value.courseId, value])));
          setSelectedCourseId((current) =>
            current && nextCourses.some((item) => item.course.id === current)
              ? current
              : null,
          );
        }
      } catch (loadError) {
        if (!cancelled) { setCourses([]); setSelectedCourseId(null); setError(formatFormalCourseError(loadError, "课程列表加载失败，请稍后重试。")); }
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    }

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    if (!selectedCourseId) {
      setLessons([]);
      return;
    }

    let cancelled = false;
    setLoadingLessons(true);
    setError(null);
    listFormalLessons(selectedCourseId)
      .then((items) => {
        if (!cancelled) {
          setLessons(items);
          setLoadedCourseId(selectedCourseId);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setLessons([]);
          setError(formatFormalCourseError(loadError, "章节加载失败，请稍后重试。"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, retryToken]);

  const playerLesson = useMemo<CourseLesson | null>(() => {
    if (!selectedCourse || loadedCourseId !== selectedCourse.course.id || !lessons.length) return null;
    return {
      info: {
        id: selectedCourse.course.id,
        title: selectedCourse.course.title,
        subtitle: selectedCourse.course.description ?? "",
        level: "班级课程",
        durationMinutes: 0,
        objectives: lessons.map((lesson) => lesson.title),
      },
      scenes: [...lessons].sort((a, b) => a.order - b.order).map((lesson) => ({
        id: lesson.id,
        type: "intro",
        title: lesson.title,
        summary: lesson.content.slice(0, 120),
        content: { heading: lesson.title, paragraphs: [lesson.content], keyPoints: [] },
        teacher: { name: "AI 小老师", role: "课程学习助手", script: lesson.content },
      })),
    };
  }, [selectedCourse, loadedCourseId, lessons]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          <BookOpen className="h-4 w-4" />
          我的课程
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI RoboEdu 课程中心</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
              正式模式：这里展示已加入班级发布的课程和章节内容。
            </p>
          </div>
          <Link
            href="/class/join"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2386FF] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            <Settings2 className="h-4 w-4" />
            加入班级
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-[#FFD7D4] bg-[#FFF1F0] px-4 py-3 text-sm text-[#D93026]">
          {error}
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="ml-3 underline">重新加载课程</button>
        </div>
      )}

      <div className="space-y-6">
        <section className="border-b bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">班级课程</h2>
          </div>
          {loadingCourses ? (
            <div className="p-10 text-center text-sm text-gray-500">正在加载课程...</div>
          ) : courses.length === 0 ? (
            <div className="p-10 text-center text-sm leading-6 text-gray-500">
              暂无可学习课程。加入班级并等待教师发布课程后会显示在这里。
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((item) => (
                <button
                  key={item.course.id}
                  type="button"
                  onClick={() => setSelectedCourseId(item.course.id)}
                  className={`w-full px-5 py-4 text-left transition ${
                    selectedCourseId === item.course.id ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-950">
                        {item.course.title}
                      </h3>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {item.classNames.join("、")}
                      </p>
                      <p className="mt-2 text-xs text-gray-600">{LEARNING_STATUS_LABELS[progressByCourse[item.course.id]?.status ?? "not_started"]} · {progressByCourse[item.course.id]?.completedLessons ?? 0}/{progressByCourse[item.course.id]?.totalLessons ?? 0} 章 · {progressByCourse[item.course.id]?.percent ?? 0}%</p>
                      <progress aria-label={`${item.course.title}学习进度`} className="mt-2 h-2 w-full accent-blue-600" max={100} value={progressByCourse[item.course.id]?.percent ?? 0} />
                      <span className="mt-2 block text-xs font-medium text-blue-700">{progressByCourse[item.course.id]?.status === "not_started" || !progressByCourse[item.course.id] ? "开始学习" : "继续学习"}</span>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {!selectedCourse ? (
            <div className="rounded-lg bg-slate-50 px-4 py-10 text-center text-sm text-gray-500">
              请选择一个课程查看章节。
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                    {selectedCourse.course.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    来自：{selectedCourse.classNames.join("、")}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold text-gray-950">
                  {selectedCourse.course.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {selectedCourse.course.description || "暂无课程简介。"}
                </p>
              </div>

              {loadingLessons || (loadedCourseId !== selectedCourseId && !error) ? (
                <p className="text-sm text-gray-500">正在加载章节...</p>
              ) : playerLesson ? (
                <CoursePlayer key={playerLesson.info.id} lesson={playerLesson} formal onProgressChange={updateProgress} />
              ) : (
                <p className="text-sm text-gray-500">教师尚未添加章节。</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatFormalCourseError(error: unknown, fallback: string): string {
  if (error instanceof FormalCourseApiError || error instanceof FormalClassApiError) {
    if (error.status === 401) return "登录已过期，请重新登录。";
    if (error.status === 403) return "当前账号无权访问该课程。";
    if (error.status === 404) return "课程或班级不存在。";
    if (error.status === 409) return "课程状态已变化，请刷新后重试。";
    return error.message || fallback;
  }
  return fallback;
}
