import {
	boolean,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["student", "teacher", "admin"]);
export const classMemberStatusEnum = pgEnum("class_member_status", [
	"pending",
	"approved",
	"rejected",
]);



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	reply: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("feedbacks_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("feedbacks_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "feedbacks_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const datasets = pgTable("datasets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	fileCount: integer("file_count").default(0).notNull(),
	size: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("datasets_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "datasets_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const smsCodes = pgTable("sms_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	phone: varchar({ length: 20 }).notNull(),
	code: varchar({ length: 6 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sms_codes_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("sms_codes_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: varchar({ length: 80 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	name: varchar({ length: 128 }).notNull(),
	role: userRoleEnum().default('student').notNull(),
	email: varchar({ length: 255 }),
	classMenuLocked: boolean("class_menu_locked").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	phone: varchar({ length: 20 }),
}, (table) => [
	index("users_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
	index("users_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
]);

export const schools = pgTable("schools", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	classCode: varchar("class_code", { length: 32 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	schoolId: uuid("school_id").notNull(),
	teacherId: uuid("teacher_id").notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("classes_school_id_idx").using("btree", table.schoolId.asc().nullsLast().op("uuid_ops")),
	index("classes_teacher_id_idx").using("btree", table.teacherId.asc().nullsLast().op("uuid_ops")),
	index("classes_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("uuid_ops")),
	unique("classes_class_code_unique").on(table.classCode),
	foreignKey({
			columns: [table.schoolId],
			foreignColumns: [schools.id],
			name: "classes_school_id_schools_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [users.id],
			name: "classes_teacher_id_users_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "classes_created_by_users_id_fk"
		}).onDelete("restrict"),
]);

export const classMembers = pgTable("class_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	classId: uuid("class_id").notNull(),
	userId: uuid("user_id").notNull(),
	status: classMemberStatusEnum().default("pending").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("class_members_class_id_idx").using("btree", table.classId.asc().nullsLast().op("uuid_ops")),
	index("class_members_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("class_members_status_idx").using("btree", table.status.asc().nullsLast()),
	unique("class_members_class_id_user_id_unique").on(table.classId, table.userId),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "class_members_class_id_classes_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "class_members_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const trainings = pgTable("trainings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	progress: integer().default(0).notNull(),
	hours: integer().notNull(),
	enrolled: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("trainings_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "trainings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const aiModels = pgTable("ai_models", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("ai_models_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "ai_models_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const helpCenters = pgTable("help_centers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	category: varchar({ length: 100 }),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("help_centers_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
]);

export const modelLibrary = pgTable("model_library", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	version: varchar({ length: 50 }).notNull(),
	description: text(),
	status: varchar({ length: 50 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("model_library_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "model_library_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const programFiles = pgTable("program_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	category: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	size: varchar({ length: 50 }).notNull(),
	fileType: varchar("file_type", { length: 50 }).notNull(),
	content: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("program_files_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("program_files_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "program_files_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const teachingResources = pgTable("teaching_resources", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: varchar({ length: 100 }).notNull(),
	count: varchar({ length: 100 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("teaching_resources_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "teaching_resources_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const courses = pgTable("courses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: text(),
	coverUrl: varchar("cover_url", { length: 500 }),
	teacherId: uuid("teacher_id").notNull(),
	teacherName: varchar("teacher_name", { length: 128 }),
	creatorRole: userRoleEnum("creator_role"),
	publicationScope: varchar("publication_scope", { length: 20 }).default('legacy').notNull(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	rejectReason: text("reject_reason"),
	durationMinutes: integer("duration_minutes").default(0),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewerId: uuid("reviewer_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("courses_teacher_id_idx").using("btree", table.teacherId.asc().nullsLast().op("uuid_ops")),
	index("courses_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("courses_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [users.id],
			name: "courses_teacher_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewerId],
			foreignColumns: [users.id],
			name: "courses_reviewer_id_users_id_fk"
		}).onDelete("set null"),
]);

export const courseMaterials = pgTable("course_materials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	courseId: uuid("course_id").notNull(),
	type: varchar({ length: 20 }).notNull(),
	url: varchar({ length: 500 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	size: integer().default(0).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("course_materials_course_id_idx").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "course_materials_course_id_courses_id_fk"
		}).onDelete("cascade"),
]);

export const lessons = pgTable("lessons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	courseId: uuid("course_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	order: integer("order").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("lessons_course_id_idx").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("lessons_course_id_order_idx").using("btree", table.courseId.asc().nullsLast().op("uuid_ops"), table.order.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "lessons_course_id_courses_id_fk"
		}).onDelete("cascade"),
]);

export const classCourses = pgTable("class_courses", {
	courseId: uuid("course_id").notNull(),
	classId: uuid("class_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("class_courses_course_id_idx").using("btree", table.courseId.asc().nullsLast().op("uuid_ops")),
	index("class_courses_class_id_idx").using("btree", table.classId.asc().nullsLast().op("uuid_ops")),
	unique("class_courses_course_id_class_id_unique").on(table.courseId, table.classId),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [courses.id],
			name: "class_courses_course_id_courses_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "class_courses_class_id_classes_id_fk"
		}).onDelete("cascade"),
]);

export const courseLearningProgress = pgTable("course_learning_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
	lastLessonId: uuid("last_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
	lastStudiedAt: timestamp("last_studied_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
	unique("course_learning_progress_user_course_unique").on(table.userId, table.courseId),
	index("course_learning_progress_course_idx").on(table.courseId),
]);

export const lessonCompletions = pgTable("lesson_completions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
	unique("lesson_completions_user_lesson_unique").on(table.userId, table.lessonId),
	index("lesson_completions_lesson_idx").on(table.lessonId),
]);
