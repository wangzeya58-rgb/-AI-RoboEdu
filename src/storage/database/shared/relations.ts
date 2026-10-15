import { relations } from "drizzle-orm/relations";
import {
	aiModels,
	classMembers,
	classes,
	courseMaterials,
	courses,
	datasets,
	feedbacks,
	modelLibrary,
	programFiles,
	schools,
	teachingResources,
	trainings,
	users,
} from "./schema";

export const feedbacksRelations = relations(feedbacks, ({one}) => ({
	user: one(users, {
		fields: [feedbacks.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	feedbacks: many(feedbacks),
	datasets: many(datasets),
	trainings: many(trainings),
	aiModels: many(aiModels),
	modelLibraries: many(modelLibrary),
	programFiles: many(programFiles),
	teachingResources: many(teachingResources),
	createdClasses: many(classes),
	teachingClasses: many(classes, { relationName: "classTeacher" }),
	classMemberships: many(classMembers),
	courses: many(courses, { relationName: "teacherCourses" }),
	reviewedCourses: many(courses, { relationName: "reviewedCourses" }),
}));

export const schoolsRelations = relations(schools, ({many}) => ({
	classes: many(classes),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
	school: one(schools, {
		fields: [classes.schoolId],
		references: [schools.id]
	}),
	teacher: one(users, {
		fields: [classes.teacherId],
		references: [users.id],
		relationName: "classTeacher"
	}),
	creator: one(users, {
		fields: [classes.createdBy],
		references: [users.id]
	}),
	members: many(classMembers),
}));

export const classMembersRelations = relations(classMembers, ({one}) => ({
	class: one(classes, {
		fields: [classMembers.classId],
		references: [classes.id]
	}),
	user: one(users, {
		fields: [classMembers.userId],
		references: [users.id]
	}),
}));

export const datasetsRelations = relations(datasets, ({one}) => ({
	user: one(users, {
		fields: [datasets.userId],
		references: [users.id]
	}),
}));

export const trainingsRelations = relations(trainings, ({one}) => ({
	user: one(users, {
		fields: [trainings.userId],
		references: [users.id]
	}),
}));

export const aiModelsRelations = relations(aiModels, ({one}) => ({
	user: one(users, {
		fields: [aiModels.userId],
		references: [users.id]
	}),
}));

export const modelLibraryRelations = relations(modelLibrary, ({one}) => ({
	user: one(users, {
		fields: [modelLibrary.userId],
		references: [users.id]
	}),
}));

export const programFilesRelations = relations(programFiles, ({one}) => ({
	user: one(users, {
		fields: [programFiles.userId],
		references: [users.id]
	}),
}));

export const teachingResourcesRelations = relations(teachingResources, ({one}) => ({
	user: one(users, {
		fields: [teachingResources.userId],
		references: [users.id]
	}),
}));

export const coursesRelations = relations(courses, ({one, many}) => ({
	teacher: one(users, {
		fields: [courses.teacherId],
		references: [users.id],
		relationName: "teacherCourses"
	}),
	reviewer: one(users, {
		fields: [courses.reviewerId],
		references: [users.id],
		relationName: "reviewedCourses"
	}),
	materials: many(courseMaterials),
}));

export const courseMaterialsRelations = relations(courseMaterials, ({one}) => ({
	course: one(courses, {
		fields: [courseMaterials.courseId],
		references: [courses.id]
	}),
}));
