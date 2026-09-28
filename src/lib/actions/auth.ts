"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { secretId } from "@/lib/ids";
import { WORKSPACE_COOKIE, getWorkspace, workspaceCookieOptions } from "@/lib/session";

const signInSchema = z.object({
  method: z.enum(["google", "github", "email"]),
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
});

/**
 * Simulated sign-in. There is no password or OAuth: the browser gets a random workspace id in an
 * httpOnly cookie. Signing in again on the same browser reuses that workspace, so projects persist.
 * We never look a workspace up by email, because an unverified email must not unlock someone's data.
 */
/**
 * Turns a database failure into something the sign-in screen can actually show. Next.js redacts
 * thrown server-action errors in production, so the reason has to travel back as a value.
 */
function signInFailure(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;

  // 42P01: the table isn't there, so the migrations never ran against this database.
  if (code === "42P01" || /relation .* does not exist/i.test(message)) {
    return "The database has no tables yet. Redeploy so the build runs its migrations against Neon.";
  }
  if (/DATABASE_URL is not set/i.test(message)) {
    return "No database is connected. Add a Neon database in the Vercel Storage tab, then redeploy.";
  }
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|terminating connection/i.test(message)) {
    return "The database didn't answer. Check that the Neon database is awake, then try again.";
  }
  return "Something went wrong reaching the database. Try again in a moment.";
}

export async function signIn(input: z.infer<typeof signInSchema>) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, reason: "Check the name and email, then try again." };
  const data = parsed.data;

  try {
    const db = await getDb();
    const existing = await getWorkspace();

    if (existing) {
      await db
        .update(workspaces)
        .set({ name: data.name, email: data.email, signInMethod: data.method, updatedAt: new Date() })
        .where(eq(workspaces.id, existing.id));
      return { ok: true as const, next: existing.onboardedAt ? "/home" : "/welcome" };
    }

    const id = secretId();
    await db.insert(workspaces).values({
      id,
      name: data.name,
      email: data.email,
      signInMethod: data.method,
      avatarHue: Math.floor(Math.random() * 360),
      mode: "simple",
    });
    (await cookies()).set(WORKSPACE_COOKIE, id, workspaceCookieOptions);
    return { ok: true as const, next: "/welcome" };
  } catch (err) {
    // Server logs keep the real error; the browser gets a sentence someone can act on.
    console.error("[signIn] failed:", err);
    return { ok: false as const, reason: signInFailure(err) };
  }
}

const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(40),
  mode: z.enum(["simple", "pro"]),
});

export async function completeOnboarding(input: z.infer<typeof onboardingSchema>) {
  const data = onboardingSchema.parse(input);
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const db = await getDb();
  await db
    .update(workspaces)
    .set({ ...data, onboardedAt: new Date(), updatedAt: new Date() })
    .where(eq(workspaces.id, ws.id));
  revalidatePath("/", "layout");
  return { next: "/home" };
}

export async function signOut() {
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/");
}
