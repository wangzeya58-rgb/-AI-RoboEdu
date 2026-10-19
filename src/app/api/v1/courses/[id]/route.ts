import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { optional, parseJson, required, string, uuid } from "@/lib/api/validation";
import { deleteCourseForUser, getCourseForUser, updateCourseForUser } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

export const GET = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const courseId = uuid(id, "params.id");

	return getCourseForUser(user, courseId);
}, { methods: ["GET"] });

export const PATCH = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const body = await parseJson<{ title: string; description?: string }>(request, {
		title: required(string), description: optional(string),
	});
	return updateCourseForUser(user, uuid(id, "params.id"), body);
}, { methods: ["PATCH"] });

export const DELETE = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	return deleteCourseForUser(user, uuid(id, "params.id"));
}, { methods: ["DELETE"] });
