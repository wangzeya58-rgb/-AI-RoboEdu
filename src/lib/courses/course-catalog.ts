"use client";

import type { SessionInfo } from "@/lib/auth/client";
import { isDemoSessionId } from "@/lib/classes/formal-class-api";
import { listDemoReadableCourses, type CourseAsset } from "@/lib/course/teacher-course-store";
import { listReadableFormalCourses } from "./formal-course-api";

export interface CatalogCourse {
  id: string;
  title: string;
  status?: string;
  publicationScope?: string;
  creatorId?: string;
  creatorName?: string | null;
  creatorRole?: "teacher" | "admin" | null;
  source: "demo" | "formal";
  resources?: CourseAsset[];
  canManage: boolean;
  href: string;
}

function courseHref(session: SessionInfo, id: string, canManage: boolean, demo: boolean): string {
  if (!canManage) return `/course/player?courseId=${encodeURIComponent(id)}`;
  const page = session.role === "admin" ? "/admin/courses" : "/teacher/courses";
  return `${page}?${demo ? "courseId" : "id"}=${encodeURIComponent(id)}`;
}

export async function loadReadableCourseCatalog(session: SessionInfo, signal?: AbortSignal): Promise<CatalogCourse[]> {
  if (isDemoSessionId(session.id)) {
    return (await listDemoReadableCourses(session)).map((course) => {
      const canManage = session.role === "admin" || (session.role === "teacher" && course.creatorId === session.id);
      return { ...course, source: "demo", canManage, href: courseHref(session, course.id, canManage, true) };
    });
  }
  return (await listReadableFormalCourses(signal)).map((course) => {
    const canManage = session.role === "admin" || (session.role === "teacher" && course.teacherId === session.id);
    return { ...course, source: "formal", canManage, href: courseHref(session, course.id, canManage, false) };
  });
}
