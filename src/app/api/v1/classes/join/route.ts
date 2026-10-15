import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, string } from "@/lib/api/validation";
import { requestJoinClassByCode } from "@/lib/classes/server-class-service";

export const runtime = "nodejs";

interface JoinClassBody {
	classCode: string;
}

export const POST = withApi(async (request) => {
	const user = requireSession(request);
	const body = await parseJson<JoinClassBody>(request, {
		classCode: required(string),
	});

	return requestJoinClassByCode(user, body.classCode);
}, { methods: ["POST"] });
