import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "../src/storage/database/db";
import { hashPassword } from "../src/lib/auth/password";

const base = process.env.COURSE_API_TEST_BASE_URL ?? "http://127.0.0.1:5000";
const prefix = `publication_${randomUUID().slice(0, 8)}`;
const password = randomUUID();
type Course = { id: string; creatorId: string; creatorRole: string | null; publicationScope: string; status: string };
type Available = { items: Array<{ course: Course; classNames: string[] }> };
const accounts = ["admin", "teacher", "teacher", "student", "student"].map((role, i) => ({ id: randomUUID(), username: `${prefix}_${i}`, role }));
async function api<T>(path: string, cookie: string, method = "GET", input?: unknown, status = 200): Promise<T> {
  const r = await fetch(base + path, { method, headers: { cookie, "content-type": "application/json" }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(30000) });
  const body = await r.json() as { success: boolean; data: T; message?: string };
  assert.equal(r.status, status, `${method} ${path}: ${body.message ?? r.status}`);
  if (status === 200) assert.equal(body.success, true);
  return body.data;
}
async function main() {
  const u = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(u.hostname) && u.pathname === "/ai_roboedu_dev");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
  const pool = getDatabasePool();
  const ids = accounts.map((a) => a.id);
  try {
    const cookies: string[] = [];
    for (const account of accounts) {
      await pool.query("insert into users(id,username,password_hash,name,role) values($1,$2,$3,$4,$5)", [account.id, account.username, hashPassword(password), `测试${account.role}`, account.role]);
      const r = await fetch(base + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: account.username, password }) });
      assert.equal(r.status, 200); cookies.push(r.headers.get("set-cookie")!.split(";")[0]);
    }
    const [admin, teacher, otherTeacher, student, outsider] = cookies;
    const root = "/api/v1/courses";
    await api(root + "/available", "", "GET", undefined, 401);
    const publicCourse = await api<Course>(root, admin, "POST", { title: `${prefix}_public`, creatorId: ids[1], creatorRole: "teacher", status: "published", publicationScope: "class" });
    assert.equal(publicCourse.creatorId, ids[0]); assert.equal(publicCourse.creatorRole, "admin"); assert.equal(publicCourse.status, "draft");
    const classCourse = await api<Course>(root, teacher, "POST", { title: `${prefix}_class`, creatorRole: "admin", publicationScope: "public" });
    assert.equal(classCourse.creatorRole, "teacher"); assert.equal(classCourse.publicationScope, "class");
    const chapter = await api<{ id: string }>(`${root}/${publicCourse.id}/lessons`, admin, "POST", { title: "公共章节", content: "雷达测距原理", order: 1 });
    const classChapter = await api<{ id: string }>(`${root}/${classCourse.id}/lessons`, teacher, "POST", { title: "班级章节", content: "班级传感器实验", order: 1 });
    assert.ok(!(await api<Available>(root + "/available", student)).items.some((i) => i.course.id === publicCourse.id));
    await api(`${root}/${publicCourse.id}`, student, "GET", undefined, 403);
    await api(`${root}/${publicCourse.id}/publication`, teacher, "POST", undefined, 403);
    await api(`${root}/${classCourse.id}/publication`, admin, "POST", undefined, 403);
    await api(`${root}/${publicCourse.id}/publication`, admin, "POST");
    const readable = root + "?view=readable";
    await api(readable, "", "GET", undefined, 401);
    const ownBefore = await api<{ items: Course[] }>(readable, teacher);
    assert.ok(ownBefore.items.some((item) => item.id === classCourse.id), "teacher sees own empty draft");
    assert.ok(ownBefore.items.some((item) => item.id === publicCourse.id), "teacher sees published public course");
    assert.ok(!(await api<{ items: Course[] }>(root, teacher)).items.some((item) => item.id === publicCourse.id), "public courses do not confer management rights");
    assert.ok(!(await api<{ items: Course[] }>(readable, otherTeacher)).items.some((item) => item.id === classCourse.id), "another teacher's private draft stays hidden");
    assert.ok((await api<{ items: Course[] }>(readable, admin)).items.some((item) => item.id === classCourse.id));
    await api(`${root}/${publicCourse.id}`, teacher);
    await api(`${root}/${publicCourse.id}/lessons`, teacher);
    await api(`${root}/${publicCourse.id}/lessons/${chapter.id}/ai`, teacher);
    await api(`${root}/${publicCourse.id}`, teacher, "PATCH", { title: "forbidden" }, 403);
    await api(`${root}/${publicCourse.id}/lessons`, teacher, "POST", { title: "forbidden", content: "no", order: 99 }, 403);
    console.log("PASS: readable catalog includes own drafts and read-only public courses, without widening management permissions.");
    for (const cookie of [student, outsider]) {
      assert.equal((await api<Available>(root + "/available", cookie)).items.filter((i) => i.course.id === publicCourse.id).length, 1);
      await api(`${root}/${publicCourse.id}`, cookie);
      await api(`${root}/${publicCourse.id}/lessons`, cookie);
      await api(`${root}/${publicCourse.id}/lessons/${chapter.id}/ai`, cookie);
      await api(`${root}/${publicCourse.id}/progress`, cookie, "POST", { lessonId: chapter.id, completed: true });
    }
    console.log("PASS: server-owned identity/scope, hidden drafts, public courses for students without classes, chapters/AI/progress.");
    const klass = await api<{ id: string; classCode: string }>("/api/v1/classes", teacher, "POST", { name: prefix });
    const otherClass = await api<{ id: string }>("/api/v1/classes", otherTeacher, "POST", { name: prefix + "_other" });
    const membership = await api<{ id: string }>("/api/v1/classes/join", student, "POST", { classCode: klass.classCode });
    await api(`${root}/${classCourse.id}/classes`, teacher, "POST", { classId: otherClass.id }, 403);
    await api(`${root}/${classCourse.id}/classes`, otherTeacher, "POST", { classId: klass.id }, 403);
    await api(`${root}/${classCourse.id}/classes`, teacher, "POST", { classId: klass.id });
    await api(`${root}/${classCourse.id}`, student, "GET", undefined, 403);
    await api(`/api/v1/classes/${klass.id}/members/${membership.id}`, teacher, "PATCH", { status: "approved" });
    assert.equal((await api<Available>(root + "/available", student)).items.filter((i) => i.course.id === classCourse.id).length, 1);
    await api(`${root}/${classCourse.id}`, student);
    await api(`${root}/${classCourse.id}`, outsider, "GET", undefined, 403);
    const secondClass = await api<{ id: string; classCode: string }>("/api/v1/classes", teacher, "POST", { name: prefix + "_second" });
    const secondMember = await api<{ id: string }>("/api/v1/classes/join", student, "POST", { classCode: secondClass.classCode });
    await api(`/api/v1/classes/${secondClass.id}/members/${secondMember.id}`, teacher, "PATCH", { status: "approved" });
    await api(`${root}/${classCourse.id}/classes`, teacher, "POST", { classId: secondClass.id });
    const dedup = (await api<Available>(root + "/available", student)).items.filter((i) => i.course.id === classCourse.id);
    assert.equal(dedup.length, 1); assert.equal(dedup[0].classNames.length, 2);
    await api(`${root}/${classCourse.id}/classes`, teacher, "DELETE", { classId: secondClass.id });
    await api(`${root}/${classCourse.id}`, student);
    const edited = await api<Course>(`${root}/${classCourse.id}`, admin, "PATCH", { title: "管理员编辑教师课", creatorId: ids[0], creatorRole: "admin", publicationScope: "public" });
    assert.equal(edited.creatorId, ids[1]); assert.equal(edited.creatorRole, "teacher"); assert.equal(edited.publicationScope, "class");
    await api(`${root}/${classCourse.id}/publication`, admin, "POST", undefined, 403);
    await api(`/api/v1/classes/${klass.id}/members/${membership.id}`, teacher, "DELETE");
    await api(`${root}/${classCourse.id}/lessons`, student, "GET", undefined, 403);
    await api(`${root}/${classCourse.id}/lessons/${classChapter.id}/ai`, student, "GET", undefined, 403);
    await api(`${root}/${classCourse.id}/progress`, student, "POST", { lessonId: classChapter.id }, 403);
    console.log("PASS: approval, teacher/class isolation, immutable creator, admin edits never make teacher courses public, revoked membership.");
    await api(`${root}/${publicCourse.id}/publication`, admin, "DELETE");
    assert.ok(!(await api<{ items: Course[] }>(readable, teacher)).items.some((item) => item.id === publicCourse.id));
    await api(`${root}/${publicCourse.id}`, teacher, "GET", undefined, 403);
    for (const suffix of ["", "/lessons", `/lessons/${chapter.id}/ai`, "/progress"]) await api(`${root}/${publicCourse.id}${suffix}`, student, "GET", undefined, 403);
    assert.ok(!(await api<Available>(root + "/available", student)).items.some((i) => i.course.id === publicCourse.id));
    await api(`${root}/${classCourse.id}/classes`, teacher, "DELETE", { classId: klass.id });
    assert.equal((await api<Course>(`${root}/${classCourse.id}`, teacher)).status, "draft");
    const legacyId = randomUUID();
    await pool.query("insert into courses(id,title,category,teacher_id,status) values($1,$2,'formal',$3,'draft')", [legacyId, prefix + "_legacy", ids[1]]);
    const legacy = await api<Course>(`${root}/${legacyId}`, admin);
    assert.equal(legacy.creatorRole, null); assert.equal(legacy.publicationScope, "legacy");
    await pool.query("insert into class_courses(course_id,class_id) values($1,$2)", [legacyId, secondClass.id]);
    await api(`${root}/${legacyId}`, student, "GET", undefined, 403);
    // Fixture represents the corrected historical draft-with-class-link after migration 0005.
    await pool.query("update courses set status='published' where id=$1", [legacyId]);
    await api(`${root}/${legacyId}`, student);
    await api(`${root}/${legacyId}`, outsider, "GET", undefined, 403);
    await api(`${root}/${legacyId}/publication`, admin, "POST", undefined, 403);
    await api(`${root}/${legacyId}/ownership`, teacher, "POST", { creatorId: ids[1] }, 403);
    const confirmed = await api<Course>(`${root}/${legacyId}/ownership`, admin, "POST", { creatorId: ids[1] });
    assert.equal(confirmed.publicationScope, "legacy"); assert.equal(confirmed.status, "published");
    await api(`${root}/${legacyId}`, student);
    await api(`${root}/${legacyId}/ownership`, admin, "POST", { creatorId: ids[0] }, 409);
    await api(`${root}/${legacyId}/publication`, admin, "POST", undefined, 403);
    const demo = await fetch(base + "/api/v1/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "student", password: "123456" }) });
    assert.equal(demo.status, 200);
    await api(root + "/available", demo.headers.get("set-cookie")!.split(";")[0], "GET", undefined, 403);
    console.log("PASS: unpublication blocks every content endpoint, unknown legacy ownership stays private until explicit confirmation, Demo isolation.");
  } finally {
    await pool.query("delete from classes where teacher_id=any($1::uuid[])", [ids]);
    await pool.query("delete from courses where teacher_id=any($1::uuid[])", [ids]);
    await pool.query("delete from users where id=any($1::uuid[])", [ids]);
    await pool.end();
    console.log("Only this test's dedicated data cleaned.");
  }
}
main().catch((cause: unknown) => { console.error(cause instanceof Error ? cause.message : "Test failed"); process.exitCode = 1; });
