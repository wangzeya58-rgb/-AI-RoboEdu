import { requireSession } from "@/lib/api/auth";
import { withApi } from "@/lib/api/handler";
import { optional, parseJson, required, string, uuid } from "@/lib/api/validation";
import type { TeachingMessage } from "@/lib/ai-classroom/conversation";
import {
	askAiLessonTeacher,
	getAiLessonContext,
	validateTeachingHistory,
} from "@/lib/ai-classroom/server-ai-classroom-service";

export const runtime = "nodejs";

interface AskAiBody {
	question: string;
	history?: TeachingMessage[];
}

export const GET = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id, lessonId } = await context.params;
	const courseId = uuid(id, "params.id");
	const safeLessonId = uuid(lessonId, "params.lessonId");

	return getAiLessonContext(user, courseId, safeLessonId);
}, { methods: ["GET"] });

export const POST = withApi(async (request, context) => {
	const user = requireSession(request);
	const { id, lessonId } = await context.params;
	const courseId = uuid(id, "params.id");
	const safeLessonId = uuid(lessonId, "params.lessonId");
	const body = await parseJson<AskAiBody>(request, {
		question: required(string),
		history: optional(validateTeachingHistory),
	});

	return askAiLessonTeacher(user, courseId, safeLessonId, body.question, body.history);
}, { methods: ["POST"] });
