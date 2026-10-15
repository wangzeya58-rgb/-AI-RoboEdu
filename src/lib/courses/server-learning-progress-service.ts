import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { isFormalUserId, listClassMembersForTeacher } from "@/lib/classes/server-class-service";
import { getCourseForUser } from "./server-course-service";
import { summarizeLearningProgress, type ClassCourseLearningProgress } from "./learning-progress";
import { getDatabase } from "@/storage/database/db";
import { classCourses, classMembers, courseLearningProgress, lessonCompletions, lessons } from "@/storage/database/shared/schema";

function assertStudent(user: SessionUser) {
  if (!isFormalUserId(user.id) || user.role !== "student") throw ApiError.forbidden("只有正式学生可以读写自己的学习进度");
}

export async function getOwnCourseProgress(user: SessionUser, courseId: string) {
  assertStudent(user);
  await getCourseForUser(user, courseId);
  const db = getDatabase();
  const chapters = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, courseId));
  const session = await db.query.courseLearningProgress.findFirst({ where: and(eq(courseLearningProgress.userId, user.id), eq(courseLearningProgress.courseId, courseId)) });
  const completed = chapters.length ? await db.select({ lessonId: lessonCompletions.lessonId }).from(lessonCompletions).where(and(eq(lessonCompletions.userId, user.id), inArray(lessonCompletions.lessonId, chapters.map((item) => item.id)))) : [];
  return summarizeLearningProgress(courseId, chapters.map((item) => item.id), completed.map((item) => item.lessonId), session?.lastLessonId, session?.lastStudiedAt);
}

export async function listOwnCourseProgress(user: SessionUser) {
  assertStudent(user);
  const db = getDatabase();
  const assigned = await db.selectDistinct({ courseId: classCourses.courseId }).from(classCourses).innerJoin(classMembers, eq(classCourses.classId, classMembers.classId)).where(and(eq(classMembers.userId, user.id), eq(classMembers.status, "approved")));
  return Promise.all(assigned.map((item) => getOwnCourseProgress(user, item.courseId)));
}

export async function saveOwnCourseProgress(user: SessionUser, courseId: string, lessonId: string, completed = false) {
  assertStudent(user);
  await getCourseForUser(user, courseId);
  const db = getDatabase();
  const chapter = await db.query.lessons.findFirst({ where: and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)) });
  if (!chapter) throw ApiError.notFound("章节不属于当前课程");
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(courseLearningProgress).values({ userId: user.id, courseId, lastLessonId: lessonId, lastStudiedAt: now }).onConflictDoUpdate({ target: [courseLearningProgress.userId, courseLearningProgress.courseId], set: { lastLessonId: lessonId, lastStudiedAt: now } });
    // A visit only updates the resume position. Completion requires an explicit true.
    if (completed) await tx.insert(lessonCompletions).values({ userId: user.id, lessonId, completedAt: now }).onConflictDoNothing({ target: [lessonCompletions.userId, lessonCompletions.lessonId] });
  });
  return getOwnCourseProgress(user, courseId);
}

export async function getClassCourseProgress(user: SessionUser, classId: string, courseId: string): Promise<ClassCourseLearningProgress> {
  const members = (await listClassMembersForTeacher(user, classId)).filter((member) => member.status === "approved" && member.user.role === "student");
  const course = await getCourseForUser(user, courseId);
  const db = getDatabase();
  const assigned = await db.query.classCourses.findFirst({ where: and(eq(classCourses.classId, classId), eq(classCourses.courseId, courseId)) });
  if (!assigned) throw ApiError.notFound("该课程尚未发布到此班级");
  const chapters = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, courseId));
  const lessonIds = chapters.map((item) => item.id);
  const userIds = members.map((member) => member.userId);
  const sessions = userIds.length ? await db.select().from(courseLearningProgress).where(and(eq(courseLearningProgress.courseId, courseId), inArray(courseLearningProgress.userId, userIds))) : [];
  const completions = userIds.length && lessonIds.length ? await db.select().from(lessonCompletions).where(and(inArray(lessonCompletions.userId, userIds), inArray(lessonCompletions.lessonId, lessonIds))) : [];
  const byUser = new Map(sessions.map((item) => [item.userId, item]));
  const completedByUser = new Map<string, string[]>();
  for (const item of completions) {
    const ids = completedByUser.get(item.userId) ?? [];
    ids.push(item.lessonId);
    completedByUser.set(item.userId, ids);
  }
  return {
    classId, courseId, courseTitle: course.title, totalLessons: lessonIds.length,
    students: members.map((member) => ({
      userId: member.userId, name: member.user.name, username: member.user.username,
      ...summarizeLearningProgress(courseId, lessonIds, completedByUser.get(member.userId) ?? [], byUser.get(member.userId)?.lastLessonId, byUser.get(member.userId)?.lastStudiedAt),
    })),
  };
}
