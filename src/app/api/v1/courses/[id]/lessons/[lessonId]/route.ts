import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, string, uuid } from "@/lib/api/validation";
import { updateLessonForCourse } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

export const PATCH = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id, lessonId } = await context.params;
	const courseId = uuid(id, "params.id");
	const safeLessonId = uuid(lessonId, "params.lessonId");
	const body = await parseJson<{ title: string; content: string }>(request, {
		title: required(string),
		content: required(string),
	});
	return updateLessonForCourse(user, courseId, safeLessonId, body);
}, { methods: ["PATCH"] });
