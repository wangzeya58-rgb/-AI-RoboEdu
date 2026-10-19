import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { authFetch } from "../src/lib/auth/client";
import { getSession, requireSession } from "../src/lib/api/auth";
import { getSessionUser } from "../src/lib/auth/session";
import { NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE, createAuthSession, serializeAuthSession } from "../src/lib/auth/server-session";
import { middleware } from "../src/middleware";

test("authFetch uses cookies and strips legacy identity headers", async (t) => {
  let called = false;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    called = true;
    const headers = new Headers(init.headers);
    for (const name of ["x-user-id", "x-user-role", "x-user-name"]) assert.equal(headers.has(name), false);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(init.credentials, "same-origin");
    return Response.json({ success: true });
  });
  await authFetch("/api/v1/courses", { headers: { "x-user-id": randomUUID(), "x-user-role": "admin", "x-user-name": "fake", "content-type": "application/json" } });
  assert.ok(called);
});

test("both server auth helpers reject identity headers without signed cookies", () => {
  const request = new NextRequest("http://localhost/api/v1/courses", { headers: { "x-user-id": randomUUID(), "x-user-role": "admin" } });
  assert.equal(getSession(request), null);
  assert.equal(getSessionUser(request), null);
  assert.throws(() => requireSession(request));
});

test("Chinese names work in signed cookies and spoofed role headers are ignored", () => {
  const userId = randomUUID();
  const payload = createAuthSession({ userId, username: "test", name: "中文教师", role: "teacher" });
  const request = new NextRequest("http://localhost/api/v1/courses", { headers: {
    cookie: `${AUTH_SESSION_COOKIE}=${serializeAuthSession(payload)}`, "x-user-role": "admin", "x-user-id": randomUUID(),
  } });
  assert.equal(requireSession(request).role, "teacher");
  assert.equal(requireSession(request).name, "中文教师");
  assert.equal(getSessionUser(request)?.id, userId);
});

test("expired or malformed session cookies cannot grant access", () => {
  const payload = createAuthSession({ userId: randomUUID(), username: "test", name: "管理员", role: "admin" });
  payload.expiresAt = Date.now() - 1000;
  for (const value of [serializeAuthSession(payload), "%invalid", "invalid.signature"]) {
    const request = new Request("http://localhost/api/v1/courses", { headers: { cookie: `${AUTH_SESSION_COOKIE}=${value}` } });
    assert.equal(getSession(request), null);
  }
});

test("authentication redirects and errors cannot be cached across login/logout", async () => {
  for (const path of ["/admin/courses", "/teacher/courses", "/api/v1/courses"]) {
    const response = await middleware(new NextRequest(`http://localhost${path}`));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.status, path.startsWith("/api") ? 401 : 307);
  }
});

test("authentication redirects preserve the original local hostname", async () => {
  const config = (await import("../next.config")).default;
  assert.equal(config.skipProxyUrlNormalize, true);
  const previous = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE;
  try {
    // Next sets this internal flag from skipProxyUrlNormalize at runtime.
    process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = "1";
    const response = await middleware(new NextRequest("http://127.0.0.1:5000/admin/courses"));
    assert.equal(new URL(response.headers.get("location")!).hostname, "127.0.0.1");
  } finally {
    if (previous === undefined) delete process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE;
    else process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE = previous;
  }
});
