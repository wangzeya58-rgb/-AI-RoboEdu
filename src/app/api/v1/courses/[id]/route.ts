import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { getCourseForUser } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

export const GET = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const courseId = uuid(id, "params.id");

	return getCourseForUser(user, courseId);
}, { methods: ["GET"] });
