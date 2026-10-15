import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { getClassDetailForUser } from "@/lib/classes/server-class-service";

export const runtime = "nodejs";

export const GET = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id } = await context.params;
	const classId = uuid(id, "params.id");

	return getClassDetailForUser(user, classId);
}, { methods: ["GET"] });
