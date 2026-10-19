/**
 * 鉴权工具：优先从 HttpOnly cookie session 提取用户信息。
 * 客户端身份 Header 不参与鉴权。
 */

import type { UserRole } from './roles';
import { ApiError } from './errors';
import { AUTH_SESSION_COOKIE, parseAuthSession } from '@/lib/auth/server-session';

export interface SessionUser {
  id: string;
  username?: string;
  role: UserRole;
  name?: string;
  phone?: string;
}

/** 从请求中提取 session（不存在则抛 401） */
export function requireSession(req: Request): SessionUser {
  const user = getSession(req);
  if (!user) throw ApiError.unauthorized();
  return user;
}

/** 从请求中提取 session（不存在返回 null） */
export function getSession(req: Request): SessionUser | null {
  const cookieSession = parseAuthSession(readCookie(req, AUTH_SESSION_COOKIE));
  if (cookieSession) {
    return {
      id: cookieSession.userId,
      username: cookieSession.username,
      role: cookieSession.role,
      name: cookieSession.name,
      phone: cookieSession.username,
    };
  }

  return null;
}

/** 要求特定角色 */
export function requireRole(user: SessionUser, roles: UserRole | UserRole[]): void {
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.includes(user.role)) {
    throw ApiError.forbidden('当前身份无权访问该接口', 10003);
  }
}

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((item) => item.trim());
  const matched = cookies.find((item) => item.startsWith(`${name}=`));
  if (!matched) return null;

  try {
    return decodeURIComponent(matched.slice(name.length + 1));
  } catch {
    return null;
  }
}
