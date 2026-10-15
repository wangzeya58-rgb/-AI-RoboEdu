import { NextRequest } from "next/server";
import { ROLES, type Role } from "./roles";
import { getAuthSessionFromRequest } from "./server-session";

export interface SessionUser {
  id: string;
  username?: string;
  name: string;
  phone: string;
  role: Role;
  class_menu_locked?: boolean;
}

export function getSessionUser(request: NextRequest): SessionUser | null {
  const cookieSession = getAuthSessionFromRequest(request);
  if (cookieSession) {
    return {
      id: cookieSession.userId,
      username: cookieSession.username,
      name: cookieSession.name,
      phone: cookieSession.username,
      role: cookieSession.role,
    };
  }

  if (!allowLegacyHeaderAuth()) return null;

  const userId = request.headers.get("x-user-id");
  if (!userId) return null;
  const role = (request.headers.get("x-user-role") || ROLES.STUDENT) as Role;
  return {
    id: userId,
    username: request.headers.get("x-user-name") || undefined,
    name: request.headers.get("x-user-name") || "Demo 用户",
    phone: request.headers.get("x-user-phone") || userId,
    role,
  };
}

export function isAdminOrTeacher(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === ROLES.ADMIN || user.role === ROLES.TEACHER;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === ROLES.ADMIN;
}

function allowLegacyHeaderAuth(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_LEGACY_HEADER_AUTH === "true"
  );
}
