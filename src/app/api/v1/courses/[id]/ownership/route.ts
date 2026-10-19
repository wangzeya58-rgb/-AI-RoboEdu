import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { parseJson, required, uuid } from "@/lib/api/validation";
import { confirmCourseOwnership } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";
export const POST = withApi(async (request, context) => {
  const user = requireSession(request);
  const body = await parseJson<{ creatorId: string }>(request, { creatorId: required(uuid) });
  return confirmCourseOwnership(user, uuid((await context.params).id, "params.id"), body.creatorId);
}, { methods: ["POST"] });
