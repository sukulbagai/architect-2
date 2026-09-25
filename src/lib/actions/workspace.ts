"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { WORKSPACE_COOKIE, requireWorkspace } from "@/lib/session";

export async function setMode(mode: "simple" | "pro") {
  const parsed = z.enum(["simple", "pro"]).parse(mode);
  const ws = await requireWorkspace({ onboarded: false });
  const db = await getDb();
  await db.update(workspaces).set({ mode: parsed, updatedAt: new Date() }).where(eq(workspaces.id, ws.id));
  revalidatePath("/", "layout");
}

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  role: z.string().trim().max(40).optional(),
});

export async function updateProfile(input: z.infer<typeof profileSchema>) {
  const data = profileSchema.parse(input);
  const ws = await requireWorkspace();
  const db = await getDb();
  await db.update(workspaces).set({ ...data, updatedAt: new Date() }).where(eq(workspaces.id, ws.id));
  revalidatePath("/", "layout");
}

export async function deleteWorkspace() {
  const ws = await requireWorkspace({ onboarded: false });
  const db = await getDb();
  await db.delete(workspaces).where(eq(workspaces.id, ws.id));
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/");
}
