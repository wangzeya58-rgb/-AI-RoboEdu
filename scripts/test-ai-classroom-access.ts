import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";

test("正式课程 AI 权限链路（只 mock 数据读取，不连接数据库）", async (t) => {
  // The Pool is constructed lazily and every read used below is mocked before execution.
  process.env.DATABASE_URL = "postgresql://mock:mock@127.0.0.1:1/never_connect";
  const { getDatabase, getDatabasePool } = await import("../src/storage/database/db");
  const { getAiLessonContext, askAiLessonTeacher } = await import("../src/lib/ai-classroom/server-ai-classroom-service");
  const db = getDatabase();
  const dialect = new PgDialect();
  const teacherId = "11111111-1111-4111-8111-111111111111";
  const studentId = "22222222-2222-4222-8222-222222222222";
  const courseId = "33333333-3333-4333-8333-333333333333";
  const lessonId = "44444444-4444-4444-8444-444444444444";
  let memberAllowed = false;
  let missingLesson = false;
  let lessonReads = 0;
  const course = {
    id: courseId, teacherId, title: "授权课程", description: "服务端简介", category: "formal", status: "published",
    coverUrl: null, teacherName: null, rejectReason: null, durationMinutes: 0, reviewedAt: null, reviewerId: null, createdAt: "2026-10-15", updatedAt: null,
  };
  t.mock.method(db.query.courses, "findFirst", async () => course);
  t.mock.method(db.query.classCourses, "findMany", async () => [{ courseId, classId: "class-1", createdAt: "2026-10-15" }]);
  t.mock.method(db.query.classMembers, "findFirst", async (options: { where: Parameters<PgDialect["sqlToQuery"]>[0] }) => {
    const query = dialect.sqlToQuery(options.where);
    assert.ok(query.params.includes("approved"));
    assert.ok(query.params.includes(studentId));
    return memberAllowed ? { id: "membership-1" } : undefined;
  });
  t.mock.method(db.query.lessons, "findFirst", async (options: { where: Parameters<PgDialect["sqlToQuery"]>[0] }) => {
    lessonReads++;
    const query = dialect.sqlToQuery(options.where);
    assert.deepEqual(query.params, [lessonId, courseId]);
    return missingLesson ? undefined : { id: lessonId, courseId, title: "服务端章节", content: "学习目标：理解测距。实验步骤：先观察，再记录。", order: 1, createdAt: "2026-10-15" };
  });
  const previousProvider = process.env.AI_CLASSROOM_PROVIDER;
  process.env.AI_CLASSROOM_PROVIDER = "local";
  try {
    await assert.rejects(getAiLessonContext({ id: "demo-student", role: "student" }, courseId, lessonId), /Demo/);
    await assert.rejects(getAiLessonContext({ id: studentId, role: "teacher" }, courseId, lessonId), /无权/);
    await assert.rejects(askAiLessonTeacher({ id: studentId, role: "student" }, courseId, lessonId, "重点"), /无权/);
    assert.equal(lessonReads, 0);
    memberAllowed = true;
    const allowed = await askAiLessonTeacher({ id: studentId, role: "student" }, courseId, lessonId, "这个实验怎么做");
    assert.equal(allowed.lesson.content, "学习目标：理解测距。实验步骤：先观察，再记录。");
    assert.match(allowed.answer, /先观察，再记录/);
    const owner = await getAiLessonContext({ id: teacherId, role: "teacher" }, courseId, lessonId);
    assert.equal(owner.course.title, "授权课程");
    missingLesson = true;
    await assert.rejects(getAiLessonContext({ id: teacherId, role: "teacher" }, courseId, lessonId), /章节不存在/);
  } finally {
    if (previousProvider === undefined) delete process.env.AI_CLASSROOM_PROVIDER; else process.env.AI_CLASSROOM_PROVIDER = previousProvider;
    t.mock.restoreAll();
    await getDatabasePool().end();
  }
});
