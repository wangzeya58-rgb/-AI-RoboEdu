import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { isFormalUserId } from "@/lib/classes/server-class-service";
import { isPublishedPublicCourse } from "./publication";
import { isLocalMaterial, removeCourseFile } from "./course-file-storage";
import { getDatabase, type AppDatabase } from "@/storage/database/db";
import {
	classCourses,
	classMembers,
	classes,
	courses,
	courseMaterials,
	lessons,
	users,
} from "@/storage/database/shared/schema";

const DEFAULT_COURSE_CATEGORY = "formal";

export interface CourseSummary {
	id: string;
	title: string;
	description: string | null;
	teacherId: string;
	creatorId: string;
	creatorName: string | null;
	creatorRole: "admin" | "teacher" | null;
	publicationScope: string;
	classIds?: string[];
	status: string;
	createdAt: string;
	updatedAt: string | null;
}

export interface LessonSummary {
	id: string;
	courseId: string;
	title: string;
	content: string;
	order: number;
	createdAt: string;
}

export interface ClassCourseSummary {
	courseId: string;
	classId: string;
	createdAt: string;
	course: CourseSummary;
}

export function normalizeCourseTitle(title: string): string {
	const normalized = title.trim();
	if (!normalized) {
		throw ApiError.badRequest("课程标题不能为空");
	}
	if (normalized.length > 255) {
		throw ApiError.badRequest("课程标题不能超过 255 个字符");
	}
	return normalized;
}

export function normalizeLessonTitle(title: string): string {
	const normalized = title.trim();
	if (!normalized) {
		throw ApiError.badRequest("章节标题不能为空");
	}
	if (normalized.length > 255) {
		throw ApiError.badRequest("章节标题不能超过 255 个字符");
	}
	return normalized;
}

export function normalizeOptionalDescription(description?: string): string | null {
	if (description === undefined) return null;
	const normalized = description.trim();
	return normalized ? normalized : null;
}

export function normalizeLessonContent(content: string): string {
	const normalized = content.trim();
	if (!normalized) {
		throw ApiError.badRequest("章节内容不能为空");
	}
	return normalized;
}

export function normalizeLessonOrder(order: number): number {
	if (!Number.isInteger(order) || order < 0) {
		throw ApiError.badRequest("章节顺序必须是非负整数");
	}
	return order;
}

export async function createCourseForTeacher(
	user: SessionUser,
	input: { title: string; description?: string },
): Promise<CourseSummary> {
	assertFormalUser(user);
	assertTeacher(user);

	const db = getCourseDatabase();
	const [created] = await db
		.insert(courses)
		.values({
			title: normalizeCourseTitle(input.title),
			description: normalizeOptionalDescription(input.description),
			category: DEFAULT_COURSE_CATEGORY,
			teacherId: user.id,
			teacherName: user.name,
			creatorRole: user.role === "admin" ? "admin" : "teacher",
			publicationScope: user.role === "admin" ? "public" : "class",
			status: "draft",
		})
		.returning();

	return toCourseSummary(created);
}

export async function listCoursesForTeacher(user: SessionUser): Promise<CourseSummary[]> {
	assertFormalUser(user);
	assertTeacher(user);

	const db = getCourseDatabase();
	const rows = await db.query.courses.findMany({
		where: user.role === "admin" ? undefined : eq(courses.teacherId, user.id),
		orderBy: [desc(courses.createdAt)],
	});

	const links = rows.length ? await db.select().from(classCourses).where(inArray(classCourses.courseId, rows.map((item) => item.id))) : [];
	return rows.map((row) => ({ ...toCourseSummary(row), classIds: links.filter((link) => link.courseId === row.id).map((link) => link.classId) }));
}

// Both the catalogue and every content endpoint use this same live membership predicate.
function publicCourseCondition() {
	return and(eq(courses.publicationScope, "public"), eq(courses.creatorRole, "admin"), eq(courses.status, "published"));
}

export async function listReadableCourses(user: SessionUser): Promise<CourseSummary[]> {
	assertFormalUser(user);
	if (user.role === "admin") return listCoursesForTeacher(user);
	if (user.role === "student") return (await listAvailableCourses(user)).map((item) => item.course);
	assertTeacher(user);
	const db = getCourseDatabase();
	const rows = await db.select().from(courses).where(or(eq(courses.teacherId, user.id), publicCourseCondition())).orderBy(desc(courses.createdAt));
	return rows.map(toCourseSummary);
}

function studentAccessCondition(studentId: string) {
	return or(
		publicCourseCondition(),
		and(
			or(and(eq(courses.publicationScope, "legacy"), ne(courses.status, "draft")), and(eq(courses.publicationScope, "class"), eq(courses.creatorRole, "teacher"), eq(courses.status, "published"))),
			sql`exists (select 1 from ${classCourses} cc inner join ${classMembers} cm on cm.class_id = cc.class_id inner join ${classes} cl on cl.id = cc.class_id where cc.course_id = ${courses.id} and cm.user_id = ${studentId} and cm.status = 'approved' and (${courses.publicationScope} = 'legacy' or cl.teacher_id = ${courses.teacherId}))`,
		),
	);
}

export async function listAvailableCourses(user: SessionUser) {
	assertFormalUser(user);
	if (user.role !== "student") throw ApiError.forbidden("只有学生可以读取本人的学习课程");
	const db = getCourseDatabase();
	const rows = await db.select().from(courses).where(studentAccessCondition(user.id)).orderBy(desc(courses.createdAt));
	const links = rows.length ? await db.select({ courseId: classCourses.courseId, id: classes.id, name: classes.name, teacherId: classes.teacherId })
		.from(classCourses).innerJoin(classes, eq(classes.id, classCourses.classId))
		.innerJoin(classMembers, eq(classMembers.classId, classes.id))
		.where(and(inArray(classCourses.courseId, rows.map((row) => row.id)), eq(classMembers.userId, user.id), eq(classMembers.status, "approved"))) : [];
	return rows.map((row) => ({
		course: toCourseSummary(row),
		classNames: row.publicationScope === "public" ? ["公共课程"] : links.filter((link) => link.courseId === row.id && (row.publicationScope === "legacy" || link.teacherId === row.teacherId)).map((link) => link.name),
	}));
}

export async function publishPublicCourse(user: SessionUser, courseId: string, published: boolean) {
	assertFormalUser(user);
	if (user.role !== "admin") throw ApiError.forbidden("只有管理员可以发布公共课程");
	const db = getCourseDatabase();
	return db.transaction(async (tx) => {
		const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
		if (!course) throw ApiError.notFound("课程不存在");
		if (course.creatorRole !== "admin") throw ApiError.forbidden("教师课程不能转为公共课程；未知归属须先确认");
		const [updated] = await tx.update(courses).set({ publicationScope: "public", status: published ? "published" : "draft", updatedAt: new Date().toISOString() }).where(eq(courses.id, courseId)).returning();
		return toCourseSummary(updated);
	});
}

export async function confirmCourseOwnership(user: SessionUser, courseId: string, creatorId: string) {
	assertFormalUser(user);
	if (user.role !== "admin") throw ApiError.forbidden("只有管理员可以确认旧课程归属");
	const db = getCourseDatabase();
	return db.transaction(async (tx) => {
		const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
		if (!course) throw ApiError.notFound("课程不存在");
		if (course.creatorRole) throw ApiError.conflict("课程已有明确创建者，不能更改归属");
		const creator = await tx.query.users.findFirst({ where: eq(users.id, creatorId) });
		if (!creator || (creator.role !== "admin" && creator.role !== "teacher")) throw ApiError.badRequest("请选择正式教师或管理员用户 ID");
		const [updated] = await tx.update(courses).set({ teacherId: creator.id, teacherName: creator.name, creatorRole: creator.role, updatedAt: new Date().toISOString() }).where(eq(courses.id, courseId)).returning();
		return toCourseSummary(updated);
	});
}

export async function updateCourseForUser(
	user: SessionUser,
	courseId: string,
	input: { title: string; description?: string },
): Promise<CourseSummary> {
	assertFormalUser(user);
	assertTeacher(user);
	const db = getCourseDatabase();
	await assertTeacherOwnsCourse(db, user, courseId);
	const [updated] = await db.update(courses).set({
		title: normalizeCourseTitle(input.title),
		description: normalizeOptionalDescription(input.description),
		updatedAt: new Date().toISOString(),
	}).where(eq(courses.id, courseId)).returning();
	if (!updated) throw ApiError.notFound("课程不存在");
	return toCourseSummary(updated);
}

export async function deleteCourseForUser(user: SessionUser, courseId: string): Promise<{ id: string }> {
	assertFormalUser(user);
	assertTeacher(user);
	const db = getCourseDatabase();
	await assertTeacherOwnsCourse(db, user, courseId);
	const removed = await db.transaction(async (tx) => {
		await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).for("update");
		const files = await tx.select({ url: courseMaterials.url }).from(courseMaterials).where(eq(courseMaterials.courseId, courseId));
		const [deleted] = await tx.delete(courses).where(eq(courses.id, courseId)).returning({ id: courses.id });
		if (!deleted) throw ApiError.notFound("课程不存在");
		return { deleted, files };
	});
	for (const file of removed.files) {
		if (isLocalMaterial(file.url)) await removeCourseFile(file.url).catch(() => console.error("Course deleted; orphan attachment needs administrator cleanup."));
	}
	return removed.deleted;
}

export async function getCourseForUser(user: SessionUser, courseId: string): Promise<CourseSummary> {
	assertFormalUser(user);
	const db = getCourseDatabase();
	const course = await getCourseOrThrow(db, courseId);

	if (user.role === "admin" || (user.role === "teacher" && (course.teacherId === user.id || isPublishedPublicCourse(course)))) {
		return toCourseSummary(course);
	}

	if (user.role === "student" && (await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), studentAccessCondition(user.id))).limit(1)).length) {
		return toCourseSummary(course);
	}

	throw ApiError.forbidden("无权访问该课程");
}

export async function addLessonToCourse(
	user: SessionUser,
	courseId: string,
	input: { title: string; content: string; order: number },
): Promise<LessonSummary> {
	assertFormalUser(user);
	assertTeacher(user);

	const db = getCourseDatabase();
	await assertTeacherOwnsCourse(db, user, courseId);

	const [created] = await db
		.insert(lessons)
		.values({
			courseId,
			title: normalizeLessonTitle(input.title),
			content: normalizeLessonContent(input.content),
			order: normalizeLessonOrder(input.order),
		})
		.returning();

	return created;
}

export async function listLessonsForCourse(
	user: SessionUser,
	courseId: string,
): Promise<LessonSummary[]> {
	await getCourseForUser(user, courseId);

	const db = getCourseDatabase();
	return db.query.lessons.findMany({
		where: eq(lessons.courseId, courseId),
		orderBy: [asc(lessons.order), asc(lessons.createdAt)],
	});
}

export async function updateLessonForCourse(
	user: SessionUser,
	courseId: string,
	lessonId: string,
	input: { title: string; content: string },
): Promise<LessonSummary> {
	assertFormalUser(user);
	assertTeacher(user);
	const db = getCourseDatabase();
	await assertTeacherOwnsCourse(db, user, courseId);
	const [updated] = await db.update(lessons).set({
		title: normalizeLessonTitle(input.title),
		content: normalizeLessonContent(input.content),
	}).where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId))).returning();
	if (!updated) throw ApiError.notFound("章节不存在");
	return updated;
}

export async function publishCourseToClass(
	user: SessionUser,
	courseId: string,
	classId: string,
): Promise<{ courseId: string; classId: string; createdAt: string }> {
	assertFormalUser(user);
	assertTeacher(user);

	const db = getCourseDatabase();
	try {
		return await db.transaction(async (tx) => {
			const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
			if (!course) throw ApiError.notFound("课程不存在");
			if (user.role !== "admin" && course.teacherId !== user.id) throw ApiError.forbidden("无权管理该课程");
			if (course.creatorRole !== "teacher") throw ApiError.forbidden("管理员课程请发布为公共课程；未知归属须先确认");
			const classInfo = await tx.query.classes.findFirst({ where: eq(classes.id, classId) });
			if (!classInfo) throw ApiError.notFound("班级不存在");
			if (classInfo.teacherId !== course.teacherId) throw ApiError.forbidden("只能发布到课程创建教师自己的班级");
			const [created] = await tx.insert(classCourses).values({ courseId, classId }).returning();
			await tx.update(courses).set({ publicationScope: "class", status: "published", updatedAt: new Date().toISOString() }).where(eq(courses.id, courseId));
			return created;
		});
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw ApiError.conflict("课程已发布到该班级");
		}
		throw error;
	}
}

export async function unpublishCourseFromClass(user: SessionUser, courseId: string, classId: string) {
	assertFormalUser(user);
	assertTeacher(user);
	const db = getCourseDatabase();
	return db.transaction(async (tx) => {
		const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
		if (!course) throw ApiError.notFound("课程不存在");
		if (user.role !== "admin" && course.teacherId !== user.id) throw ApiError.forbidden("无权管理该课程");
		const [link] = await tx.delete(classCourses).where(and(eq(classCourses.courseId, courseId), eq(classCourses.classId, classId))).returning();
		if (!link) throw ApiError.notFound("课程未发布到该班级");
		const remaining = await tx.query.classCourses.findFirst({ where: eq(classCourses.courseId, courseId) });
		if (!remaining && course.publicationScope !== "public") await tx.update(courses).set({ status: "draft", updatedAt: new Date().toISOString() }).where(eq(courses.id, courseId));
		return link;
	});
}

export async function listCoursesForClass(
	user: SessionUser,
	classId: string,
): Promise<ClassCourseSummary[]> {
	assertFormalUser(user);

	const db = getCourseDatabase();
	const classInfo = await db.query.classes.findFirst({
		where: eq(classes.id, classId),
	});
	if (!classInfo) {
		throw ApiError.notFound("班级不存在");
	}

	if (user.role === "teacher") {
		if (classInfo.teacherId !== user.id) {
			throw ApiError.forbidden("无权访问该班级课程");
		}
	} else if (user.role === "student") {
		const membership = await db.query.classMembers.findFirst({
			where: and(
				eq(classMembers.classId, classId),
				eq(classMembers.userId, user.id),
				eq(classMembers.status, "approved"),
			),
			columns: { id: true },
		});
		if (!membership) {
			throw ApiError.forbidden("未加入该班级，无法查看课程");
		}
	} else if (user.role !== "admin") {
		throw ApiError.forbidden("当前身份无权访问班级课程");
	}

	const rows = await db
		.select({
			classCourse: classCourses,
			course: courses,
		})
		.from(classCourses)
		.innerJoin(courses, eq(classCourses.courseId, courses.id))
		.where(and(eq(classCourses.classId, classId), user.role === "student" ? and(studentAccessCondition(user.id), or(eq(courses.publicationScope, "legacy"), eq(courses.publicationScope, "public"), eq(courses.teacherId, classInfo.teacherId))) : undefined))
		.orderBy(desc(classCourses.createdAt));

	return rows.map(({ classCourse, course }) => ({
		...classCourse,
		course: toCourseSummary(course),
	}));
}

async function getCourseOrThrow(
	db: AppDatabase,
	courseId: string,
): Promise<typeof courses.$inferSelect> {
	const course = await db.query.courses.findFirst({
		where: eq(courses.id, courseId),
	});
	if (!course) {
		throw ApiError.notFound("课程不存在");
	}
	return course;
}

async function assertTeacherOwnsCourse(
	db: AppDatabase,
	user: SessionUser,
	courseId: string,
): Promise<typeof courses.$inferSelect> {
	const course = await getCourseOrThrow(db, courseId);
	if (user.role !== "admin" && course.teacherId !== user.id) {
		throw ApiError.forbidden("无权管理该课程");
	}
	return course;
}

function assertFormalUser(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能访问正式课程数据");
	}
}

function assertTeacher(user: SessionUser): void {
	if (user.role !== "teacher" && user.role !== "admin") {
		throw ApiError.forbidden("只有教师或管理员账号可以操作课程");
	}
}

function toCourseSummary(course: typeof courses.$inferSelect): CourseSummary {
	return {
		id: course.id,
		title: course.title,
		description: course.description,
		teacherId: course.teacherId,
		// The existing teacher_id FK stores the creator, including admin authors.
		creatorId: course.teacherId,
		creatorName: course.teacherName,
		creatorRole: course.creatorRole === "admin" || course.creatorRole === "teacher" ? course.creatorRole : null,
		publicationScope: course.publicationScope,
		status: course.status,
		createdAt: course.createdAt,
		updatedAt: course.updatedAt,
	};
}

function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const maybeError = error as { code?: unknown; cause?: unknown };
	if (maybeError.code === "23505") return true;
	return isUniqueViolation(maybeError.cause);
}

function getCourseDatabase(): AppDatabase {
	try {
		return getDatabase();
	} catch (error) {
		throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "数据库尚未配置，正式课程接口暂不可用", {
			httpStatus: 503,
			cause: error,
		});
	}
}
