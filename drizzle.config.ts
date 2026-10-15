import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.COZE_DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "Drizzle config loaded without DATABASE_URL/POSTGRES_URL/COZE_DATABASE_URL. Generate can still run against schema; push/migrate requires a database URL."
  );
}

export default defineConfig({
  schema: "./src/storage/database/shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgres://user:password@localhost:5432/ai_roboedu",
  },
  strict: true,
  verbose: true,
});

