import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { integer, parseJson, required, string, uuid } from "@/lib/api/validation";
import {
	addLessonToCourse,
	listLessonsForCourse,
} from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

interface CreateLessonBody {
	title: string;
	content: string;
	order: number;
}

export const GET = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const courseId = uuid(id, "params.id");

	return {
		items: await listLessonsForCourse(user, courseId),
	};
}, { methods: ["GET"] });

export const POST = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const courseId = uuid(id, "params.id");
	const body = await parseJson<CreateLessonBody>(request, {
		title: required(string),
		content: required(string),
		order: required(integer),
	});

	return addLessonToCourse(user, courseId, body);
}, { methods: ["POST"] });
