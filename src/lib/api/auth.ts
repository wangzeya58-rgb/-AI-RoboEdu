/**
 * 鉴权工具：优先从 HttpOnly cookie session 提取用户信息。
 * 迁移期可在非生产环境继续兼容 legacy x-user-* header。
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

  if (!allowLegacyHeaderAuth()) return null;

  const userId = req.headers.get('x-user-id')?.trim();
  if (!userId) return null;
  const role = req.headers.get('x-user-role')?.trim() as UserRole | undefined;
  return {
    id: userId,
    role: role ?? ('student' as UserRole),
    name: req.headers.get('x-user-name')?.trim() || undefined,
    phone: req.headers.get('x-user-phone')?.trim() || undefined,
  };
}

/** 要求特定角色 */
export function requireRole(user: SessionUser, roles: UserRole | UserRole[]): void {
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.includes(user.role)) {
    throw ApiError.forbidden('当前身份无权访问该接口', 10003);
  }
}

function allowLegacyHeaderAuth(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_LEGACY_HEADER_AUTH === 'true'
  );
}

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((item) => item.trim());
  const matched = cookies.find((item) => item.startsWith(`${name}=`));
  if (!matched) return null;

  return decodeURIComponent(matched.slice(name.length + 1));
}
