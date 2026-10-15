import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { boolean, optional, parseJson, required, uuid } from "@/lib/api/validation";
import { getOwnCourseProgress, saveOwnCourseProgress } from "@/lib/courses/server-learning-progress-service";

export const runtime = "nodejs";

export const GET = withApi(async (request, context) => {
  const user = requireSession(request);
  const { id } = await context.params;
  return getOwnCourseProgress(user, uuid(id, "params.id"));
}, { methods: ["GET"] });

export const POST = withApi(async (request, context) => {
  const user = requireSession(request);
  const { id } = await context.params;
  const body = await parseJson<{ lessonId: string; completed?: boolean }>(request, { lessonId: required(uuid), completed: optional(boolean) });
  return saveOwnCourseProgress(user, uuid(id, "params.id"), body.lessonId, body.completed);
}, { methods: ["POST"] });
