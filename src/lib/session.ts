import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaces, type Workspace } from "@/db/schema";

export const WORKSPACE_COOKIE = "architect_ws";

export const workspaceCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** The signed-in workspace for this request, or null. Deduped per request. */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const id = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return ws ?? null;
});

/** Use in pages and server actions that need a workspace. Redirects when there isn't one. */
export async function requireWorkspace(opts: { onboarded?: boolean } = {}): Promise<Workspace> {
  const { onboarded = true } = opts;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (onboarded && !ws.onboardedAt) redirect("/welcome");
  return ws;
}
