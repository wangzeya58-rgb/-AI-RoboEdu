import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { getClassCourseProgress } from "@/lib/courses/server-learning-progress-service";

export const runtime = "nodejs";
export const GET = withApi(async (request, context) => {
  const user = requireSession(request);
  const { id, courseId } = await context.params;
  return getClassCourseProgress(user, uuid(id, "params.id"), uuid(courseId, "params.courseId"));
}, { methods: ["GET"] });
