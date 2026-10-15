/**
 * 客户端 session 工具
 * - 存于 localStorage 中的用户信息
 * - 调用 API 时附加 x-user-id 头
 */
"use client";

import type { Role } from "./roles";
import { ROLE_LABEL, ROLES } from "./roles";
import { DEMO_USERS, findDemoUser, type DemoUser } from "./demo-users";

const SESSION_KEY = "al_session";

export interface SessionInfo {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: Role;
  class_menu_locked?: boolean;
  classId?: string;
  courseIds?: string[];
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: number;
}

export type FormalLoginResult =
  | { status: "success"; session: SessionInfo }
  | { status: "invalid"; message: string }
  | { status: "unavailable"; message: string };

export { DEMO_USERS, type DemoUser };

function emitSessionChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("al-session-change"));
}

export function setSession(info: SessionInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(info));
  emitSessionChange();
}

export function getSession(): SessionInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  emitSessionChange();
}

export function loginDemoUser(username: string, password: string): SessionInfo | null {
  const matched = findDemoUser(username, password);
  if (!matched) return null;
  const session = {
    ...matched.session,
    createdAt: new Date().toISOString(),
  };
  setSession(session);
  return session;
}

export async function loginDemoUserWithServerSession(
  username: string,
  password: string
): Promise<SessionInfo | null> {
  const response = await fetch("/api/v1/auth/demo-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);

  if (!response) return loginDemoUser(username, password);

  const body = (await response.json().catch(() => null)) as ApiResponse<SessionInfo> | null;

  if (!response.ok || !body?.success || !body.data) {
    return null;
  }

  setSession(body.data);
  return body.data;
}

export async function loginFormalUser(username: string, password: string): Promise<SessionInfo | null> {
  const result = await loginFormalUserWithStatus(username, password);
  return result.status === "success" ? result.session : null;
}

export async function loginFormalUserWithStatus(
  username: string,
  password: string
): Promise<FormalLoginResult> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).catch(() => null);

  if (!response) {
    return { status: "unavailable", message: "正式认证服务暂不可用。" };
  }

  const body = (await response.json().catch(() => null)) as ApiResponse<SessionInfo> | null;

  if (response.ok && body?.success && body.data) {
    setSession(body.data);
    return { status: "success", session: body.data };
  }

  if (response.status === 503 || response.status >= 500) {
    return {
      status: "unavailable",
      message: body?.message ?? "正式认证服务暂不可用。",
    };
  }

  return {
    status: "invalid",
    message: body?.message ?? "账号或密码错误。",
  };
}

export async function logoutFormalUser(): Promise<void> {
  await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
}

export function getRoleHome(role: Role): string {
  if (role === ROLES.ADMIN) return "/admin";
  if (role === ROLES.TEACHER) return "/teacher";
  return "/";
}

export function getRoleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

export function updateSession(updates: Partial<SessionInfo>): SessionInfo | null {
  const current = getSession();
  if (!current) return null;
  const next = { ...current, ...updates };
  setSession(next);
  return next;
}

export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  return session ? { "x-user-id": session.id } : {};
}

/**
 * 封装 fetch，自动附加鉴权头
 */
export async function authFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const session = getSession();
  if (session) {
    headers.set("x-user-id", session.id);
    headers.set("x-user-role", session.role);
    headers.set("x-user-name", session.name);
  }
  return fetch(url, { ...init, headers });
}
