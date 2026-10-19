import { DEMO_USERS, getSession, type SessionInfo } from "@/lib/auth/client";
import { readClassState } from "@/lib/classes/demo-class-store";
import { isPublishedPublicCourse, type CourseCreatorRole, type CourseScope } from "@/lib/courses/publication";

export type CourseAssetType = "document" | "presentation" | "image" | "video";

export interface CourseAsset {
  id: string;
  courseId: string;
  type: CourseAssetType;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface TeacherCourseRecord {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  creatorId?: string;
  creatorName?: string;
  creatorRole?: CourseCreatorRole;
  status?: "draft" | "published";
  publicationScope?: CourseScope;
  classIds?: string[];
}

export interface TeacherCourse extends TeacherCourseRecord {
  resources: CourseAsset[];
}

interface CourseAssetBlob {
  assetId: string;
  blob: Blob;
}

const DB_NAME = "ai-roboedu-teacher-courses";
const DB_VERSION = 1;
const COURSES_STORE = "courses";
const ASSETS_STORE = "assets";
const BLOBS_STORE = "assetBlobs";
const CHANGE_SOURCE = createId("course-window");

let dbPromise: Promise<IDBDatabase> | null = null;

export function currentDemoCourseUser(session: SessionInfo | null = getSession()): SessionInfo {
  const user = DEMO_USERS.find((item) => item.session.id === session?.id)?.session;
  if (!user) throw new Error("本地演示课程仅供 Demo 账号使用，请重新登录。");
  return user;
}

export function demoCourseSources(course: TeacherCourseRecord, user: SessionInfo): string[] {
  if (!course.creatorId || !course.creatorRole || course.status !== "published") return [];
  if (isPublishedPublicCourse(course)) return ["公共课程"];
  if (course.creatorRole !== "teacher" || course.publicationScope !== "class") return [];
  const state = readClassState();
  return state.classes.filter((item) => item.teacherId === course.creatorId && course.classIds?.includes(item.id)
    && state.members.some((member) => member.classId === item.id && member.studentId === user.id && member.status === "approved"))
    .map((item) => item.name);
}

export function canReadDemoCourse(course: TeacherCourseRecord, user: SessionInfo): boolean {
  if (user.role === "admin") return true;
  if (user.role === "teacher") return course.creatorId === user.id || (Boolean(course.creatorId) && isPublishedPublicCourse(course));
  return demoCourseSources(course, user).length > 0;
}

function assertDemoManager(course?: TeacherCourseRecord, session?: SessionInfo) {
  const user = currentDemoCourseUser(session);
  if (user.role !== "admin" && user.role !== "teacher") throw new Error("学生不能修改课程。");
  if (course && (!course.creatorId || !course.creatorRole)) throw new Error("旧课程归属待确认，请由管理员先确认创建者。");
  if (course && user.role !== "admin" && course.creatorId !== user.id) throw new Error("只能管理自己的课程。");
  return user;
}

function notifyCourseChange() {
  window.dispatchEvent(new Event("course-assets-updated"));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(DB_NAME);
    channel.postMessage({ source: CHANGE_SOURCE });
    channel.close();
  }
}

export function subscribeDemoCourses(listener: () => void): () => void {
  window.addEventListener("course-assets-updated", listener);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(DB_NAME) : null;
  if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data === "object" && event.data !== null && "source" in event.data && event.data.source === CHANGE_SOURCE) return;
    listener();
  };
  return () => { window.removeEventListener("course-assets-updated", listener); channel?.close(); };
}

async function changeDemoCourse(id: string, change: (course: TeacherCourseRecord) => TeacherCourseRecord) {
  const db = await openTeacherCourseDb();
  const tx = db.transaction(COURSES_STORE, "readwrite");
  const course = await runStoreRequest<TeacherCourseRecord | undefined>(tx.objectStore(COURSES_STORE).get(id));
  if (!course) throw new Error("课程不存在。");
  const updated = change(course);
  tx.objectStore(COURSES_STORE).put(updated);
  await waitForTransaction(tx);
  notifyCourseChange();
  return updated;
}

export async function confirmDemoCourseOwnership(id: string, creatorId: string, session?: SessionInfo) {
  if (currentDemoCourseUser(session).role !== "admin") throw new Error("只有管理员可以确认归属。");
  const creator = DEMO_USERS.find((item) => item.session.id === creatorId)?.session;
  if (!creator || (creator.role !== "admin" && creator.role !== "teacher")) throw new Error("请选择 Demo 教师或管理员。");
  return changeDemoCourse(id, (course) => {
    if (course.creatorId && course.creatorRole) throw new Error("已有归属的课程不能更改创建者。");
    return { ...course, creatorId: creator.id, creatorName: creator.name, creatorRole: creator.role as CourseCreatorRole,
      publicationScope: creator.role === "admin" ? "public" : "class", status: "draft", classIds: course.classIds ?? [], updatedAt: new Date().toISOString() };
  });
}

export async function publishDemoCourse(id: string, published: boolean, classId?: string, session?: SessionInfo) {
  return changeDemoCourse(id, (course) => {
    assertDemoManager(course, session);
    if (course.creatorRole === "admin") {
      if (currentDemoCourseUser(session).role !== "admin") throw new Error("只有管理员可以发布公共课程。");
      return { ...course, publicationScope: "public", status: published ? "published" : "draft", updatedAt: new Date().toISOString() };
    }
    const classInfo = readClassState().classes.find((item) => item.id === classId);
    if (!classInfo || classInfo.teacherId !== course.creatorId) throw new Error("只能发布到课程创建教师自己的班级。");
    const ids = new Set(course.classIds ?? []);
    if (published) ids.add(classInfo.id); else ids.delete(classInfo.id);
    return { ...course, publicationScope: "class", status: ids.size ? "published" : "draft", classIds: [...ids], updatedAt: new Date().toISOString() };
  });
}

function openTeacherCourseDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(COURSES_STORE)) {
        db.createObjectStore(COURSES_STORE, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        const assetsStore = db.createObjectStore(ASSETS_STORE, { keyPath: "id" });
        assetsStore.createIndex("courseId", "courseId", { unique: false });
      }

      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE, { keyPath: "assetId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开课程资源库"));
    request.onblocked = () => reject(new Error("课程库被其他标签页阻塞，请关闭旧标签页后重试。"));
  });

  dbPromise = dbPromise.catch((error: unknown) => { dbPromise = null; throw error; });

  return dbPromise;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function runStoreRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作失败"));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 事务失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 事务中止"));
  });
}

async function readDemoCourses(user: SessionInfo, management: boolean): Promise<TeacherCourse[]> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction([COURSES_STORE, ASSETS_STORE], "readonly");
  const [courseRecords, assets] = await Promise.all([
    runStoreRequest<TeacherCourseRecord[]>(transaction.objectStore(COURSES_STORE).getAll()),
    runStoreRequest<CourseAsset[]>(transaction.objectStore(ASSETS_STORE).getAll()),
  ]);

  const sortedAssets = assets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return courseRecords.filter((course) => management
    ? user.role === "admin" || (user.role === "teacher" && course.creatorId === user.id)
    : canReadDemoCourse(course, user))
    .map((course) => ({
      ...course,
      resources: sortedAssets.filter((asset) => asset.courseId === course.id),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function listTeacherCourses(session?: SessionInfo): Promise<TeacherCourse[]> {
  return readDemoCourses(currentDemoCourseUser(session), true);
}

export async function listDemoReadableCourses(session?: SessionInfo): Promise<TeacherCourse[]> {
  return readDemoCourses(currentDemoCourseUser(session), false);
}

export async function createTeacherCourse(input: {
  title: string;
  description: string;
}, session?: SessionInfo): Promise<TeacherCourse> {
  const user = assertDemoManager(undefined, session);
  const now = new Date().toISOString();
  const course: TeacherCourseRecord = {
    id: createId("course"),
    title: input.title.trim() || "未命名课程",
    description: input.description.trim(),
    createdAt: now,
    updatedAt: now,
    creatorId: user.id, creatorName: user.name, creatorRole: user.role as CourseCreatorRole,
    publicationScope: user.role === "admin" ? "public" : "class", status: "draft", classIds: [],
  };

  const db = await openTeacherCourseDb();
  const transaction = db.transaction(COURSES_STORE, "readwrite");
  transaction.objectStore(COURSES_STORE).put(course);
  await waitForTransaction(transaction);
  notifyCourseChange();
  return { ...course, resources: [] };
}

export async function updateTeacherCourse(input: {
  id: string;
  title: string;
  description: string;
}, session?: SessionInfo): Promise<TeacherCourseRecord> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction(COURSES_STORE, "readwrite");
  const store = transaction.objectStore(COURSES_STORE);
  const current = await runStoreRequest<TeacherCourseRecord | undefined>(store.get(input.id));

  if (!current) {
    throw new Error("课程不存在");
  }
  assertDemoManager(current, session);

  const nextCourse: TeacherCourseRecord = {
    ...current,
    title: input.title.trim() || "未命名课程",
    description: input.description.trim(),
    updatedAt: new Date().toISOString(),
  };

  store.put(nextCourse);
  await waitForTransaction(transaction);
  notifyCourseChange();
  return nextCourse;
}

export async function addCourseAsset(input: {
  courseId: string;
  type: CourseAssetType;
  file: File;
}, session?: SessionInfo): Promise<CourseAsset> {
  const existing = await getDemoCourse(input.courseId, session);
  assertDemoManager(existing, session);
  const now = new Date().toISOString();
  const asset: CourseAsset = {
    id: createId("asset"),
    courseId: input.courseId,
    type: input.type,
    name: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    size: input.file.size,
    createdAt: now,
  };

  const blobRecord: CourseAssetBlob = {
    assetId: asset.id,
    blob: input.file,
  };

  const db = await openTeacherCourseDb();
  const transaction = db.transaction([ASSETS_STORE, BLOBS_STORE, COURSES_STORE], "readwrite");
  transaction.objectStore(ASSETS_STORE).put(asset);
  transaction.objectStore(BLOBS_STORE).put(blobRecord);

  const coursesStore = transaction.objectStore(COURSES_STORE);
  const currentCourse = await runStoreRequest<TeacherCourseRecord | undefined>(
    coursesStore.get(input.courseId)
  );
  if (currentCourse) {
    coursesStore.put({ ...currentCourse, updatedAt: now });
  }

  await waitForTransaction(transaction);
  notifyCourseChange();
  return asset;
}

export async function getDemoCourse(id: string, session?: SessionInfo): Promise<TeacherCourseRecord> {
  const db = await openTeacherCourseDb();
  const course = await runStoreRequest<TeacherCourseRecord | undefined>(db.transaction(COURSES_STORE, "readonly").objectStore(COURSES_STORE).get(id));
  if (!course) throw new Error("课程不存在。");
  if (!canReadDemoCourse(course, currentDemoCourseUser(session))) throw new Error("课程未发布或你没有访问权限。");
  return course;
}

export async function getCourseAssetBlob(assetId: string, session?: SessionInfo): Promise<Blob | null> {
  const db = await openTeacherCourseDb();
  const asset = await runStoreRequest<CourseAsset | undefined>(db.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE).get(assetId));
  if (!asset) return null;
  await getDemoCourse(asset.courseId, session);
  const transaction = db.transaction(BLOBS_STORE, "readonly");
  const record = await runStoreRequest<CourseAssetBlob | undefined>(
    transaction.objectStore(BLOBS_STORE).get(assetId)
  );
  return record?.blob ?? null;
}

export async function deleteCourseAsset(asset: CourseAsset, session?: SessionInfo): Promise<void> {
  const db = await openTeacherCourseDb();
  const stored = await runStoreRequest<CourseAsset | undefined>(db.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE).get(asset.id));
  if (!stored) throw new Error("资源不存在。");
  assertDemoManager(await getDemoCourse(stored.courseId, session), session);
  const transaction = db.transaction([ASSETS_STORE, BLOBS_STORE, COURSES_STORE], "readwrite");
  transaction.objectStore(ASSETS_STORE).delete(asset.id);
  transaction.objectStore(BLOBS_STORE).delete(asset.id);

  const coursesStore = transaction.objectStore(COURSES_STORE);
  const currentCourse = await runStoreRequest<TeacherCourseRecord | undefined>(
    coursesStore.get(stored.courseId)
  );
  if (currentCourse) {
    coursesStore.put({ ...currentCourse, updatedAt: new Date().toISOString() });
  }

  await waitForTransaction(transaction);
  notifyCourseChange();
}
