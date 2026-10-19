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

  return null;
}

export function isAdminOrTeacher(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === ROLES.ADMIN || user.role === ROLES.TEACHER;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === ROLES.ADMIN;
}
