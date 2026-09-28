/**
 * The Postgres connection string, whatever the host decided to call it.
 *
 * Vercel's Neon integration has shipped under several names: the current marketplace version sets
 * DATABASE_URL, while older Vercel Postgres and some Neon setups only set POSTGRES_URL or the
 * non-pooled variants. Accepting all of them means connecting the database in the Storage tab is
 * enough, with no manual variable to add or rename.
 */
const CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

export function databaseUrl(): string | undefined {
  for (const name of CANDIDATES) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

/** What to tell someone when none of them are set. */
export const NO_DATABASE_MESSAGE =
  `No database connection string found. Looked for ${CANDIDATES.join(", ")}. ` +
  "Add a Neon database from your Vercel project's Storage tab, then redeploy — " +
  "a deployment that already exists will not pick up a variable added after it was built.";
