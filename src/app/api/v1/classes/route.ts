import { requireRole, requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, string } from "@/lib/api/validation";
import {
	createClassForTeacher,
	listAllClassesForAdmin,
	listClassesForTeacher,
	listJoinedClassesForStudent,
	normalizeClassName,
} from "@/lib/classes/server-class-service";

export const runtime = "nodejs";

interface CreateClassBody {
	name: string;
}

export const GET = withApi(async (request) => {
	const user = requireSession(request);

	if (user.role === "teacher") {
		return {
			items: await listClassesForTeacher(user),
		};
	}

	if (user.role === "student") {
		return {
			items: await listJoinedClassesForStudent(user),
		};
	}

	requireRole(user, "admin");
	return {
		items: await listAllClassesForAdmin(user),
	};
}, { methods: ["GET"] });

export const POST = withApi(async (request) => {
	const user = requireSession(request);
	requireRole(user, "teacher");

	const body = await parseJson<CreateClassBody>(request, {
		name: required(string),
	});

	return createClassForTeacher(user, normalizeClassName(body.name));
}, { methods: ["POST"] });
