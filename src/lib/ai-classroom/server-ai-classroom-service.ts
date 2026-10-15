import { and, eq } from "drizzle-orm";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { getCourseForUser, type CourseSummary } from "@/lib/courses/server-course-service";
import { isFormalUserId } from "@/lib/classes/server-class-service";
import { MAX_TEACHING_MESSAGES, MAX_TEACHING_MESSAGE_LENGTH, TEACHER_SYSTEM_PROMPT, buildTeachingReference, getLocalTeachingAnswer, getTeachingContentNotice, type TeachingMessage } from "./conversation";
import { getDatabase, type AppDatabase } from "@/storage/database/db";
import { lessons } from "@/storage/database/shared/schema";

const LOCAL_PROVIDER: AiClassroomProvider = {
	id: "local-rule-v1",
	name: "课程本地答疑",
	mode: "demo",
	async answer(context, question, history = []) {
		return getLocalTeachingAnswer(context.course.title, context.lesson.title, context.lesson.content, question, history);
	},
};

export interface AiLessonContext {
	course: CourseSummary;
	lesson: {
		id: string;
		courseId: string;
		title: string;
		content: string;
		order: number;
		createdAt: string;
	};
}

export interface AiClassroomContextResponse extends AiLessonContext {
	provider: AiProviderInfo;
}

export interface AiClassroomAnswerResponse extends AiClassroomContextResponse {
	question: string;
	answer: string;
}

interface AiProviderInfo {
	id: string;
	name: string;
	mode: "demo" | "llm";
}

interface AiClassroomProvider extends AiProviderInfo {
	answer(context: AiLessonContext, question: string, history?: TeachingMessage[]): Promise<string>;
}

export async function getAiLessonContext(
	user: SessionUser,
	courseId: string,
	lessonId: string,
): Promise<AiClassroomContextResponse> {
	const context = await loadAiLessonContext(user, courseId, lessonId);
	const provider = getActiveProvider();
	return {
		...context,
		provider: toProviderInfo(provider),
	};
}

export async function askAiLessonTeacher(
	user: SessionUser,
	courseId: string,
	lessonId: string,
	question: string,
	history: TeachingMessage[] = [],
): Promise<AiClassroomAnswerResponse> {
	const normalizedQuestion = normalizeQuestion(question);
	const safeHistory = validateTeachingHistory(history);
	const context = await loadAiLessonContext(user, courseId, lessonId);
	const provider = getActiveProvider();
	const answer = await provider.answer(context, normalizedQuestion, safeHistory);

	return {
		...context,
		provider: toProviderInfo(provider),
		question: normalizedQuestion,
		answer,
	};
}

async function loadAiLessonContext(
	user: SessionUser,
	courseId: string,
	lessonId: string,
): Promise<AiLessonContext> {
	assertFormalUser(user);
	const course = await getCourseForUser(user, courseId);
	const db = getAiDatabase();
	const lesson = await db.query.lessons.findFirst({
		where: and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)),
	});

	if (!lesson) {
		throw ApiError.notFound("章节不存在");
	}

	return { course, lesson };
}

function normalizeQuestion(question: string): string {
	const normalized = question.trim();
	if (!normalized) {
		throw ApiError.badRequest("问题不能为空");
	}
	if (normalized.length > 1000) {
		throw ApiError.badRequest("问题不能超过 1000 个字符");
	}
	return normalized;
}

function assertFormalUser(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能访问正式 AI 课堂数据");
	}
}

function toProviderInfo(provider: AiClassroomProvider): AiProviderInfo {
	return {
		id: provider.id,
		name: provider.name,
		mode: provider.mode,
	};
}

export function getActiveProvider(): AiClassroomProvider {
	const providerName = (process.env.AI_CLASSROOM_PROVIDER ?? "local").trim().toLowerCase();
	if (providerName === "local" || providerName === "demo" || providerName === "") {
		return LOCAL_PROVIDER;
	}

	if (providerName === "openai" || providerName === "openai-compatible") {
		return createOpenAiCompatibleProvider();
	}

	throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, `不支持的 AI 课堂 provider：${providerName}`, {
		httpStatus: 503,
	});
}

export function createOpenAiCompatibleProvider(): AiClassroomProvider {
	const apiKey = process.env.AI_CLASSROOM_API_KEY ?? process.env.OPENAI_API_KEY;
	const baseUrl = normalizeBaseUrl(process.env.AI_CLASSROOM_BASE_URL ?? "https://api.openai.com/v1");
	const model = process.env.AI_CLASSROOM_MODEL ?? "gpt-4o-mini";
	const timeoutMs = Number(process.env.AI_CLASSROOM_TIMEOUT_MS ?? 30000);

	if (!apiKey?.trim()) {
		throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "AI 课堂 LLM API Key 未配置", {
			httpStatus: 503,
		});
	}

	return {
		id: "openai-compatible-v1",
		name: "OpenAI Compatible LLM",
		mode: "llm",
		async answer(context, question, history = []) {
			const safeHistory = validateTeachingHistory(history);
			const notice = getTeachingContentNotice(context.lesson.content);
			if (notice) return notice;
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000);

			try {
				const response = await fetch(`${baseUrl}/chat/completions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${apiKey}`,
					},
					body: JSON.stringify({
						model,
						temperature: 0.3,
						messages: [
								{
									role: "system",
									content:
										TEACHER_SYSTEM_PROMPT,
							},
							{ role: "user", content: buildLlmPrompt(context) },
							...safeHistory,
							{
								role: "user",
								content: question,
							},
						],
					}),
					signal: controller.signal,
				});

				const body = (await response.json().catch(() => null)) as OpenAiChatResponse | null;
				if (!response.ok) {
					throw new ApiError(ErrorCode.UPSTREAM_ERROR, body?.error?.message ?? "AI 课堂 LLM 调用失败", {
						httpStatus: response.status >= 500 ? 502 : 400,
						details: { providerStatus: response.status },
					});
				}

				const answer = body?.choices?.[0]?.message?.content?.trim();
				if (!answer) {
					throw new ApiError(ErrorCode.UPSTREAM_ERROR, "AI 课堂 LLM 未返回有效回答", {
						httpStatus: 502,
					});
				}

				return answer;
			} catch (error) {
				if (error instanceof ApiError) throw error;
				if (controller.signal.aborted) {
					throw new ApiError(ErrorCode.UPSTREAM_ERROR, "AI 课堂 LLM 请求超时", { httpStatus: 502 });
				}
				throw new ApiError(ErrorCode.UPSTREAM_ERROR, "AI 课堂 LLM 服务暂不可用", {
					httpStatus: 502,
					cause: error,
				});
			} finally {
				clearTimeout(timeout);
			}
		},
	};
}

interface OpenAiChatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	error?: {
		message?: string;
	};
}

function buildLlmPrompt(context: AiLessonContext): string {
	return buildTeachingReference({
		courseTitle: context.course.title,
		courseDescription: context.course.description ?? "",
		lessonTitle: context.lesson.title,
		lessonContent: context.lesson.content,
	});
}

export function validateTeachingHistory(value: unknown): TeachingMessage[] {
	if (!Array.isArray(value) || value.length > MAX_TEACHING_MESSAGES) {
		throw ApiError.badRequest(`对话历史最多包含 ${MAX_TEACHING_MESSAGES} 条消息`);
	}
	return value.map((item: unknown) => {
		if (!item || typeof item !== "object" || !("role" in item) || !("content" in item)) {
			throw ApiError.badRequest("对话历史格式不正确");
		}
		if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string" || !item.content.trim() || item.content.length > MAX_TEACHING_MESSAGE_LENGTH) {
			throw ApiError.badRequest("对话历史只允许有效的学生与老师消息");
		}
		return { role: item.role, content: item.content.trim() };
	});
}

function normalizeBaseUrl(value: string): string {
	return value.trim().replace(/\/+$/, "");
}


function getAiDatabase(): AppDatabase {
	try {
		return getDatabase();
	} catch (error) {
		throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "数据库尚未配置，AI 课堂接口暂不可用", {
			httpStatus: 503,
			cause: error,
		});
	}
}
