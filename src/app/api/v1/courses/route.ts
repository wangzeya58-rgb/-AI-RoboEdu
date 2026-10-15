import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { optional, parseJson, required, string } from "@/lib/api/validation";
import {
	createCourseForTeacher,
	listCoursesForTeacher,
} from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

interface CreateCourseBody {
	title: string;
	description?: string;
}

export const GET = withApi(async (request) => {
	const user = requireSession(request);

	return {
		items: await listCoursesForTeacher(user),
	};
}, { methods: ["GET"] });

export const POST = withApi(async (request) => {
	const user = requireSession(request);
	const body = await parseJson<CreateCourseBody>(request, {
		title: required(string),
		description: optional(string),
	});

	return createCourseForTeacher(user, body);
}, { methods: ["POST"] });
