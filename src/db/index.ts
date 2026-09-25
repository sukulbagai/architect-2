import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Production uses Neon over HTTP (DATABASE_URL, injected by the Vercel Neon integration).
 * Local development falls back to an embedded Postgres (PGlite) stored in .data/, so the app
 * runs with zero accounts. Both speak the same Postgres dialect and share one schema.
 */
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle({ client: neon(url), schema }) as unknown as DB;
  }

  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMBEDDED_DB) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon database from your Vercel project's Storage tab, then redeploy.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const globalForDb = globalThis as unknown as { __architectDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!globalForDb.__architectDb) {
    globalForDb.__architectDb = connect().catch((err) => {
      globalForDb.__architectDb = undefined;
      throw err;
    });
  }
  return globalForDb.__architectDb;
}

export { schema };
