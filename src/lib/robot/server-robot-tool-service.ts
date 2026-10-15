import { ApiError, ErrorCode } from "@/lib/api/errors";
import type { SessionUser } from "@/lib/api/auth";
import { isFormalUserId } from "@/lib/classes/server-class-service";

export const ROBOT_TOOLS = ["move_forward", "stop", "rotate", "get_status"] as const;

export type RobotToolName = (typeof ROBOT_TOOLS)[number];
type RotateDirection = "left" | "right";

interface RobotToolResult {
	tool: RobotToolName;
	baseUrl: string;
	calledEndpoint: string;
	result: unknown;
}

interface RobotToolInput {
	durationMs?: number;
	direction?: RotateDirection;
}

export function parseRobotToolName(value: string): RobotToolName {
	if ((ROBOT_TOOLS as readonly string[]).includes(value)) {
		return value as RobotToolName;
	}
	throw ApiError.badRequest(`不支持的机器人工具：${value}`);
}

export async function callRobotTool(
	user: SessionUser,
	tool: RobotToolName,
	input: RobotToolInput,
): Promise<RobotToolResult> {
	assertRobotToolUser(user);

	switch (tool) {
		case "get_status":
			return callFastApiTool(tool, "/api/ros/status", { method: "GET" });
		case "stop":
			return callStopTool();
		case "move_forward":
			normalizeOptionalDuration(input.durationMs);
			return callFastApiTool(tool, "/api/ros/manual/start", {
				method: "POST",
				body: JSON.stringify({ action: "forward" }),
			});
		case "rotate":
			return callFastApiTool(tool, "/api/ros/manual/start", {
				method: "POST",
				body: JSON.stringify({ action: toRotateAction(input.direction) }),
			});
		default:
			return assertNever(tool);
	}
}

export function detectRobotToolIntent(answer: string): RobotToolName | null {
	const normalized = answer.toLowerCase();
	if (normalized.includes("move_forward") || normalized.includes("前进")) return "move_forward";
	if (normalized.includes("rotate_left") || normalized.includes("左转")) return "rotate";
	if (normalized.includes("rotate_right") || normalized.includes("右转")) return "rotate";
	if (normalized.includes("stop") || normalized.includes("停止")) return "stop";
	if (normalized.includes("get_status") || normalized.includes("状态")) return "get_status";
	return null;
}

async function callStopTool(): Promise<RobotToolResult> {
	const manualStop = await callFastApiTool("stop", "/api/ros/manual/stop", { method: "POST" });
	try {
		await callFastApiTool("stop", "/api/ros/stop", { method: "POST" });
	} catch {
		// Manual stop is enough to end an active manual command; emergency stop remains best-effort here.
	}
	return manualStop;
}

async function callFastApiTool(
	tool: RobotToolName,
	path: string,
	init: RequestInit,
): Promise<RobotToolResult> {
	const baseUrl = getRobotToolBaseUrl();
	const endpoint = `${baseUrl}${path}`;
	let response: Response;
	try {
		response = await fetch(endpoint, {
			...init,
			headers: {
				"Content-Type": "application/json",
				...(init.headers ?? {}),
			},
		});
	} catch (error) {
		throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "机器人控制主机未连接或不可访问", {
			httpStatus: 503,
			cause: error,
			details: { endpoint: path },
		});
	}

	const result = await parseFastApiResponse(response);
	if (!response.ok) {
		throw new ApiError(ErrorCode.UPSTREAM_ERROR, getFastApiErrorMessage(result, response.status), {
			httpStatus: response.status >= 500 ? 502 : 400,
			details: { endpoint: path, status: response.status, result },
		});
	}

	return {
		tool,
		baseUrl,
		calledEndpoint: path,
		result,
	};
}

async function parseFastApiResponse(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

function getFastApiErrorMessage(result: unknown, status: number): string {
	if (typeof result === "object" && result && "message" in result) {
		return String((result as { message?: unknown }).message);
	}
	return `机器人控制主机请求失败 (HTTP ${status})`;
}

function assertRobotToolUser(user: SessionUser): void {
	if (!isFormalUserId(user.id)) {
		throw ApiError.forbidden("Demo 身份不能调用正式机器人工具");
	}
	if (user.role !== "teacher" && user.role !== "admin") {
		throw ApiError.forbidden("当前身份无权调用机器人工具");
	}
}

function normalizeOptionalDuration(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value <= 0 || value > 5000) {
		throw ApiError.badRequest("durationMs 必须是 1 到 5000 之间的整数");
	}
	return value;
}

function toRotateAction(direction: RotateDirection | undefined): "rotate_left" | "rotate_right" {
	if (direction === "left") return "rotate_left";
	if (direction === "right") return "rotate_right";
	throw ApiError.badRequest("direction 必须是 left 或 right");
}

function getRobotToolBaseUrl(): string {
	return (process.env.ROBOT_TOOL_BASE_URL ?? process.env.CAR_CONTROL_API_BASE ?? "http://127.0.0.1:8000")
		.trim()
		.replace(/\/+$/, "");
}

function assertNever(value: never): never {
	throw ApiError.badRequest(`不支持的机器人工具：${String(value)}`);
}
