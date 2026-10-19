import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { SessionUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { getDatabase } from "@/storage/database/db";
import { courseMaterials, courses } from "@/storage/database/shared/schema";
import { getCourseForUser } from "./server-course-service";
import { isLocalMaterial, localMaterialKey, persistCourseFile, removeCourseFile, validateMaterialFile } from "./course-file-storage";
import { MATERIAL_FORMATS, type FormalCourseMaterial } from "./material-types";

export async function assertMaterialManager(user: SessionUser, courseId: string) {
  const course = await getCourseForUser(user, courseId);
  if (user.role !== "admin" && (user.role !== "teacher" || course.teacherId !== user.id)) throw ApiError.forbidden("只有课程创建教师或管理员可以管理附件。");
  if (!course.creatorRole) throw ApiError.conflict("请先确认旧课程归属，再上传附件。");
}

export function materialSummary(row: typeof courseMaterials.$inferSelect): FormalCourseMaterial {
  const extension = row.name.split(".").pop()?.toLowerCase() ?? "";
  const format = MATERIAL_FORMATS[extension];
  const contentUrl = `/api/v1/courses/${row.courseId}/materials/${row.id}/content`;
  return { id: row.id, courseId: row.courseId, name: row.name, size: row.size, type: row.type,
    mimeType: format?.mime ?? "application/octet-stream", preview: format?.preview ?? null,
    available: isLocalMaterial(row.url), createdAt: row.createdAt, contentUrl, downloadUrl: `${contentUrl}?download=1` };
}

export async function listCourseMaterials(user: SessionUser, courseId: string): Promise<FormalCourseMaterial[]> {
  await getCourseForUser(user, courseId);
  const rows = await getDatabase().select().from(courseMaterials).where(eq(courseMaterials.courseId, courseId)).orderBy(asc(courseMaterials.sortOrder), asc(courseMaterials.createdAt));
  return rows.map(materialSummary);
}

export async function getCourseMaterial(user: SessionUser, courseId: string, materialId: string) {
  await getCourseForUser(user, courseId);
  const row = await getDatabase().query.courseMaterials.findFirst({ where: and(eq(courseMaterials.courseId, courseId), eq(courseMaterials.id, materialId)) });
  if (!row) throw ApiError.notFound("附件不存在或不属于该课程。");
  return row;
}

export async function saveCourseMaterial(user: SessionUser, courseId: string, name: string, mime: string, bytes: Uint8Array) {
  await assertMaterialManager(user, courseId);
  const extension = validateMaterialFile(name, mime, bytes);
  const key = localMaterialKey(randomUUID(), extension);
  let saved = false;
  try {
    return await getDatabase().transaction(async (tx) => {
      const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
      if (!course) throw ApiError.notFound("课程不存在。");
      if (user.role !== "admin" && course.teacherId !== user.id) throw ApiError.forbidden("无权上传到该课程。");
      await persistCourseFile(key, bytes);
      saved = true;
      const [row] = await tx.insert(courseMaterials).values({ courseId, name, type: extension, url: key, size: bytes.length }).returning();
      await tx.update(courses).set({ updatedAt: new Date().toISOString() }).where(eq(courses.id, courseId));
      return materialSummary(row);
    });
  } catch (error) {
    if (saved) await removeCourseFile(key).catch(() => console.error("Course upload rollback: file cleanup needs operator attention."));
    throw error;
  }
}

export async function deleteCourseMaterial(user: SessionUser, courseId: string, materialId: string) {
  await assertMaterialManager(user, courseId);
  const [row] = await getDatabase().delete(courseMaterials).where(and(eq(courseMaterials.courseId, courseId), eq(courseMaterials.id, materialId))).returning();
  if (!row) throw ApiError.notFound("附件不存在。");
  // Old external URLs are never followed or removed. Failed cleanup leaves only an inaccessible orphan.
  if (isLocalMaterial(row.url)) await removeCourseFile(row.url).catch(() => console.error("Deleted course material: orphan file requires operator cleanup."));
  return { id: row.id };
}
