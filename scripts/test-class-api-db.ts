import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabase, getDatabasePool } from "../src/storage/database/db";
import { classMembers, classes, users } from "../src/storage/database/shared/schema";

const baseUrl = process.env.CLASS_API_TEST_BASE_URL ?? "http://127.0.0.1:5094";
const runId = `phase3c2c_${Date.now()}_${randomUUID().slice(0, 8)}`;
const testPassword = `LocalTest-${randomUUID()}-1a`;

type TestUser = {
	username: string;
	password: string;
	role: "teacher" | "student";
	name: string;
};

type ApiEnvelope<T> = {
	success: boolean;
	data: T;
	message?: string;
};

type ClassSummary = {
	id: string;
	name: string;
	teacherId: string;
	memberCount: number;
};

const teacherA: TestUser = {
	username: `${runId}_teacher_a`,
	password: testPassword,
	role: "teacher",
	name: "Phase 3C Teacher A",
};

const teacherB: TestUser = {
	username: `${runId}_teacher_b`,
	password: testPassword,
	role: "teacher",
	name: "Phase 3C Teacher B",
};

const student: TestUser = {
	username: `${runId}_student`,
	password: testPassword,
	role: "student",
	name: "Phase 3C Student",
};

async function main() {
	await cleanup();
	await seedUsers([teacherA, teacherB, student]);

	try {
		await expectStatus("1. unauthenticated class list", "/api/v1/classes", { method: "GET" }, 401);

		const teacherACookie = await login(teacherA);
		const teacherBCookie = await login(teacherB);
		const studentCookie = await login(student);

		const classA = await createClass(teacherACookie, `${runId} Teacher A Class`);
		const classB = await createClass(teacherBCookie, `${runId} Teacher B Class`);

		await expectClassInList("2. teacher A class list includes own class", teacherACookie, classA.id, true);
		await expectClassInList("3. teacher A class list excludes teacher B class", teacherACookie, classB.id, false);
		await expectStatus("4. teacher A class detail", `/api/v1/classes/${classA.id}`, {
			method: "GET",
			headers: { cookie: teacherACookie },
		}, 200);
		await expectStatus("5. teacher A forbidden from teacher B class", `/api/v1/classes/${classB.id}`, {
			method: "GET",
			headers: { cookie: teacherACookie },
		}, 403);

		await approveStudentForClass(classA.id);
		await expectClassInList("6. student class list includes approved class", studentCookie, classA.id, true);
		await expectStatus("7. student cannot create class", "/api/v1/classes", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentCookie },
			body: JSON.stringify({ name: `${runId} Student Forbidden Class` }),
		}, 403);
		await expectStatus("8. student forbidden from unrelated class", `/api/v1/classes/${classB.id}`, {
			method: "GET",
			headers: { cookie: studentCookie },
		}, 403);

		await expectStatus("9. missing class returns 404", `/api/v1/classes/${randomUUID()}`, {
			method: "GET",
			headers: { cookie: teacherACookie },
		}, 404);
		await expectStatus("10. invalid class id returns 400", "/api/v1/classes/not-a-uuid", {
			method: "GET",
			headers: { cookie: teacherACookie },
		}, 400);
		await expectStatus("11. demo teacher cannot write formal class", "/api/v1/classes", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: await demoTeacherCookie(),
			},
			body: JSON.stringify({ name: `${runId} Demo Forbidden Class` }),
		}, 403);

		console.log("Class API DB integration test passed.");
	} finally {
		await cleanup();
		await getDatabasePool().end();
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

async function demoTeacherCookie(): Promise<string> {
	const response = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username: "teacher", password: "123456" }),
	});
	const body = await response.text();
	if (response.status !== 200) {
		throw new Error(`demo login expected 200, got ${response.status}: ${body}`);
	}
	const cookie = response.headers.get("set-cookie")?.split(";")[0];
	if (!cookie) throw new Error("demo login did not return session cookie");
	return cookie;
}

async function createClass(cookie: string, name: string): Promise<ClassSummary> {
	const response = await fetch(`${baseUrl}/api/v1/classes`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ name }),
	});
	const body = await parseEnvelope<ClassSummary>(response);
	if (response.status !== 200 || !body.success) {
		throw new Error(`create class expected 200, got ${response.status}: ${JSON.stringify(body)}`);
	}
	console.log(`teacher created class: ${response.status}`);
	return body.data;
}

async function expectClassInList(label: string, cookie: string, classId: string, expected: boolean) {
	const response = await fetch(`${baseUrl}/api/v1/classes`, {
		method: "GET",
		headers: { cookie },
	});
	const body = await parseEnvelope<{ items: ClassSummary[] }>(response);
	if (response.status !== 200 || !body.success) {
		throw new Error(`${label} expected 200, got ${response.status}: ${JSON.stringify(body)}`);
	}
	const exists = body.data.items.some((item) => item.id === classId);
	if (exists !== expected) {
		throw new Error(`${label} expected class presence ${expected}, got ${exists}`);
	}
	console.log(`${label}: 200`);
}

async function approveStudentForClass(classId: string) {
	const db = getDatabase();
	const [studentUser] = await db.select({ id: users.id }).from(users).where(eq(users.username, student.username));
	if (!studentUser) throw new Error("test student was not found");
	await db.insert(classMembers).values({
		classId,
		userId: studentUser.id,
		status: "approved",
	});
}

async function expectStatus(label: string, path: string, init: RequestInit, expectedStatus: number) {
	const response = await fetch(`${baseUrl}${path}`, init);
	const body = await response.text();
	if (response.status !== expectedStatus) {
		throw new Error(`${label} expected ${expectedStatus}, got ${response.status}: ${body}`);
	}
	console.log(`${label}: ${response.status}`);
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
	return response.json() as Promise<ApiEnvelope<T>>;
}

async function cleanup() {
	const db = getDatabase();
	const testUsers = [teacherA.username, teacherB.username, student.username];
	await db.delete(classes).where(like(classes.name, `${runId}%`));
	await db.delete(users).where(inArray(users.username, testUsers));
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
