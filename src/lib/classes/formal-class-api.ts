"use client";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: number;
}

export interface FormalClassSummary {
  id: string;
  classCode: string;
  name: string;
  schoolId: string;
  teacherId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  memberCount: number;
}

export interface FormalClassMember {
  id: string;
  classId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  joinedAt: string;
  createdAt: string;
}

export interface FormalClassMemberWithUser extends FormalClassMember {
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
  };
}

export interface FormalClassDetail extends FormalClassSummary {
  members: FormalClassMember[];
}

export interface FormalStudentMembership extends FormalClassMember {
  class: FormalClassSummary;
}

export class FormalClassApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FormalClassApiError";
    this.status = status;
  }
}

export function isDemoSessionId(userId?: string | null): boolean {
  return Boolean(userId?.startsWith("demo-"));
}

export async function listFormalClasses(): Promise<FormalClassSummary[]> {
  const data = await request<{ items: FormalClassSummary[] }>("/api/v1/classes");
  return data.items;
}

export async function createFormalClass(name: string): Promise<FormalClassSummary> {
  return request<FormalClassSummary>("/api/v1/classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function getFormalClassDetail(classId: string): Promise<FormalClassDetail> {
  return request<FormalClassDetail>(`/api/v1/classes/${encodeURIComponent(classId)}`);
}

export async function requestFormalJoinClass(classCode: string): Promise<FormalClassMember> {
  return request<FormalClassMember>("/api/v1/classes/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classCode }),
  });
}

export async function listFormalStudentMemberships(): Promise<FormalStudentMembership[]> {
  const data = await request<{ items: FormalStudentMembership[] }>("/api/v1/classes/memberships");
  return data.items;
}

export async function listFormalClassMembers(
  classId: string,
  signal?: AbortSignal,
): Promise<FormalClassMemberWithUser[]> {
  const data = await request<{ items: FormalClassMemberWithUser[] }>(
    `/api/v1/classes/${encodeURIComponent(classId)}/members`,
    { signal },
  );
  return data.items;
}

export async function reviewFormalClassMember(
  classId: string,
  memberId: string,
  status: "approved" | "rejected",
): Promise<FormalClassMember> {
  return request<FormalClassMember>(
    `/api/v1/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
}

export async function removeFormalClassMember(
  classId: string,
  memberId: string,
): Promise<FormalClassMember> {
  return request<FormalClassMember>(
    `/api/v1/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" },
  );
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new FormalClassApiError(
      response.status,
      body?.message ?? statusMessage(response.status),
    );
  }

  return body.data;
}

function statusMessage(status: number): string {
  if (status === 400) return "请求参数不合法。";
  if (status === 401) return "登录已过期，请重新登录。";
  if (status === 403) return "当前账号无权访问该班级。";
  if (status === 404) return "班级不存在。";
  if (status === 409) return "当前申请或成员状态已变化，请刷新后重试。";
  return "班级服务暂不可用，请稍后重试。";
}
