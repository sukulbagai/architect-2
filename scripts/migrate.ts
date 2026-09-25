/**
 * Applies SQL migrations in ./drizzle to the Neon database named by DATABASE_URL.
 * Runs before `next build` on Vercel. Locally, the embedded database migrates itself on first use.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set; skipping (the embedded dev database migrates on first use).");
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
