import { NextRequest, NextResponse } from "next/server";
import type { AuthSessionPayload } from "@/lib/auth/server-session";
import { ROLES, type Role } from "@/lib/auth/roles";
import { isDemoAuthAllowed } from "@/lib/auth/demo-users";

const AUTH_SESSION_COOKIE = "ai_roboedu_session";
const PUBLIC_API_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/demo-login",
  "/api/v1/auth/logout",
]);

const PAGE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: [ROLES.ADMIN] },
  { prefix: "/teacher", roles: [ROLES.TEACHER] },
  { prefix: "/class/join", roles: [ROLES.STUDENT] },
  { prefix: "/course/manage", roles: [ROLES.TEACHER, ROLES.ADMIN] },
];

const API_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/api/v1/admin", roles: [ROLES.ADMIN] },
  { prefix: "/api/v1/teacher", roles: [ROLES.TEACHER] },
  { prefix: "/api/admin", roles: [ROLES.ADMIN] },
  { prefix: "/api/teacher", roles: [ROLES.TEACHER] },
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isStaticOrInternalPath(pathname)) {
    return NextResponse.next();
  }

  const session = await parseMiddlewareSession(request.cookies.get(AUTH_SESSION_COOKIE)?.value);

  if (pathname === "/login" && session) {
    return authRedirect(new URL(getRoleHome(session.role), request.url));
  }

  if (pathname.startsWith("/api")) {
    return handleApiAuth(request, session);
  }

  return handlePageAuth(request, session);
}

function handlePageAuth(request: NextRequest, session: AuthSessionPayload | null) {
  const pathname = request.nextUrl.pathname;
  const rule = PAGE_RULES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));

  if (!rule) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return authRedirect(loginUrl);
  }

  if (!rule.roles.includes(session.role)) {
    return authRedirect(new URL(getRoleHome(session.role), request.url));
  }

  return NextResponse.next();
}

function handleApiAuth(request: NextRequest, session: AuthSessionPayload | null) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_API_PATHS.has(pathname)) return NextResponse.next();

  if (!session) {
    return jsonError(401, 10002, "未登录或登录已过期");
  }

  const rule = API_RULES.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  if (rule && !rule.roles.includes(session.role)) {
    return jsonError(403, 10003, "当前身份无权访问该接口");
  }

  return NextResponse.next();
}

async function parseMiddlewareSession(value?: string | null): Promise<AuthSessionPayload | null> {
  if (!value) return null;
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const secret = getMiddlewareSecret();
  if (!secret) return null;

  const expectedSignature = await sign(encodedPayload, secret);
  if (!timingSafeStringEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AuthSessionPayload>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      ![ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN].includes(payload.role as Role) ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    if (payload.userId.startsWith("demo-") && !isDemoAuthAllowed()) return null;
    return payload as AuthSessionPayload;
  } catch {
    return null;
  }
}

function getMiddlewareSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32 && (process.env.NODE_ENV !== "production" || !/replace|generate|change-me/i.test(secret))) return secret;
  if (process.env.NODE_ENV === "production") return null;
  return "dev-ai-roboedu-session-secret";
}

async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  return atob(base64);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function jsonError(status: number, code: number, message: string) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      error: { code, message },
    },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function authRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function getRoleHome(role: Role): string {
  if (role === ROLES.ADMIN) return "/admin";
  if (role === ROLES.TEACHER) return "/teacher";
  return "/";
}

function isStaticOrInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?)$/i) !== null
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
