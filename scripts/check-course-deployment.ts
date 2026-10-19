import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { courseStorageDirectory, materialSizeLimit } from "../src/lib/courses/course-file-storage";
import { getDatabasePool } from "../src/storage/database/db";

async function main() {
  assert.equal(process.env.NODE_ENV, "production", "Run this preflight with NODE_ENV=production.");
  assert.equal(process.env.ENABLE_DEMO_AUTH, "false", "Production acceptance requires ENABLE_DEMO_AUTH=false.");
  const origin = new URL(process.env.APP_ORIGIN ?? "");
  assert.equal(origin.protocol, "https:", "APP_ORIGIN must be the public HTTPS origin.");
  assert.equal(origin.origin, process.env.APP_ORIGIN, "APP_ORIGIN must not include a path or trailing slash.");
  const secret = process.env.AUTH_SESSION_SECRET ?? "";
  assert.ok(secret.length >= 32 && !/replace|generate|change-me/i.test(secret), "Configure a unique random AUTH_SESSION_SECRET.");
  assert.ok(process.env.DATABASE_URL, "Configure DATABASE_URL.");
  materialSizeLimit();
  const directory = await courseStorageDirectory();
  const probe = path.join(directory, `.preflight-${randomUUID()}`);
  const file = await open(probe, "wx", 0o600);
  try { await file.writeFile("storage probe"); await file.sync(); }
  finally { await file.close(); await unlink(probe); }
  const pool = getDatabasePool();
  try {
    const result = await pool.query("select to_regclass('public.users') is not null and to_regclass('public.courses') is not null and to_regclass('public.course_materials') is not null as ready");
    assert.equal(result.rows[0].ready, true, "Database tables are missing; review migration history.");
    console.log("PASS: production config, HTTPS origin, Demo disabled, database tables and writable persistent storage. No secrets displayed; no business records changed.");
  } finally { await pool.end(); }
}
main().catch(() => { console.error("FAIL: production preflight. Check required configuration, database connectivity/tables and storage permissions; secrets are not logged."); process.exitCode = 1; });
