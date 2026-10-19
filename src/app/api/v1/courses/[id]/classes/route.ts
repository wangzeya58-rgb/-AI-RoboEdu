import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, uuid } from "@/lib/api/validation";
import { publishCourseToClass, unpublishCourseFromClass } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";

interface PublishCourseBody {
	classId: string;
}

export const POST = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const courseId = uuid(id, "params.id");
	const body = await parseJson<PublishCourseBody>(request, {
		classId: required(uuid),
	});

	return publishCourseToClass(user, courseId, body.classId);
}, { methods: ["POST"] });

export const DELETE = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const body = await parseJson<PublishCourseBody>(request, { classId: required(uuid) });
	return unpublishCourseFromClass(user, uuid(id, "params.id"), body.classId);
}, { methods: ["DELETE"] });
