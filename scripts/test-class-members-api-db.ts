import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabase, getDatabasePool } from "../src/storage/database/db";
import { classes, users } from "../src/storage/database/shared/schema";

const baseUrl = process.env.CLASS_API_TEST_BASE_URL ?? "http://127.0.0.1:5094";
const runId = `phase3c4a_${Date.now()}_${randomUUID().slice(0, 8)}`;
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
	classCode: string;
	name: string;
	teacherId: string;
	memberCount: number;
};

type ClassMember = {
	id: string;
	classId: string;
	userId: string;
	status: "pending" | "approved" | "rejected";
};

const teacherA: TestUser = {
	username: `${runId}_teacher_a`,
	password: testPassword,
	role: "teacher",
	name: "Phase 3C-4A Teacher A",
};

const teacherB: TestUser = {
	username: `${runId}_teacher_b`,
	password: testPassword,
	role: "teacher",
	name: "Phase 3C-4A Teacher B",
};

const studentA: TestUser = {
	username: `${runId}_student_a`,
	password: testPassword,
	role: "student",
	name: "Phase 3C-4A Student A",
};

const studentB: TestUser = {
	username: `${runId}_student_b`,
	password: testPassword,
	role: "student",
	name: "Phase 3C-4A Student B",
};

async function main() {
	assertLocalDevelopmentDatabase();
	await cleanup();
	await seedUsers([teacherA, teacherB, studentA, studentB]);

	try {
		await expectStatus("1. unauthenticated join returns 401", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ classCode: "CLS-NOSESSION" }),
		}, 401);

		const teacherACookie = await login(teacherA);
		const teacherBCookie = await login(teacherB);
		const studentACookie = await login(studentA);
		const studentBCookie = await login(studentB);
		const demoStudent = await demoCookie("student");
		const demoTeacher = await demoCookie("teacher");

		const classA = await createClass(teacherACookie, `${runId} Teacher A Class`);
		const classB = await createClass(teacherBCookie, `${runId} Teacher B Class`);

		const pendingA = await joinClass(studentACookie, classA.classCode);
		await expectStatus("2. duplicate pending join returns 409", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentACookie },
			body: JSON.stringify({ classCode: classA.classCode }),
		}, 409);
		await expectMemberStatus("3. teacher sees pending application", teacherACookie, classA.id, pendingA.id, "pending");

		await expectStatus("4. teacher B cannot review teacher A application", memberPath(classA.id, pendingA.id), {
			method: "PATCH",
			headers: { "content-type": "application/json", cookie: teacherBCookie },
			body: JSON.stringify({ status: "approved" }),
		}, 403);
		await expectStatus("5. student cannot self approve", memberPath(classA.id, pendingA.id), {
			method: "PATCH",
			headers: { "content-type": "application/json", cookie: studentACookie },
			body: JSON.stringify({ status: "approved" }),
		}, 403);

		await reviewMember(teacherACookie, classA.id, pendingA.id, "approved");
		await expectStatus("6. repeat review returns 409", memberPath(classA.id, pendingA.id), {
			method: "PATCH",
			headers: { "content-type": "application/json", cookie: teacherACookie },
			body: JSON.stringify({ status: "rejected" }),
		}, 409);
		await expectStudentMembership("7. approved student can see membership", studentACookie, classA.id, "approved");
		await expectStatus("8. approved student can access class detail", `/api/v1/classes/${classA.id}`, {
			method: "GET",
			headers: { cookie: studentACookie },
		}, 200);
		await expectMemberStatus("9. teacher sees approved member", teacherACookie, classA.id, pendingA.id, "approved");

		await removeMember(teacherACookie, classA.id, pendingA.id);
		await expectStatus("10. removed student loses class detail access", `/api/v1/classes/${classA.id}`, {
			method: "GET",
			headers: { cookie: studentACookie },
		}, 403);
		const reapplied = await joinClass(studentACookie, classA.classCode);
		if (reapplied.status !== "pending") {
			throw new Error(`reapply expected pending, got ${reapplied.status}`);
		}
		console.log("11. removed student can reapply: 200");

		const pendingB = await joinClass(studentBCookie, classB.classCode);
		await reviewMember(teacherBCookie, classB.id, pendingB.id, "rejected");
		await expectStudentMembership("12. rejected application is visible to student", studentBCookie, classB.id, "rejected");
		await expectStatus("13. rejected student cannot duplicate join", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentBCookie },
			body: JSON.stringify({ classCode: classB.classCode }),
		}, 409);

		await expectStatus("14. student cannot access unrelated class", `/api/v1/classes/${classB.id}`, {
			method: "GET",
			headers: { cookie: studentACookie },
		}, 403);
		await expectStatus("15. missing class code returns 404", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentACookie },
			body: JSON.stringify({ classCode: "CLS-NOTFOUND" }),
		}, 404);
		await expectStatus("16. empty class code returns 400", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: studentACookie },
			body: JSON.stringify({ classCode: "" }),
		}, 400);
		await expectStatus("17. missing class members returns 404", `/api/v1/classes/${randomUUID()}/members`, {
			method: "GET",
			headers: { cookie: teacherACookie },
		}, 404);
		await expectStatus("18. invalid member id returns 400", `/api/v1/classes/${classA.id}/members/not-a-uuid`, {
			method: "DELETE",
			headers: { cookie: teacherACookie },
		}, 400);
		await expectStatus("19. demo student cannot write formal membership", "/api/v1/classes/join", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: demoStudent },
			body: JSON.stringify({ classCode: classA.classCode }),
		}, 403);
		await expectStatus("20. demo teacher cannot read formal members", `/api/v1/classes/${classA.id}/members`, {
			method: "GET",
			headers: { cookie: demoTeacher },
		}, 403);

		console.log("Class member API DB integration test passed.");
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

async function demoCookie(username: "student" | "teacher"): Promise<string> {
	const response = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username, password: "123456" }),
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

async function joinClass(cookie: string, classCode: string): Promise<ClassMember> {
	const response = await fetch(`${baseUrl}/api/v1/classes/join`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ classCode }),
	});
	const body = await parseEnvelope<ClassMember>(response);
	if (response.status !== 200 || !body.success) {
		throw new Error(`join class expected 200, got ${response.status}: ${JSON.stringify(body)}`);
	}
	console.log(`student join request: ${response.status}`);
	return body.data;
}

async function reviewMember(
	cookie: string,
	classId: string,
	memberId: string,
	status: "approved" | "rejected",
) {
	const response = await fetch(`${baseUrl}${memberPath(classId, memberId)}`, {
		method: "PATCH",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ status }),
	});
	const body = await parseEnvelope<ClassMember>(response);
	if (response.status !== 200 || !body.success || body.data.status !== status) {
		throw new Error(`review member expected 200/${status}, got ${response.status}: ${JSON.stringify(body)}`);
	}
	console.log(`teacher review ${status}: ${response.status}`);
}

async function removeMember(cookie: string, classId: string, memberId: string) {
	const response = await fetch(`${baseUrl}${memberPath(classId, memberId)}`, {
		method: "DELETE",
		headers: { cookie },
	});
	const body = await parseEnvelope<ClassMember>(response);
	if (response.status !== 200 || !body.success || body.data.status !== "approved") {
		throw new Error(`remove member expected 200/approved, got ${response.status}: ${JSON.stringify(body)}`);
	}
	console.log(`teacher remove approved member: ${response.status}`);
}

async function expectMemberStatus(
	label: string,
	cookie: string,
	classId: string,
	memberId: string,
	status: ClassMember["status"],
) {
	const response = await fetch(`${baseUrl}/api/v1/classes/${classId}/members`, {
		method: "GET",
		headers: { cookie },
	});
	const body = await parseEnvelope<{ items: ClassMember[] }>(response);
	if (response.status !== 200 || !body.success) {
		throw new Error(`${label} expected 200, got ${response.status}: ${JSON.stringify(body)}`);
	}
	const member = body.data.items.find((item) => item.id === memberId);
	if (member?.status !== status) {
		throw new Error(`${label} expected ${status}, got ${member?.status ?? "missing"}`);
	}
	console.log(`${label}: 200`);
}

async function expectStudentMembership(
	label: string,
	cookie: string,
	classId: string,
	status: ClassMember["status"],
) {
	const response = await fetch(`${baseUrl}/api/v1/classes/memberships`, {
		method: "GET",
		headers: { cookie },
	});
	const body = await parseEnvelope<{ items: Array<ClassMember & { class: ClassSummary }> }>(response);
	if (response.status !== 200 || !body.success) {
		throw new Error(`${label} expected 200, got ${response.status}: ${JSON.stringify(body)}`);
	}
	const member = body.data.items.find((item) => item.class.id === classId);
	if (member?.status !== status) {
		throw new Error(`${label} expected ${status}, got ${member?.status ?? "missing"}`);
	}
	console.log(`${label}: 200`);
}

async function expectStatus(label: string, path: string, init: RequestInit, expectedStatus: number) {
	const response = await fetch(`${baseUrl}${path}`, init);
	const body = await response.text();
	if (response.status !== expectedStatus) {
		throw new Error(`${label} expected ${expectedStatus}, got ${response.status}: ${body}`);
	}
	console.log(`${label}: ${response.status}`);
}

function memberPath(classId: string, memberId: string): string {
	return `/api/v1/classes/${classId}/members/${memberId}`;
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
	return response.json() as Promise<ApiEnvelope<T>>;
}

async function cleanup() {
	const db = getDatabase();
	const testUsers = [teacherA.username, teacherB.username, studentA.username, studentB.username];
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
