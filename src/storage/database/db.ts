import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./shared/schema";

type AppDatabase = NodePgDatabase<typeof schema>;

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.COZE_DATABASE_URL;

let pool: Pool | null = null;
let database: AppDatabase | null = null;

export function getDatabasePool(): Pool {
  if (!databaseUrl) {
    throw new Error("Database URL is not configured. Set DATABASE_URL, POSTGRES_URL, or COZE_DATABASE_URL.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5000),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS ?? 30000),
    });
  }

  return pool;
}

export function getDatabase(): AppDatabase {
  if (!database) {
    database = drizzle(getDatabasePool(), { schema });
  }

  return database;
}

export type { AppDatabase };

