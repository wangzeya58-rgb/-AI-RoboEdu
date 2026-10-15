import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { listOwnCourseProgress } from "@/lib/courses/server-learning-progress-service";

export const runtime = "nodejs";
export const GET = withApi(async (request) => ({ items: await listOwnCourseProgress(requireSession(request)) }), { methods: ["GET"] });
