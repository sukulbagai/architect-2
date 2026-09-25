import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, versions } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { PreviewApp } from "@/components/preview/preview-app";
import type { Plan } from "@/lib/sim/types";

async function load(id: string, sp: { v?: string | string[]; draft?: string | string[] }) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) return null;
  const versionId = typeof sp.v === "string" ? sp.v : sp.draft ? null : project.currentVersionId;
  if (versionId) {
    const [v] = await db
      .select({ plan: versions.plan })
      .from(versions)
      .where(and(eq(versions.id, versionId), eq(versions.projectId, id)))
      .limit(1);
    if (v?.plan) return v.plan as Plan;
  }
  return (project.plan as Plan | null) ?? null;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/p/[id]/preview">) {
  const plan = await load((await params).id, await searchParams);
  return { title: plan ? { absolute: plan.appName } : "Preview" };
}

export default async function PreviewPage({ params, searchParams }: PageProps<"/p/[id]/preview">) {
  const { id } = await params;
  const sp = await searchParams;
  const plan = await load(id, sp);
  if (plan === null) notFound();
  return (
    <PreviewApp
      plan={plan}
      initialPage={typeof sp.page === "string" ? sp.page : undefined}
      embedded={sp.embed === "1"}
    />
  );
}
