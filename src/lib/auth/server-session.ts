import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Role } from "./roles";
import { ROLES } from "./roles";
import { isDemoAuthAllowed } from "./demo-users";

export const AUTH_SESSION_COOKIE = "ai_roboedu_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AuthSessionPayload {
  userId: string;
  username: string;
  name: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (secret && secret.length >= 32 && (process.env.NODE_ENV !== "production" || !/replace|generate|change-me/i.test(secret))) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET or NEXTAUTH_SECRET must be set to at least 32 characters in production.");
  }

  return "dev-ai-roboedu-session-secret";
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodePayload(payload: AuthSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): AuthSessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AuthSessionPayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.role !== "string" ||
      ![ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN].includes(parsed.role as Role) ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed as AuthSessionPayload;
  } catch {
    return null;
  }
}

export function createAuthSession(input: {
  userId: string;
  username: string;
  name: string;
  role: Role;
}): AuthSessionPayload {
  const issuedAt = Date.now();
  return {
    ...input,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS * 1000,
  };
}

export function serializeAuthSession(payload: AuthSessionPayload): string {
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function parseAuthSession(value?: string | null): AuthSessionPayload | null {
  if (!value) return null;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.expiresAt <= Date.now()) return null;
  if (payload.userId.startsWith("demo-") && !isDemoAuthAllowed()) return null;
  return payload;
}

export function getAuthSessionFromRequest(request: NextRequest): AuthSessionPayload | null {
  return parseAuthSession(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
}

export function buildAuthCookie(value: string): AuthCookieOptions {
  return {
    name: AUTH_SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function buildExpiredAuthCookie(): AuthCookieOptions {
  return {
    ...buildAuthCookie(""),
    maxAge: 0,
  };
}
