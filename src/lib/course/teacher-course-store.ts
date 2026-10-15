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

let dbPromise: Promise<IDBDatabase> | null = null;

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
  });

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

async function readAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  return runStoreRequest<T[]>(store.getAll());
}

export async function listTeacherCourses(): Promise<TeacherCourse[]> {
  const [courseRecords, assets] = await Promise.all([
    readAllFromStore<TeacherCourseRecord>(COURSES_STORE),
    readAllFromStore<CourseAsset>(ASSETS_STORE),
  ]);

  const sortedAssets = assets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return courseRecords
    .map((course) => ({
      ...course,
      resources: sortedAssets.filter((asset) => asset.courseId === course.id),
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function createTeacherCourse(input: {
  title: string;
  description: string;
}): Promise<TeacherCourse> {
  const now = new Date().toISOString();
  const course: TeacherCourseRecord = {
    id: createId("course"),
    title: input.title.trim() || "未命名课程",
    description: input.description.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const db = await openTeacherCourseDb();
  const transaction = db.transaction(COURSES_STORE, "readwrite");
  transaction.objectStore(COURSES_STORE).put(course);
  await waitForTransaction(transaction);

  return { ...course, resources: [] };
}

export async function updateTeacherCourse(input: {
  id: string;
  title: string;
  description: string;
}): Promise<TeacherCourseRecord> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction(COURSES_STORE, "readwrite");
  const store = transaction.objectStore(COURSES_STORE);
  const current = await runStoreRequest<TeacherCourseRecord | undefined>(store.get(input.id));

  if (!current) {
    throw new Error("课程不存在");
  }

  const nextCourse: TeacherCourseRecord = {
    ...current,
    title: input.title.trim() || "未命名课程",
    description: input.description.trim(),
    updatedAt: new Date().toISOString(),
  };

  store.put(nextCourse);
  await waitForTransaction(transaction);
  return nextCourse;
}

export async function addCourseAsset(input: {
  courseId: string;
  type: CourseAssetType;
  file: File;
}): Promise<CourseAsset> {
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
  return asset;
}

export async function getCourseAssetBlob(assetId: string): Promise<Blob | null> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction(BLOBS_STORE, "readonly");
  const record = await runStoreRequest<CourseAssetBlob | undefined>(
    transaction.objectStore(BLOBS_STORE).get(assetId)
  );
  return record?.blob ?? null;
}

export async function deleteCourseAsset(asset: CourseAsset): Promise<void> {
  const db = await openTeacherCourseDb();
  const transaction = db.transaction([ASSETS_STORE, BLOBS_STORE, COURSES_STORE], "readwrite");
  transaction.objectStore(ASSETS_STORE).delete(asset.id);
  transaction.objectStore(BLOBS_STORE).delete(asset.id);

  const coursesStore = transaction.objectStore(COURSES_STORE);
  const currentCourse = await runStoreRequest<TeacherCourseRecord | undefined>(
    coursesStore.get(asset.courseId)
  );
  if (currentCourse) {
    coursesStore.put({ ...currentCourse, updatedAt: new Date().toISOString() });
  }

  await waitForTransaction(transaction);
}
