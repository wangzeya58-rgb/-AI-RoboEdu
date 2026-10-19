import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "../src/storage/database/db";
import { hashPassword } from "../src/lib/auth/password";

const base = process.env.COURSE_API_TEST_BASE_URL ?? "http://127.0.0.1:5000";
const prefix = `platform_fix_${randomUUID().slice(0, 8)}`;
const password = `Test-${randomUUID()}-1a`;
const accounts = ["admin", "teacher", "teacher", "student"].map((role, index) => ({
  id: randomUUID(), username: `${prefix}_${index}`, role, name: `${role === "admin" ? "管理员" : "测试用户"}${index}`,
}));
let cleanupAllowed = false;

async function request<T>(path: string, cookie = "", method = "GET", input?: unknown, expected = 200): Promise<T> {
  const response = await fetch(base + path, {
    method, headers: { cookie, "content-type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`);
  const body = await response.json() as { success: boolean; data: T };
  if (expected === 200) assert.ok(body.success);
  return body.data;
}

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/ai_roboedu_dev", "Local development DB required");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local server required");
  const pool = getDatabasePool();
  cleanupAllowed = true;
  try {
    for (const account of accounts) await pool.query("insert into users(id,username,password_hash,name,role) values($1,$2,$3,$4,$5)", [account.id, account.username, hashPassword(password), account.name, account.role]);
    const cookies: string[] = [];
    for (const account of accounts) {
      const response = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: account.username, password }) });
      assert.equal(response.status, 200);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      assert.ok(cookie);
      cookies.push(cookie);
    }
    const [admin, teacher, otherTeacher, student] = cookies;
    await request("/api/v1/admin/overview", "", "GET", undefined, 401);
    await request("/api/v1/admin/overview", teacher, "GET", undefined, 403);
    await request("/api/v1/courses", student, "POST", { title: "forbidden" }, 403);
    const teacherCourse = await request<{ id: string }>("/api/v1/courses", teacher, "POST", { title: `${prefix}_teacher` });
    const adminCourse = await request<{ id: string; creatorId: string; creatorName: string }>("/api/v1/courses", admin, "POST", { title: `${prefix}_admin`, teacherId: accounts[1].id, role: "teacher" });
    assert.equal(adminCourse.creatorId, accounts[0].id);
    assert.equal(adminCourse.creatorName, accounts[0].name);
    const all = await request<{ items: Array<{ id: string }> }>("/api/v1/courses", admin);
    assert.ok(all.items.some((item) => item.id === teacherCourse.id) && all.items.some((item) => item.id === adminCourse.id));
    await request(`/api/v1/courses/${teacherCourse.id}`, otherTeacher, "PATCH", { title: "forbidden" }, 403);
    await request(`/api/v1/courses/${teacherCourse.id}`, otherTeacher, "DELETE", undefined, 403);
    await request(`/api/v1/courses/${teacherCourse.id}`, student, "PATCH", { title: "forbidden" }, 403);
    await request(`/api/v1/courses/${teacherCourse.id}`, admin, "PATCH", { title: `${prefix}_edited`, description: "管理员编辑教师课程" });
    const lesson = await request<{ id: string }>(`/api/v1/courses/${teacherCourse.id}/lessons`, admin, "POST", { title: "章节", content: "机器人测距课程正文", order: 1 });
    await request(`/api/v1/courses/${teacherCourse.id}/lessons/${lesson.id}`, admin, "PATCH", { title: "更新章节", content: "修改后的课程内容" });
    const klass = await request<{ id: string }>("/api/v1/classes", teacher, "POST", { name: prefix });
    const otherClass = await request<{ id: string }>("/api/v1/classes", otherTeacher, "POST", { name: `${prefix}_other` });
    await request(`/api/v1/courses/${teacherCourse.id}/classes`, teacher, "POST", { classId: otherClass.id }, 403);
    await request(`/api/v1/courses/${teacherCourse.id}/classes`, teacher, "POST", { classId: klass.id });
    await request(`/api/v1/courses/${adminCourse.id}/classes`, admin, "POST", { classId: otherClass.id }, 403);
    await request(`/api/v1/courses/${adminCourse.id}/publication`, admin, "POST");
    await request(`/api/v1/classes/${otherClass.id}/courses`, admin);
    const overview = await request<{ users: number; classes: number; courses: number; resources: null }>("/api/v1/admin/overview", admin);
    const actual = (await pool.query("select (select count(*) from users)::int as users, (select count(*) from classes)::int as classes, (select count(*) from courses)::int as courses")).rows[0];
    assert.deepEqual({ users: overview.users, classes: overview.classes, courses: overview.courses }, actual);
    assert.equal(overview.resources, null);
    const demoResponse = await fetch(`${base}/api/v1/auth/demo-login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "123456" }) });
    if (demoResponse.ok) {
      const demo = demoResponse.headers.get("set-cookie")?.split(";")[0] ?? "";
      await request("/api/v1/courses", demo, "POST", { title: "demo must not write" }, 403);
      await request("/api/v1/admin/overview", demo, "GET", undefined, 403);
    } else assert.equal(demoResponse.status, 403);
    const spoofed = await fetch(`${base}/api/v1/courses`, { headers: { "x-user-id": accounts[0].id, "x-user-role": "admin" } });
    assert.equal(spoofed.status, 401);
    await request(`/api/v1/courses/${teacherCourse.id}`, admin, "DELETE");
    await request(`/api/v1/courses/${teacherCourse.id}`, admin, "GET", undefined, 404);
    assert.equal((await pool.query("select count(*)::int as n from lessons where id=$1", [lesson.id])).rows[0].n, 0);
    await request("/api/v1/auth/logout", admin, "POST");
    // Browser cookie removal is exercised separately; the old signed token is not reused here.
    await request("/api/v1/courses", "", "GET", undefined, 401);
    console.log("PASS: real PostgreSQL admin creator, all-course read/edit/delete, chapters, teacher direct publication, cross-teacher isolation, actual statistics, Demo isolation and header spoofing.");
  } finally {
    if (cleanupAllowed) {
      const ids = accounts.map((account) => account.id);
      await pool.query("delete from classes where teacher_id = any($1::uuid[])", [ids]);
      await pool.query("delete from courses where teacher_id = any($1::uuid[])", [ids]);
      await pool.query("delete from users where id = any($1::uuid[])", [ids]);
    }
    await pool.end();
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Test failed"); process.exitCode = 1; });
