import assert from "node:assert/strict";
import { test } from "node:test";
import { DEMO_USERS } from "../src/lib/auth/client";
import { canReadDemoCourse, currentDemoCourseUser, getCourseAssetBlob, type TeacherCourseRecord } from "../src/lib/course/teacher-course-store";

test("Demo ownership, approval and publication guard direct Blob reads, not only lists", async (t) => {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  const teacher = DEMO_USERS.find((item) => item.username === "teacher")!.session;
  const student = DEMO_USERS.find((item) => item.username === "student")!.session;
  const admin = DEMO_USERS.find((item) => item.username === "admin")!.session;
  let course: TeacherCourseRecord = { id: "test-course", title: "test", description: "test", createdAt: "2026-10-18", updatedAt: "2026-10-18", creatorId: teacher.id, creatorRole: "teacher", publicationScope: "class", status: "published", classIds: ["CLS-TEST"] };
  let blobReads = 0;
  const blob = new Blob(["private teaching resource"]);
  const request = (result: unknown) => {
    const item: { result: unknown; onsuccess?: () => void } = { result };
    queueMicrotask(() => item.onsuccess?.());
    return item;
  };
  const db = {
    transaction: () => ({ objectStore: (store: string) => ({
      get: () => {
        if (store === "courses") return request(course);
        if (store === "assets") return request({ id: "known-asset-id", courseId: course.id });
        blobReads++;
        return request({ assetId: "known-asset-id", blob });
      },
    }) }),
  };
  const replaceGlobal = (name: string, value: unknown) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else Reflect.deleteProperty(globalThis, name); });
  };
  replaceGlobal("window", {});
  replaceGlobal("localStorage", storage);
  replaceGlobal("indexedDB", { open: () => request(db) });
  storage.setItem("al_session", JSON.stringify(student));
  const membership = { id: "member", classId: "CLS-TEST", studentId: student.id, status: "approved" };
  const saveClass = () => storage.setItem("ai_roboedu_demo_classes_v1", JSON.stringify({ classes: [{ id: "CLS-TEST", name: "test class", teacherId: teacher.id }], members: [membership], version: 1 }));
  saveClass();
  assert.equal(await getCourseAssetBlob("known-asset-id"), blob);
  const reads = blobReads;
  membership.status = "pending"; saveClass();
  await assert.rejects(getCourseAssetBlob("known-asset-id"), /访问权限/);
  assert.equal(blobReads, reads, "forbidden requests must not read stored bytes");
  membership.status = "approved"; saveClass();
  course = { ...course, status: "draft" };
  await assert.rejects(getCourseAssetBlob("known-asset-id"), /访问权限/);
  course = { ...course, status: "published", creatorId: undefined, creatorRole: undefined };
  await assert.rejects(getCourseAssetBlob("known-asset-id"), /访问权限/);
  course = { ...course, creatorId: admin.id, creatorRole: "admin", publicationScope: "public" };
  storage.removeItem("ai_roboedu_demo_classes_v1");
  assert.equal(await getCourseAssetBlob("known-asset-id"), blob);
  course = { ...course, status: "draft" };
  await assert.rejects(getCourseAssetBlob("known-asset-id"), /访问权限/);
  assert.equal(canReadDemoCourse(course, { ...teacher, id: "demo-other-teacher" }), false);
  assert.equal(canReadDemoCourse({ ...course, status: "published" }, teacher), true, "teachers can read published admin public courses");
  assert.equal(await getCourseAssetBlob("known-asset-id", admin), blob, "verified actor does not depend on a stale local cache");
  storage.setItem("al_session", JSON.stringify({ ...teacher, role: "admin" }));
  assert.equal(currentDemoCourseUser().role, "teacher", "local role text must not override the predefined Demo identity");
  storage.setItem("al_session", JSON.stringify({ ...admin, id: "00000000-0000-4000-8000-000000000000" }));
  await assert.rejects(getCourseAssetBlob("known-asset-id"), /Demo/);
});
