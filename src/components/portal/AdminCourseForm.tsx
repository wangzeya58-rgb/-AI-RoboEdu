"use client";

import { CourseManagementWorkspace } from "@/components/course/CourseManagementWorkspace";

export function AdminCourseForm({ mode }: { mode: "new" | "edit" }) {
  return <div data-course-mode={mode}><CourseManagementWorkspace /></div>;
}
