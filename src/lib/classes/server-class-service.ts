import { randomUUID } from "crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { getDatabase, type AppDatabase } from "@/storage/database/db";
import {
	classMembers,
	classes,
	classMemberStatusEnum,
	schools,
	users,
} from "@/storage/database/shared/schema";

type ClassMemberStatus = (typeof classMemberStatusEnum.enumValues)[number];
type ReviewStatus = Extract<ClassMemberStatus, "approved" | "rejected">;

const DEFAULT_SCHOOL_NAME = "AI RoboEdu 默认学校";
const FORMAL_UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClassSummary {
	id: string;
	classCode: string;
	name: string;
	schoolId: string;
	teacherId: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string | null;
	memberCount: number;
}

export interface ClassMemberSummary {
	id: string;
	classId: string;
	userId: string;
	status: ClassMemberStatus;
	joinedAt: string;
	createdAt: string;
}

export interface ClassDetail extends ClassSummary {
	members: ClassMemberSummary[];
}

export interface ClassMemberWithUser extends ClassMemberSummary {
	user: {
		id: string;
		username: string;
		name: string;
		role: string;
	};
}

export interface StudentClassMembership extends ClassMemberSummary {
	class: ClassSummary;
}

export function normalizeClassName(name: string): string {
	const normalized = name.trim();
	if (!normalized) {
		throw ApiError.badRequest("班级名称不能为空");
	}
	if (normalized.length > 120) {
		throw ApiError.badRequest("班级名称不能超过 120 个字符");
	}
	return normalized;
}

export function isFormalUserId(userId: string): boolean {
	return FORMAL_UUID_PATTERN.test(userId);
}

export function assertFormalUserForWrite(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能写入正式班级数据");
	}
}

export function assertFormalUser(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能访问正式班级成员数据");
	}
}

export async function createClassForTeacher(user: SessionUser, name: string): Promise<ClassSummary> {
	assertFormalUserForWrite(user);
	const db = getClassDatabase();
	const schoolId = await getOrCreateDefaultSchoolId(db);
	const className = normalizeClassName(name);
	let created: typeof classes.$inferSelect | undefined;
	for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
		try {
			[created] = await db
				.insert(classes)
				.values({
					classCode: createInternalClassCode(),
					name: className,
					schoolId,
					teacherId: user.id,
					createdBy: user.id,
				})
				.returning();
		} catch (error) {
			if (!isUniqueViolation(error) || attempt === 2) throw error;
		}
	}
	if (!created) {
		throw ApiError.internal("班级创建失败，请重试");
	}

	return {
		...created,
		memberCount: 0,
	};
}

export async function listClassesForTeacher(user: SessionUser): Promise<ClassSummary[]> {
	if (!isFormalUserId(user.id)) return [];

	const db = getClassDatabase();
	const rows = await db.query.classes.findMany({
		where: eq(classes.teacherId, user.id),
		orderBy: [desc(classes.createdAt)],
	});

	return withMemberCounts(db, rows);
}

export async function listJoinedClassesForStudent(user: SessionUser): Promise<ClassSummary[]> {
	if (!isFormalUserId(user.id)) return [];

	const db = getClassDatabase();
	const memberships = await db.query.classMembers.findMany({
		where: and(eq(classMembers.userId, user.id), eq(classMembers.status, "approved")),
		orderBy: [desc(classMembers.joinedAt)],
	});
	const classIds = memberships.map((membership) => membership.classId);
	if (classIds.length === 0) return [];

	const rows = await db.query.classes.findMany({
		where: inArray(classes.id, classIds),
		orderBy: [desc(classes.createdAt)],
	});

	return withMemberCounts(db, rows);
}

export async function listAllClassesForAdmin(user: SessionUser): Promise<ClassSummary[]> {
	if (!isFormalUserId(user.id)) return [];

	const db = getClassDatabase();
	const rows = await db.query.classes.findMany({
		orderBy: [desc(classes.createdAt)],
	});

	return withMemberCounts(db, rows);
}

export async function getClassDetailForUser(user: SessionUser, classId: string): Promise<ClassDetail> {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能访问正式班级数据");
	}

	const db = getClassDatabase();
	const classInfo = await db.query.classes.findFirst({
		where: eq(classes.id, classId),
	});
	if (!classInfo) {
		throw ApiError.notFound("班级不存在");
	}

	const hasAccess =
		user.role === "admin" ||
		classInfo.teacherId === user.id ||
		(user.role === "student" && await hasApprovedMembership(db, classInfo.id, user.id));

	if (!hasAccess) {
		throw ApiError.forbidden("无权访问该班级");
	}

	const members = await db.query.classMembers.findMany({
		where: eq(classMembers.classId, classInfo.id),
		orderBy: [desc(classMembers.joinedAt)],
	});
	const isManager = user.role === "admin" || classInfo.teacherId === user.id;
	const visibleMembers = isManager
		? members
		: members.filter((member) => member.userId === user.id && member.status === "approved");

	return {
		...classInfo,
		memberCount: members.filter((member) => member.status === "approved").length,
		members: visibleMembers,
	};
}

export async function requestJoinClassByCode(
	user: SessionUser,
	classCode: string,
): Promise<ClassMemberSummary> {
	assertFormalUser(user);
	if (user.role !== "student") {
		throw ApiError.forbidden("只有学生账号可以申请加入班级");
	}

	const db = getClassDatabase();
	const normalizedCode = normalizeClassCode(classCode);
	const classInfo = await db.query.classes.findFirst({
		where: eq(classes.classCode, normalizedCode),
	});
	if (!classInfo) {
		throw ApiError.notFound("班级码对应的班级不存在");
	}

	const existing = await db.query.classMembers.findFirst({
		where: and(eq(classMembers.classId, classInfo.id), eq(classMembers.userId, user.id)),
	});
	if (existing) {
		throw duplicateMembershipError(existing.status);
	}

	try {
		const [created] = await db
			.insert(classMembers)
			.values({
				classId: classInfo.id,
				userId: user.id,
				status: "pending",
			})
			.returning();
		return created;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw ApiError.conflict("已存在该班级的申请或成员记录");
		}
		throw error;
	}
}

export async function listMembershipsForStudent(
	user: SessionUser,
): Promise<StudentClassMembership[]> {
	assertFormalUser(user);
	if (user.role !== "student") {
		throw ApiError.forbidden("只有学生账号可以查看自己的班级申请");
	}

	const db = getClassDatabase();
	const rows = await db
		.select({
			member: classMembers,
			classInfo: classes,
		})
		.from(classMembers)
		.innerJoin(classes, eq(classMembers.classId, classes.id))
		.where(eq(classMembers.userId, user.id))
		.orderBy(desc(classMembers.createdAt));

	if (rows.length === 0) return [];

	const classSummaries = await withMemberCounts(db, rows.map((row) => row.classInfo));
	const classById = new Map(classSummaries.map((classInfo) => [classInfo.id, classInfo]));

	return rows.map((row) => ({
		...row.member,
		class: classById.get(row.classInfo.id) ?? {
			...row.classInfo,
			memberCount: 0,
		},
	}));
}

export async function listClassMembersForTeacher(
	user: SessionUser,
	classId: string,
): Promise<ClassMemberWithUser[]> {
	assertFormalUser(user);
	if (user.role !== "teacher") {
		throw ApiError.forbidden("只有教师账号可以查看班级成员");
	}

	const db = getClassDatabase();
	await assertTeacherCanManageClass(db, classId, user.id);

	const rows = await db
		.select({
			member: classMembers,
			userInfo: {
				id: users.id,
				username: users.username,
				name: users.name,
				role: users.role,
			},
		})
		.from(classMembers)
		.innerJoin(users, eq(classMembers.userId, users.id))
		.where(eq(classMembers.classId, classId))
		.orderBy(desc(classMembers.createdAt));

	return rows.map(({ member, userInfo }) => ({
		...member,
		user: userInfo,
	}));
}

export async function reviewClassMember(
	user: SessionUser,
	classId: string,
	memberId: string,
	status: ReviewStatus,
): Promise<ClassMemberSummary> {
	assertFormalUser(user);
	if (user.role !== "teacher") {
		throw ApiError.forbidden("只有教师账号可以审核班级申请");
	}

	const db = getClassDatabase();
	await assertTeacherCanManageClass(db, classId, user.id);

	const [updated] = await db
		.update(classMembers)
		.set({
			status,
			joinedAt: status === "approved" ? new Date().toISOString() : undefined,
		})
		.where(and(
			eq(classMembers.id, memberId),
			eq(classMembers.classId, classId),
			eq(classMembers.status, "pending"),
		))
		.returning();

	if (updated) return updated;

	const existing = await db.query.classMembers.findFirst({
		where: and(eq(classMembers.id, memberId), eq(classMembers.classId, classId)),
	});
	if (!existing) {
		throw ApiError.notFound("班级申请不存在");
	}
	throw ApiError.conflict("该申请已被处理，不能重复审核");
}

export async function removeClassMember(
	user: SessionUser,
	classId: string,
	memberId: string,
): Promise<ClassMemberSummary> {
	assertFormalUser(user);
	if (user.role !== "teacher") {
		throw ApiError.forbidden("只有教师账号可以移除班级成员");
	}

	const db = getClassDatabase();
	await assertTeacherCanManageClass(db, classId, user.id);

	const [removed] = await db
		.delete(classMembers)
		.where(and(
			eq(classMembers.id, memberId),
			eq(classMembers.classId, classId),
			eq(classMembers.status, "approved"),
		))
		.returning();

	if (removed) return removed;

	const existing = await db.query.classMembers.findFirst({
		where: and(eq(classMembers.id, memberId), eq(classMembers.classId, classId)),
	});
	if (!existing) {
		throw ApiError.notFound("班级成员不存在");
	}
	throw ApiError.conflict("只能移除已批准加入的学生成员");
}

async function getOrCreateDefaultSchoolId(db: AppDatabase): Promise<string> {
	const existing = await db.query.schools.findFirst({
		where: eq(schools.name, DEFAULT_SCHOOL_NAME),
		columns: { id: true },
	});
	if (existing) return existing.id;

	const [created] = await db
		.insert(schools)
		.values({ name: DEFAULT_SCHOOL_NAME })
		.returning({ id: schools.id });
	return created.id;
}

async function hasApprovedMembership(
	db: AppDatabase,
	classId: string,
	userId: string,
): Promise<boolean> {
	const membership = await db.query.classMembers.findFirst({
		where: and(
			eq(classMembers.classId, classId),
			eq(classMembers.userId, userId),
			eq(classMembers.status, "approved"),
		),
		columns: { id: true },
	});
	return Boolean(membership);
}

async function assertTeacherCanManageClass(
	db: AppDatabase,
	classId: string,
	teacherId: string,
): Promise<typeof classes.$inferSelect> {
	const classInfo = await db.query.classes.findFirst({
		where: eq(classes.id, classId),
	});
	if (!classInfo) {
		throw ApiError.notFound("班级不存在");
	}
	if (classInfo.teacherId !== teacherId) {
		throw ApiError.forbidden("无权管理该班级");
	}
	return classInfo;
}

async function withMemberCounts<T extends typeof classes.$inferSelect>(
	db: AppDatabase,
	rows: T[],
): Promise<ClassSummary[]> {
	if (rows.length === 0) return [];

	const classIds = rows.map((row) => row.id);
	const members = await db.query.classMembers.findMany({
		where: and(
			inArray(classMembers.classId, classIds),
			or(eq(classMembers.status, "approved"), eq(classMembers.status, "pending")),
		),
		columns: { classId: true, status: true },
	});
	const approvedCounts = new Map<string, number>();
	for (const member of members) {
		if (member.status !== "approved") continue;
		approvedCounts.set(member.classId, (approvedCounts.get(member.classId) ?? 0) + 1);
	}

	return rows.map((row) => ({
		...row,
		memberCount: approvedCounts.get(row.id) ?? 0,
	}));
}

function createInternalClassCode(): string {
	return `CLS-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

function normalizeClassCode(classCode: string): string {
	const normalized = classCode.trim().toUpperCase();
	if (!normalized) {
		throw ApiError.badRequest("班级码不能为空");
	}
	if (normalized.length > 32) {
		throw ApiError.badRequest("班级码不能超过 32 个字符");
	}
	return normalized;
}

function duplicateMembershipError(status: ClassMemberStatus): ApiError {
	if (status === "pending") {
		return ApiError.conflict("已提交申请，等待教师审核");
	}
	if (status === "approved") {
		return ApiError.conflict("已加入该班级");
	}
	return ApiError.conflict("该班级申请已被拒绝，暂不能重复申请");
}

function isUniqueViolation(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error &&
		(error as { code?: unknown }).code === "23505";
}

function getClassDatabase(): AppDatabase {
	try {
		return getDatabase();
	} catch (error) {
		throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "数据库尚未配置，正式班级接口暂不可用", {
			httpStatus: 503,
			cause: error,
		});
	}
}
