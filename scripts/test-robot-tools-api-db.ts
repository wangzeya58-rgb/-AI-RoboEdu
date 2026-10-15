import "dotenv/config";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabase, getDatabasePool } from "../src/storage/database/db";
import { users } from "../src/storage/database/shared/schema";

const baseUrl = process.env.ROBOT_TOOL_API_TEST_BASE_URL ?? "http://127.0.0.1:5094";
const runId = `phase5_robot_${Date.now()}_${randomUUID().slice(0, 8)}`;
const testPassword = `LocalTest-${randomUUID()}-1a`;

type TestUser = {
	username: string;
	password: string;
	role: "teacher" | "student" | "admin";
	name: string;
};

const teacher: TestUser = {
	username: `${runId}_teacher`,
	password: testPassword,
	role: "teacher",
	name: "Phase 5 Robot Teacher",
};

const student: TestUser = {
	username: `${runId}_student`,
	password: testPassword,
	role: "student",
	name: "Phase 5 Robot Student",
};

const admin: TestUser = {
	username: `${runId}_admin`,
	password: testPassword,
	role: "admin",
	name: "Phase 5 Robot Admin",
};

async function main() {
	assertLocalDevelopmentDatabase();
	await cleanup();
	await seedUsers([teacher, student, admin]);

	try {
		await expectStatus("1. unauthenticated tool call returns 401", "/api/v1/robot/tools/get_status", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		}, 401);

		const teacherCookie = await login(teacher);
		const studentCookie = await login(student);
		const adminCookie = await login(admin);
		const demoTeacherCookie = await loginDemoTeacher();

		await expectStatus("2. student cannot call robot tool", "/api/v1/robot/tools/get_status", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentCookie },
			body: JSON.stringify({}),
		}, 403);

		await expectStatus("3. demo teacher cannot call formal robot tool", "/api/v1/robot/tools/get_status", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: demoTeacherCookie },
			body: JSON.stringify({}),
		}, 403);

		await expectStatus("4. unknown tool returns 400", "/api/v1/robot/tools/fly", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: teacherCookie },
			body: JSON.stringify({}),
		}, 400);

		await expectStatus("5. rotate requires direction", "/api/v1/robot/tools/rotate", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: teacherCookie },
			body: JSON.stringify({}),
		}, 400);

		await expectStatus("6. move_forward validates durationMs", "/api/v1/robot/tools/move_forward", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: teacherCookie },
			body: JSON.stringify({ durationMs: 6000 }),
		}, 400);

		await expectStatus("7. teacher gets robot disconnected error", "/api/v1/robot/tools/get_status", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: teacherCookie },
			body: JSON.stringify({}),
		}, 503);

		await expectStatus("8. admin can reach tool layer but gets disconnected error", "/api/v1/robot/tools/get_status", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: adminCookie },
			body: JSON.stringify({}),
		}, 503);

		console.log("Robot tool API DB integration test passed.");
	} finally {
		await cleanup();
		await getDatabasePool().end();
	}
}

function assertLocalDevelopmentDatabase() {
	const url = process.env.DATABASE_URL ?? "";
	const parsed = new URL(url);
	if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.endsWith("/ai_roboedu_dev")) {
		throw new Error("Refusing to run DB integration test: DATABASE_URL is not local ai_roboedu_dev.");
	}
}

async function seedUsers(testUsers: TestUser[]) {
	const db = getDatabase();
	await db.insert(users).values(testUsers.map((user) => ({
		username: user.username,
		passwordHash: hashPassword(user.password),
		name: user.name,
		role: user.role,
		classMenuLocked: false,
	})));
}

async function login(user: TestUser): Promise<string> {
	const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username: user.username, password: user.password }),
	});
	const body = await response.text();
	if (response.status !== 200) {
		throw new Error(`login ${user.role} expected 200, got ${response.status}: ${body}`);
	}
	const cookie = response.headers.get("set-cookie")?.split(";")[0];
	if (!cookie) throw new Error(`login ${user.role} did not return session cookie`);
	return cookie;
}

async function loginDemoTeacher(): Promise<string> {
	const response = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username: "teacher", password: "123456" }),
	});
	const body = await response.text();
	if (response.status !== 200) {
		throw new Error(`demo teacher login expected 200, got ${response.status}: ${body}`);
	}
	const cookie = response.headers.get("set-cookie")?.split(";")[0];
	if (!cookie) throw new Error("demo teacher login did not return session cookie");
	return cookie;
}

async function expectStatus(label: string, path: string, init: RequestInit, expectedStatus: number) {
	const response = await fetch(`${baseUrl}${path}`, init);
	const body = await response.text();
	if (response.status !== expectedStatus) {
		throw new Error(`${label} expected ${expectedStatus}, got ${response.status}: ${body}`);
	}
	console.log(`${label}: ${response.status}`);
}

async function cleanup() {
	const db = getDatabase();
	await db.delete(users).where(inArray(users.username, [teacher.username, student.username, admin.username]));
}

main().catch(async (error) => {
	console.error(error instanceof Error ? error.message : error);
	try {
		await cleanup();
		await getDatabasePool().end();
	} catch {
		// best-effort cleanup only
	}
	process.exitCode = 1;
});
