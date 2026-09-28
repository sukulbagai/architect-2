/**
 * Applies SQL migrations in ./drizzle to the Neon database named by DATABASE_URL.
 * Runs before `next build` on Vercel. Locally, the embedded database migrates itself on first use.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { databaseUrl } from "../src/db/url";

async function main() {
  const url = databaseUrl();
  if (!url) {
    console.log("[migrate] No connection string set; skipping (the embedded dev database migrates on first use).");
    return;
  }
  const db = drizzle({ client: neon(url) });
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("[migrate] Neon schema is up to date.");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
