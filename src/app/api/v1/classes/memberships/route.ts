import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { listMembershipsForStudent } from "@/lib/classes/server-class-service";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
	const user = requireSession(request);

	return {
		items: await listMembershipsForStudent(user),
	};
}, { methods: ["GET"] });
