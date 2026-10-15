import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { oneOf, parseJson, required, uuid } from "@/lib/api/validation";
import {
	removeClassMember,
	reviewClassMember,
} from "@/lib/classes/server-class-service";

export const runtime = "nodejs";

interface ReviewMemberBody {
	status: "approved" | "rejected";
}

export const PATCH = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id, memberId } = await context.params;
	const classId = uuid(id, "params.id");
	const parsedMemberId = uuid(memberId, "params.memberId");
	const body = await parseJson<ReviewMemberBody>(request, {
		status: required(oneOf(["approved", "rejected"] as const)),
	});

	return reviewClassMember(user, classId, parsedMemberId, body.status);
}, { methods: ["PATCH"] });

export const DELETE = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id, memberId } = await context.params;
	const classId = uuid(id, "params.id");
	const parsedMemberId = uuid(memberId, "params.memberId");

	return removeClassMember(user, classId, parsedMemberId);
}, { methods: ["DELETE"] });
