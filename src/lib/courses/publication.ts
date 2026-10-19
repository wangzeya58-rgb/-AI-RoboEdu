export type CourseCreatorRole = "admin" | "teacher";
export type CourseScope = "public" | "class" | "legacy";

export function isPublishedPublicCourse(course: { creatorRole?: string | null; publicationScope?: string; status?: string }): boolean {
  return course.creatorRole === "admin" && course.publicationScope === "public" && course.status === "published";
}

export function courseScopeLabel(scope?: string): string {
  if (scope === "public") return "公共课程 · 所有学生";
  if (scope === "class") return "班级专属 · 已批准成员";
  return scope === "legacy" ? "旧课程 · 保留原班级范围" : "归属待确认 · 未发布";
}

export function courseStatusLabel(status?: string, scope?: string): string {
  if (status === "draft" || !status) return "草稿（学生不可见）";
  if (scope === "legacy") return "原班级发布范围（待确认）";
  return status === "published" ? "已发布" : "草稿（学生不可见）";
}
