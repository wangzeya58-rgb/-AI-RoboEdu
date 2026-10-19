import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabase, getDatabasePool } from "../src/storage/database/db";
import { users } from "../src/storage/database/shared/schema";

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "公司管理员";

  if (!username) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME is required.");
  }

  if (!password || password.length < 16 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || /replace|change-me|123456|password/i.test(password)) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be a unique non-placeholder password of at least 16 characters containing uppercase, lowercase and digits.");
  }

  const db = getDatabase();
  const existingAdmin = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (existingAdmin[0]) {
    throw new Error(
      `Admin already exists: ${existingAdmin[0].username} (${existingAdmin[0].id}). Refusing to create another bootstrap admin.`
    );
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser[0]) {
    throw new Error(`Username already exists: ${username}.`);
  }

  const inserted = await db
    .insert(users)
    .values({
      username,
      passwordHash: hashPassword(password),
      name,
      role: "admin",
      classMenuLocked: false,
    })
    .returning({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    });

  console.log("Bootstrap admin created:");
  console.log(JSON.stringify(inserted[0], null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getDatabasePool().end();
    } catch {
      // Database may not have been configured or opened.
    }
  });
