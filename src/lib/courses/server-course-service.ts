import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { isFormalUserId } from "@/lib/classes/server-class-service";
import { getDatabase, type AppDatabase } from "@/storage/database/db";
import {
	classCourses,
	classMembers,
	classes,
	courses,
	lessons,
} from "@/storage/database/shared/schema";

const DEFAULT_COURSE_CATEGORY = "formal";

export interface CourseSummary {
	id: string;
	title: string;
	description: string | null;
	teacherId: string;
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
		where: eq(courses.teacherId, user.id),
		orderBy: [desc(courses.createdAt)],
	});

	return rows.map(toCourseSummary);
}

export async function getCourseForUser(user: SessionUser, courseId: string): Promise<CourseSummary> {
	assertFormalUser(user);
	const db = getCourseDatabase();
	const course = await getCourseOrThrow(db, courseId);

	if (user.role === "teacher" && course.teacherId === user.id) {
		return toCourseSummary(course);
	}

	if (user.role === "student" && await studentCanAccessCourse(db, user.id, courseId)) {
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
	await assertTeacherOwnsCourse(db, user.id, courseId);

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
	await assertTeacherOwnsCourse(db, user.id, courseId);
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
	await assertTeacherOwnsCourse(db, user.id, courseId);
	await assertTeacherOwnsClass(db, user.id, classId);

	try {
		const [created] = await db
			.insert(classCourses)
			.values({ courseId, classId })
			.returning();
		return created;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw ApiError.conflict("课程已发布到该班级");
		}
		throw error;
	}
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
	} else {
		throw ApiError.forbidden("当前身份无权访问班级课程");
	}

	const rows = await db
		.select({
			classCourse: classCourses,
			course: courses,
		})
		.from(classCourses)
		.innerJoin(courses, eq(classCourses.courseId, courses.id))
		.where(eq(classCourses.classId, classId))
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
	teacherId: string,
	courseId: string,
): Promise<typeof courses.$inferSelect> {
	const course = await getCourseOrThrow(db, courseId);
	if (course.teacherId !== teacherId) {
		throw ApiError.forbidden("无权管理该课程");
	}
	return course;
}

async function assertTeacherOwnsClass(
	db: AppDatabase,
	teacherId: string,
	classId: string,
): Promise<typeof classes.$inferSelect> {
	const classInfo = await db.query.classes.findFirst({
		where: eq(classes.id, classId),
	});
	if (!classInfo) {
		throw ApiError.notFound("班级不存在");
	}
	if (classInfo.teacherId !== teacherId) {
		throw ApiError.forbidden("无权向该班级发布课程");
	}
	return classInfo;
}

async function studentCanAccessCourse(
	db: AppDatabase,
	studentId: string,
	courseId: string,
): Promise<boolean> {
	const links = await db.query.classCourses.findMany({
		where: eq(classCourses.courseId, courseId),
		columns: { classId: true },
	});
	if (links.length === 0) return false;

	const membership = await db.query.classMembers.findFirst({
		where: and(
			inArray(classMembers.classId, links.map((link) => link.classId)),
			eq(classMembers.userId, studentId),
			eq(classMembers.status, "approved"),
		),
		columns: { id: true },
	});
	return Boolean(membership);
}

function assertFormalUser(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能访问正式课程数据");
	}
}

function assertTeacher(user: SessionUser): void {
	if (user.role !== "teacher") {
		throw ApiError.forbidden("只有教师账号可以操作课程");
	}
}

function toCourseSummary(course: typeof courses.$inferSelect): CourseSummary {
	return {
		id: course.id,
		title: course.title,
		description: course.description,
		teacherId: course.teacherId,
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
