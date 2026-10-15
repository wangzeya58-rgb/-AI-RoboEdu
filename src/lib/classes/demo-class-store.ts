"use client";

import type { SessionInfo } from "@/lib/auth/client";

const CLASS_STORE_KEY = "ai_roboedu_demo_classes_v1";
export const CLASS_STORE_EVENT = "ai-roboedu-class-store-change";

export type ClassMemberStatus = "pending" | "approved" | "rejected";

export interface DemoClass {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  teacherName: string;
  authorizedTeacherIds: string[];
  createdAt: string;
}

export interface DemoClassMember {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  status: ClassMemberStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface DemoClassState {
  classes: DemoClass[];
  members: DemoClassMember[];
  version: number;
}

export interface ClassStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface ClassSummary {
  classInfo: DemoClass;
  stats: ClassStats;
}

export type JoinClassResult =
  | { status: "created"; member: DemoClassMember; classInfo: DemoClass }
  | { status: "not_found" }
  | { status: "already_pending"; member: DemoClassMember; classInfo: DemoClass }
  | { status: "already_approved"; member: DemoClassMember; classInfo: DemoClass }
  | { status: "already_rejected"; member: DemoClassMember; classInfo: DemoClass };

export type ReviewResult =
  | { status: "updated"; member: DemoClassMember }
  | { status: "not_found" }
  | { status: "forbidden" };

const EMPTY_STATE: DemoClassState = {
  classes: [],
  members: [],
  version: 1,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitClassStoreChange(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(CLASS_STORE_EVENT));
}

function safeParseState(raw: string | null): DemoClassState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<DemoClassState>;
    return {
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      version: typeof parsed.version === "number" ? parsed.version : 1,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function readClassState(): DemoClassState {
  if (!isBrowser()) return EMPTY_STATE;
  return safeParseState(localStorage.getItem(CLASS_STORE_KEY));
}

function writeClassState(state: DemoClassState): void {
  if (!isBrowser()) return;
  localStorage.setItem(CLASS_STORE_KEY, JSON.stringify(state));
  emitClassStoreChange();
}

export function subscribeClassStore(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(CLASS_STORE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CLASS_STORE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function normalizeClassId(value: string): string {
  return value.trim().toUpperCase();
}

function createStableClassId(state: DemoClassState, teacherId: string): string {
  const teacherPart = teacherId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase() || "DEMO";
  let index = state.classes.filter((item) => item.teacherId === teacherId).length + 1;
  let id = `CLS-${teacherPart}-${String(index).padStart(3, "0")}`;
  const existing = new Set(state.classes.map((item) => item.id));

  while (existing.has(id)) {
    index += 1;
    id = `CLS-${teacherPart}-${String(index).padStart(3, "0")}`;
  }

  return id;
}

export function canManageClass(classInfo: DemoClass, teacherId: string): boolean {
  return (
    classInfo.teacherId === teacherId || classInfo.authorizedTeacherIds.includes(teacherId)
  );
}

export function createDemoClass(input: {
  name: string;
  description: string;
  teacher: SessionInfo;
}): DemoClass {
  const state = readClassState();
  const classInfo: DemoClass = {
    id: createStableClassId(state, input.teacher.id),
    name: input.name.trim(),
    description: input.description.trim(),
    teacherId: input.teacher.id,
    teacherName: input.teacher.name,
    authorizedTeacherIds: [],
    createdAt: new Date().toISOString(),
  };

  writeClassState({
    ...state,
    classes: [classInfo, ...state.classes],
  });

  return classInfo;
}

export function getClassById(classId: string): DemoClass | null {
  const normalized = normalizeClassId(classId);
  return readClassState().classes.find((item) => item.id === normalized) ?? null;
}

export function getClassStats(classId: string): ClassStats {
  const members = readClassState().members.filter((item) => item.classId === classId);
  const approved = members.filter((item) => item.status === "approved").length;
  const pending = members.filter((item) => item.status === "pending").length;
  const rejected = members.filter((item) => item.status === "rejected").length;
  return {
    approved,
    pending,
    rejected,
    total: members.length,
  };
}

export function listClassesForTeacher(teacherId: string): ClassSummary[] {
  return readClassState()
    .classes.filter((item) => canManageClass(item, teacherId))
    .map((classInfo) => ({
      classInfo,
      stats: getClassStats(classInfo.id),
    }));
}

export function listAllClassSummaries(): ClassSummary[] {
  return readClassState().classes.map((classInfo) => ({
    classInfo,
    stats: getClassStats(classInfo.id),
  }));
}

export function listMembersForClass(classId: string): DemoClassMember[] {
  return readClassState()
    .members.filter((item) => item.classId === classId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function listMembershipsForStudent(studentId: string): Array<{
  member: DemoClassMember;
  classInfo: DemoClass | null;
}> {
  const state = readClassState();
  return state.members
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((member) => ({
      member,
      classInfo: state.classes.find((item) => item.id === member.classId) ?? null,
    }));
}

export function requestJoinClass(classId: string, student: SessionInfo): JoinClassResult {
  const normalized = normalizeClassId(classId);
  const state = readClassState();
  const classInfo = state.classes.find((item) => item.id === normalized);

  if (!classInfo) return { status: "not_found" };

  const existing = state.members.find(
    (item) => item.classId === normalized && item.studentId === student.id
  );

  if (existing) {
    if (existing.status === "pending") {
      return { status: "already_pending", member: existing, classInfo };
    }
    if (existing.status === "approved") {
      return { status: "already_approved", member: existing, classInfo };
    }
    return { status: "already_rejected", member: existing, classInfo };
  }

  const now = new Date().toISOString();
  const member: DemoClassMember = {
    id: `${normalized}-${student.id}-${Date.now()}`,
    classId: normalized,
    studentId: student.id,
    studentName: student.name,
    status: "pending",
    requestedAt: now,
  };

  writeClassState({
    ...state,
    members: [member, ...state.members],
  });

  return { status: "created", member, classInfo };
}

export function reviewClassMember(
  memberId: string,
  teacher: SessionInfo,
  status: "approved" | "rejected"
): ReviewResult {
  const state = readClassState();
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return { status: "not_found" };

  const classInfo = state.classes.find((item) => item.id === member.classId);
  if (!classInfo || !canManageClass(classInfo, teacher.id)) {
    return { status: "forbidden" };
  }

  const updated: DemoClassMember = {
    ...member,
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: teacher.id,
  };

  writeClassState({
    ...state,
    members: state.members.map((item) => (item.id === memberId ? updated : item)),
  });

  return { status: "updated", member: updated };
}

export function removeClassMember(memberId: string, teacher: SessionInfo): ReviewResult {
  const state = readClassState();
  const member = state.members.find((item) => item.id === memberId);
  if (!member) return { status: "not_found" };

  const classInfo = state.classes.find((item) => item.id === member.classId);
  if (!classInfo || !canManageClass(classInfo, teacher.id)) {
    return { status: "forbidden" };
  }

  writeClassState({
    ...state,
    members: state.members.filter((item) => item.id !== memberId),
  });

  return { status: "updated", member };
}

