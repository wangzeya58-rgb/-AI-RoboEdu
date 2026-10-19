import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { uuid } from "@/lib/api/validation";
import { publishPublicCourse } from "@/lib/courses/server-course-service";

export const runtime = "nodejs";
export const POST = withApi(async (request, context) => publishPublicCourse(requireSession(request), uuid((await context.params).id, "params.id"), true), { methods: ["POST"] });
export const DELETE = withApi(async (request, context) => publishPublicCourse(requireSession(request), uuid((await context.params).id, "params.id"), false), { methods: ["DELETE"] });
