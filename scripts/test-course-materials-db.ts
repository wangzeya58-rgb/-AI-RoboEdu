import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { getDatabasePool } from "../src/storage/database/db";
import { hashPassword } from "../src/lib/auth/password";
import { createAuthSession, serializeAuthSession } from "../src/lib/auth/server-session";
import { validateMaterialFile } from "../src/lib/courses/course-file-storage";

const base = "http://127.0.0.1:5098";
const prefix = `files_${randomUUID().slice(0, 8)}`;
const password = `Test-Aa1-${randomUUID()}`;
const accounts = ["admin", "teacher", "teacher", "student", "student"].map((role, i) => ({ id: randomUUID(), username: `${prefix}_${i}`, role }));
let server: ChildProcess | undefined;
let logs = "";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, "exit"); server.kill("SIGTERM");
  const timer = setTimeout(() => server?.kill("SIGKILL"), 10000);
  await exited; clearTimeout(timer); server = undefined;
}
async function start(storage: string, demo = true, unavailableDatabase = false) {
  await fetch(base + "/login", { signal: AbortSignal.timeout(500) }).then(() => { throw new Error("Test port is already occupied."); }, () => {});
  logs = "";
  server = spawn(process.execPath, ["dist/server.js"], { env: { ...process.env, ...(unavailableDatabase ? { DATABASE_URL: "postgresql://unavailable:unavailable@127.0.0.1:1/unavailable_test" } : {}), NODE_ENV: "production", PORT: "5098", BIND_HOST: "127.0.0.1", APP_ORIGIN: base, ENABLE_DEMO_AUTH: String(demo), COURSE_FILE_STORAGE_DIR: storage, AI_CLASSROOM_PROVIDER: "local" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout?.on("data", (value: Buffer) => { logs = (logs + value.toString()).slice(-12000); });
  server.stderr?.on("data", (value: Buffer) => { logs = (logs + value.toString()).slice(-12000); });
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("Isolated production test server exited before readiness.");
    const ready = await fetch(base + "/login", { signal: AbortSignal.timeout(1000) }).then((r) => r.ok, () => false);
    if (ready) return;
    await pause(250);
  }
  throw new Error("Isolated production test server did not become ready.");
}
async function api<T>(url: string, cookie: string, method = "GET", input?: unknown, status = 200): Promise<T> {
  const response = await fetch(base + url, { method, headers: { cookie, "content-type": "application/json" }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(20000) });
  const body = await response.json() as { success: boolean; data: T; message: string };
  assert.equal(response.status, status, `${method} ${url}: ${body.message}`);
  if (status === 200) assert.equal(body.success, true);
  return body.data;
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0WQAAAAASUVORK5CYII=", "base64");
type Material = { id: string; contentUrl: string; name: string };
async function upload(courseId: string, cookie: string, bytes: Uint8Array, name = "中文课件.png", mime = "image/png", status = 200) {
  const body = new FormData(); body.set("file", new Blob([Buffer.from(bytes)], { type: mime }), name);
  const response = await fetch(`${base}/api/v1/courses/${courseId}/materials`, { method: "POST", headers: { cookie, origin: base }, body });
  const result = await response.json() as { data: Material; message: string };
  assert.equal(response.status, status, `upload: ${result.message}`); return result.data;
}
async function file(url: string, cookie: string, status = 200, range?: string) {
  const r = await fetch(base + url, { headers: { cookie, ...(range ? { range } : {}) } });
  assert.equal(r.status, status, `file access ${url}`); return r;
}
async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname === "/ai_roboedu_dev", "Only the confirmed local development database is allowed.");
  const directory = await mkdtemp(path.join(tmpdir(), "roboedu-materials-"));
  const pool = getDatabasePool();
  const baseline = (await pool.query("select id from courses order by id")).rows.map((r: { id: string }) => r.id);
  const ids = accounts.map((a) => a.id);
  try {
    await start(directory);
    const cookies: string[] = [];
    for (const a of accounts) {
      await pool.query("insert into users(id,username,password_hash,name,role) values($1,$2,$3,$4,$5)", [a.id, a.username, hashPassword(password), `附件联调${a.role}`, a.role]);
      const r = await fetch(base + "/api/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: a.username, password }) });
      assert.equal(r.status, 200); cookies.push(r.headers.get("set-cookie")!.split(";")[0]);
    }
    const [admin, teacher, otherTeacher, student, outsider] = cookies;
    const root = "/api/v1/courses";
    const publicCourse = await api<{ id: string }>(root, admin, "POST", { title: `${prefix}_public` });
    const privateCourse = await api<{ id: string }>(root, teacher, "POST", { title: `${prefix}_private` });
    const chapter = await api<{ id: string }>(`${root}/${publicCourse.id}/lessons`, admin, "POST", { title: "传感器", content: "超声波使用声波传播时间测距。", order: 1 });
    const privateChapter = await api<{ id: string }>(`${root}/${privateCourse.id}/lessons`, teacher, "POST", { title: "私有章节", content: "班级专属内容", order: 1 });
    const material = await upload(publicCourse.id, admin, png);
    const privateMaterial = await upload(privateCourse.id, teacher, png);
    assert.match(material.name, /中文/);
    await file(material.contentUrl, student, 403);
    await file(material.contentUrl, "", 401);
    await upload(publicCourse.id, student, png, "x.png", "image/png", 403);
    await upload(privateCourse.id, otherTeacher, png, "x.png", "image/png", 403);
    await upload(publicCourse.id, admin, Buffer.from("not a PNG"), "x.png", "image/png", 400);
    await upload(publicCourse.id, admin, png, "x.exe", "image/png", 400);
    await upload(publicCourse.id, admin, png, "x.jpg", "text/html", 400);
    assert.throws(() => validateMaterialFile("big.pdf", "application/pdf", new Uint8Array(52428801)));
    const count = (await pool.query("select count(*)::int as n from course_materials where course_id=$1", [publicCourse.id])).rows[0].n;
    assert.equal(count, 1, "failed uploads leave no metadata");
    const demoCookie = "ai_roboedu_session=" + serializeAuthSession(createAuthSession({ userId: "demo-teacher", username: "teacher", name: "Demo", role: "teacher" }));
    await upload(privateCourse.id, demoCookie, png, "x.png", "image/png", 403);
    await api(`${root}/${publicCourse.id}/publication`, admin, "POST");
    const downloaded = await file(material.contentUrl + "?download=1", student);
    assert.match(downloaded.headers.get("content-disposition")!, /attachment;.*filename\*=UTF-8/);
    assert.equal(createHash("sha256").update(Buffer.from(await downloaded.arrayBuffer())).digest("hex"), createHash("sha256").update(png).digest("hex"));
    const partial = await file(material.contentUrl, student, 206, "bytes=0-7");
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), png.subarray(0, 8));
    await file(material.contentUrl, student, 416, "bytes=999999-");
    for (const cookie of [student, outsider]) await api(`${root}/${publicCourse.id}/materials`, cookie);
    const klass = await api<{ id: string; classCode: string }>("/api/v1/classes", teacher, "POST", { name: prefix });
    const member = await api<{ id: string }>("/api/v1/classes/join", student, "POST", { classCode: klass.classCode });
    await api(`/api/v1/classes/${klass.id}/members/${member.id}`, teacher, "PATCH", { status: "approved" });
    await api(`${root}/${privateCourse.id}/classes`, teacher, "POST", { classId: klass.id });
    await file(privateMaterial.contentUrl, student);
    await file(privateMaterial.contentUrl, outsider, 403);
    await file(privateMaterial.contentUrl, otherTeacher, 403);
    await api(`${root}/${publicCourse.id}/progress`, student, "POST", { lessonId: chapter.id, completed: true });
    const answer = await api<{ answer: string }>(`${root}/${publicCourse.id}/lessons/${chapter.id}/ai`, student, "POST", { question: "如何测距？", history: [] }); assert.ok(answer.answer);
    console.log("PASS PostgreSQL/API: admin/teacher upload, role isolation, hidden drafts, public/class publication, exact download bytes, Unicode filename, Range, progress and local AI.");
    console.log("PASS validation: file signature/extension/MIME/size, no failed-upload associations, Demo cannot write formal data.");

    if (process.env.COURSE_TEST_BROWSER === "true") {
      const child = spawn(process.execPath, ["scripts/test-course-materials-browser.mjs"], { stdio: ["pipe", "inherit", "inherit"] });
      child.stdin!.end(JSON.stringify({ base, prefix, password, admin: accounts[0], teacher: accounts[1], student: accounts[3], classId: klass.id }));
      const [code] = await once(child, "exit"); assert.equal(code, 0, "independent browser workflow");
    } else console.log("NOT RUN: independent browser test (set COURSE_TEST_BROWSER=true and use an isolated Chrome CDP profile on port 9223).");

    await stop();
    const blocked = path.join(directory, "blocked"); await writeFile(blocked, "not a directory");
    await start(blocked);
    await upload(publicCourse.id, admin, png, "failed.png", "image/png", 500);
    assert.equal((await pool.query("select count(*)::int as n from course_materials where course_id=$1", [publicCourse.id])).rows[0].n, count);
    await stop(); await unlink(blocked); await start(directory, false);
    assert.deepEqual(Buffer.from(await (await file(material.contentUrl, student)).arrayBuffer()), png);
    const progress = await api<{ lastLessonId: string }>(`${root}/${publicCourse.id}/progress`, student); assert.equal(progress.lastLessonId, chapter.id);
    await file(privateMaterial.contentUrl, student);
    await upload(privateCourse.id, demoCookie, png, "x.png", "image/png", 401);
    const demo = await fetch(base + "/api/v1/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "123456" }) }); assert.equal(demo.status, 403);
    console.log("PASS restart: new Node process/new DB pool, attachment bytes/permissions and saved progress preserved; disabled Demo rejects old signed cookies.");
    await api(`${root}/${publicCourse.id}/publication`, admin, "DELETE");
    await api(`/api/v1/classes/${klass.id}/members/${member.id}`, teacher, "DELETE");
    for (const [course, lesson, attachment] of [[publicCourse.id, chapter.id, material], [privateCourse.id, privateChapter.id, privateMaterial]] as const) {
      for (const suffix of ["", "/materials", "/lessons", "/progress", `/lessons/${lesson}/ai`]) await api(`${root}/${course}${suffix}`, student, "GET", undefined, 403);
      await file(attachment.contentUrl, student, 403);
    }
    await api(`${root}/${publicCourse.id}/materials/${material.id}`, admin, "DELETE");
    await file(material.contentUrl, admin, 404);
    console.log("PASS revocation: unpublished public course/removed class membership revoke chapters, attachments, progress and AI; deleted attachment returns 404.");
    // All rows and physical files created by this run are exclusively owned by these temporary accounts.
    for (const row of (await pool.query("select id,teacher_id from courses where teacher_id=any($1::uuid[])", [ids])).rows) {
      const cookie = cookies[ids.indexOf(row.teacher_id)]; await api(`${root}/${row.id}`, cookie, "DELETE");
    }
    assert.equal((await readdir(directory)).filter((name) => !name.startsWith(".")).length, 0, "course deletion cleans owned files");
    await stop(); await start(directory, true, true);
    await api("/api/v1/auth/login", "", "POST", { username: "student", password: "123456" }, 503);
    if (process.env.COURSE_TEST_BROWSER === "true") {
      const child = spawn(process.execPath, ["scripts/test-course-materials-browser.mjs"], { stdio: ["pipe", "inherit", "inherit"] });
      child.stdin!.end(JSON.stringify({ base, outage: true }));
      const [code] = await once(child, "exit"); assert.equal(code, 0);
    }
    console.log("PASS failures: unwritable storage rolls back metadata; unavailable formal database returns 503 without Demo fallback.");
  } catch (error) {
    // Logs can contain user data/URLs; do not print the server's raw logs or environment.
    console.error("Isolated server emitted diagnostics:", Boolean(logs)); throw error;
  } finally {
    await stop();
    await pool.query("delete from courses where teacher_id=any($1::uuid[])", [ids]);
    await pool.query("delete from class_members where user_id=any($1::uuid[])", [ids]);
    await pool.query("delete from classes where teacher_id=any($1::uuid[])", [ids]);
    await pool.query("delete from users where id=any($1::uuid[])", [ids]);
    assert.deepEqual((await pool.query("select id from courses order by id")).rows.map((r: { id: string }) => r.id), baseline, "existing courses preserved");
    await pool.end(); await rm(directory, { recursive: true, force: true });
    console.log("Temporary accounts/courses/files removed; pre-existing course IDs unchanged.");
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Material regression failed"); process.exitCode = 1; });
