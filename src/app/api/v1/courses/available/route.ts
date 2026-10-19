import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { listAvailableCourses } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";
export const GET = withApi(async (request) => ({ items: await listAvailableCourses(requireSession(request)) }), { methods: ["GET"] });
