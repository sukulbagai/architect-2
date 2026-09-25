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
export async function signIn(input: z.infer<typeof signInSchema>) {
  const data = signInSchema.parse(input);
  const db = await getDb();
  const existing = await getWorkspace();

  if (existing) {
    await db
      .update(workspaces)
      .set({ name: data.name, email: data.email, signInMethod: data.method, updatedAt: new Date() })
      .where(eq(workspaces.id, existing.id));
    return { next: existing.onboardedAt ? "/home" : "/welcome" };
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
  return { next: "/welcome" };
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
