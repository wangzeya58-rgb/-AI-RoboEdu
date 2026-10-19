"use client";

import { TEACHING_REQUEST_TIMEOUT_MS, type TeachingMessage } from "@/lib/ai-classroom/conversation";
import type { CourseLearningProgress, ClassCourseLearningProgress } from "./learning-progress";
import { notifyFormalCoursesChanged } from "./course-refresh";
import type { FormalCourseMaterial } from "./material-types";

export async function listFormalMaterials(courseId: string, signal?: AbortSignal): Promise<FormalCourseMaterial[]> {
  return (await request<{ items: FormalCourseMaterial[] }>(`/api/v1/courses/${encodeURIComponent(courseId)}/materials`, { signal })).items;
}

export async function uploadFormalMaterial(courseId: string, file: File, signal?: AbortSignal): Promise<FormalCourseMaterial> {
  const body = new FormData(); body.set("file", file);
  return request<FormalCourseMaterial>(`/api/v1/courses/${encodeURIComponent(courseId)}/materials`, { method: "POST", body, signal });
}

export async function deleteFormalMaterial(courseId: string, materialId: string) {
  return request<{ id: string }>(`/api/v1/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}`, { method: "DELETE" });
}

export async function getFormalCourseProgress(courseId: string, signal?: AbortSignal) {
  return progressRequest<CourseLearningProgress>(`/api/v1/courses/${encodeURIComponent(courseId)}/progress`, { signal });
}

export async function listFormalCourseProgress(signal?: AbortSignal) {
  return (await progressRequest<{ items: CourseLearningProgress[] }>("/api/v1/courses/progress", { signal })).items;
}

export async function saveFormalCourseProgress(courseId: string, lessonId: string, completed = false, signal?: AbortSignal) {
  return progressRequest<CourseLearningProgress>(`/api/v1/courses/${encodeURIComponent(courseId)}/progress`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, completed }), signal,
  });
}

export async function getFormalClassCourseProgress(classId: string, courseId: string, signal?: AbortSignal) {
  return progressRequest<ClassCourseLearningProgress>(`/api/v1/classes/${encodeURIComponent(classId)}/courses/${encodeURIComponent(courseId)}/progress`, { signal });
}

async function progressRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  try {
    return await request<T>(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    if (timeout.aborted) throw new FormalCourseApiError(504, "学习进度请求超时，请重试。");
    if (error instanceof FormalCourseApiError) throw error;
    throw new FormalCourseApiError(0, "学习进度网络请求失败，请检查连接后重试。");
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: number;
}

export interface FormalCourseSummary {
  id: string;
  title: string;
  description: string | null;
  teacherId: string;
  creatorId?: string;
  creatorName?: string | null;
  creatorRole?: "admin" | "teacher" | null;
  publicationScope?: string;
  classIds?: string[];
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface FormalLessonSummary {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

export interface FormalClassCourseSummary {
  courseId: string;
  classId: string;
  createdAt: string;
  course: FormalCourseSummary;
}

export interface FormalAiLessonContext {
  course: FormalCourseSummary;
  lesson: FormalLessonSummary;
  provider: {
    id: string;
    name: string;
    mode: "demo" | "llm";
  };
}

export interface FormalAiLessonAnswer extends FormalAiLessonContext {
  question: string;
  answer: string;
}

export class FormalCourseApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FormalCourseApiError";
    this.status = status;
  }
}

export async function listFormalCourses(): Promise<FormalCourseSummary[]> {
  const data = await request<{ items: FormalCourseSummary[] }>("/api/v1/courses");
  return data.items;
}

export async function listReadableFormalCourses(signal?: AbortSignal): Promise<FormalCourseSummary[]> {
  return (await request<{ items: FormalCourseSummary[] }>("/api/v1/courses?view=readable", { signal })).items;
}

export async function listAvailableFormalCourses(): Promise<Array<{ course: FormalCourseSummary; classNames: string[] }>> {
  return (await request<{ items: Array<{ course: FormalCourseSummary; classNames: string[] }> }>("/api/v1/courses/available")).items;
}

export async function publishFormalPublicCourse(courseId: string, published: boolean) {
  return request<FormalCourseSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}/publication`, { method: published ? "POST" : "DELETE" });
}

export async function confirmFormalCourseOwnership(courseId: string, creatorId: string) {
  return request<FormalCourseSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}/ownership`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creatorId }),
  });
}

export async function unpublishFormalCourseFromClass(courseId: string, classId: string) {
  return request(`/api/v1/courses/${encodeURIComponent(courseId)}/classes`, {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId }),
  });
}

export async function createFormalCourse(input: {
  title: string;
  description?: string;
}): Promise<FormalCourseSummary> {
  return request<FormalCourseSummary>("/api/v1/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getFormalCourse(courseId: string, signal?: AbortSignal): Promise<FormalCourseSummary> {
  return request<FormalCourseSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}`, { signal });
}

export async function updateFormalCourse(courseId: string, input: { title: string; description?: string }) {
  return request<FormalCourseSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
}

export async function deleteFormalCourse(courseId: string) {
  return request<{ id: string }>(`/api/v1/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" });
}

export async function listFormalLessons(courseId: string, signal?: AbortSignal): Promise<FormalLessonSummary[]> {
  const data = await request<{ items: FormalLessonSummary[] }>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons`,
    { signal },
  );
  return data.items;
}

export async function createFormalLesson(
  courseId: string,
  input: { title: string; content: string; order: number },
): Promise<FormalLessonSummary> {
  return request<FormalLessonSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}/lessons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function publishFormalCourseToClass(
  courseId: string,
  classId: string,
): Promise<{ courseId: string; classId: string; createdAt: string }> {
  return request<{ courseId: string; classId: string; createdAt: string }>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/classes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId }),
    },
  );
}

export async function updateFormalLesson(
  courseId: string,
  lessonId: string,
  input: { title: string; content: string },
): Promise<FormalLessonSummary> {
  return request<FormalLessonSummary>(`/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function listFormalClassCourses(classId: string): Promise<FormalClassCourseSummary[]> {
  const data = await request<{ items: FormalClassCourseSummary[] }>(
    `/api/v1/classes/${encodeURIComponent(classId)}/courses`,
  );
  return data.items;
}

export async function getFormalAiLessonContext(
  courseId: string,
  lessonId: string,
): Promise<FormalAiLessonContext> {
  return request<FormalAiLessonContext>(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/ai`,
  );
}

export async function askFormalAiLessonTeacher(
  courseId: string,
  lessonId: string,
  question: string,
  history: TeachingMessage[] = [],
  signal?: AbortSignal,
): Promise<FormalAiLessonAnswer> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TEACHING_REQUEST_TIMEOUT_MS);
  let rejectCancelled: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_resolve, reject) => {
      rejectCancelled = () => reject(new DOMException("请求已取消", "AbortError"));
      controller.signal.addEventListener("abort", rejectCancelled, { once: true });
    });
    if (controller.signal.aborted) throw new DOMException("请求已取消", "AbortError");
    return await Promise.race([
      request<FormalAiLessonAnswer>(
        `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history }),
          signal: controller.signal,
        },
      ),
      cancelled,
    ]);
  } catch (error) {
    if (signal?.aborted) throw new DOMException("请求已取消", "AbortError");
    if (timedOut) throw new FormalCourseApiError(504, "课程 AI 请求超时，问题已保留，请重试。");
    if (error instanceof FormalCourseApiError) throw error;
    throw new FormalCourseApiError(0, "网络连接失败，问题已保留，请检查网络后重试。");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
    if (rejectCancelled) controller.signal.removeEventListener("abort", rejectCancelled);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new FormalCourseApiError(
      response.status,
      body?.message ?? statusMessage(response.status),
    );
  }

  if (init?.method && init.method !== "GET" && !url.includes("/progress") && !url.endsWith("/ai")) notifyFormalCoursesChanged();
  return body.data;
}

function statusMessage(status: number): string {
  if (status === 400) return "请求参数不合法。";
  if (status === 401) return "登录已过期，请重新登录。";
  if (status === 403) return "当前账号无权访问该课程。";
  if (status === 404) return "课程或班级不存在。";
  if (status === 409) return "课程发布状态冲突，请刷新后重试。";
  return "课程服务暂不可用，请稍后重试。";
}
