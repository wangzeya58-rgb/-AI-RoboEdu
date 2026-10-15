import { requireSession } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApi } from "@/lib/api/handler";
import {
	callRobotTool,
	parseRobotToolName,
	type RobotToolName,
} from "@/lib/robot/server-robot-tool-service";

export const runtime = "nodejs";

interface RobotToolBody {
	durationMs?: number;
	direction?: "left" | "right";
}

export const POST = withApi(async (request, context) => {
	const user = requireSession(request);
	const { tool: rawTool } = await context.params;
	const tool = parseRobotToolName(rawTool);
	const body = await readRobotToolBody(request, tool);

	return callRobotTool(user, tool, body);
}, { methods: ["POST"] });

async function readRobotToolBody(request: Request, tool: RobotToolName): Promise<RobotToolBody> {
	const body = await request.json().catch(() => ({})) as Record<string, unknown>;
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return {};
	}

	const output: RobotToolBody = {};

	if ("durationMs" in body) {
		if (typeof body.durationMs !== "number") {
			throw ApiError.badRequest("durationMs 必须是数字");
		}
		output.durationMs = body.durationMs;
	}

	if ("direction" in body) {
		if (body.direction !== "left" && body.direction !== "right") {
			throw ApiError.badRequest("direction 必须是 left 或 right");
		}
		output.direction = body.direction;
	}

	if (tool === "rotate" && !output.direction) {
		throw ApiError.badRequest("direction 必须是 left 或 right");
	}

	return output;
}
