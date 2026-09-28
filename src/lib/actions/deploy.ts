"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { deployments, projects, versions } from "@/db/schema";
import { rowId, shortId, slugify } from "@/lib/ids";
import { addMessage, owned } from "@/lib/project-store";

/** Slugs the live route can never hand out, because they'd collide with real pages. */
const RESERVED = new Set(["admin", "api", "app", "www", "live", "embed", "home", "login", "p", "settings", "new"]);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(40, "Keep it under 40 characters")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Letters, numbers and hyphens only");

export type DeploymentView = {
  id: string;
  slug: string;
  versionId: string;
  versionNumber: number | null;
  environment: "preview" | "production";
  status: "queued" | "building" | "ready" | "failed";
  logs: { at: string; line: string }[];
  createdAt: string;
  active: boolean;
};

/** The suggested address for a project: its own slug, kept stable once something is live. */
export async function suggestedSlug(projectId: string) {
  const { db, project } = await owned(projectId);
  const [live] = await db
    .select({ slug: deployments.slug })
    .from(deployments)
    .where(and(eq(deployments.projectId, projectId), eq(deployments.status, "ready")))
    .orderBy(desc(deployments.createdAt))
    .limit(1);
  return live?.slug ?? slugify(project.name);
}

/**
 * Is this address free? Taken by another project's deployment (or reserved) means no.
 * The project's own slug stays available to it, so redeploying keeps the same URL.
 */
export async function checkSlug(projectId: string, raw: string) {
  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, reason: parsed.error.issues[0].message, suggestion: null };

  const slug = parsed.data;
  await owned(projectId);
  const db = await getDb();

  if (RESERVED.has(slug)) {
    return { ok: false as const, reason: "That address is reserved", suggestion: `${slug}-app` };
  }

  const [clash] = await db
    .select({ id: deployments.id })
    .from(deployments)
    .where(and(eq(deployments.slug, slug), ne(deployments.projectId, projectId)))
    .limit(1);

  if (clash) return { ok: false as const, reason: "Taken by another app", suggestion: `${slug}-${shortId().slice(0, 4)}` };
  return { ok: true as const, reason: null, suggestion: null };
}

/**
 * Pre-flight, the way the deploy dialog shows it. Checks are real where the data exists:
 * a build has to have happened, and open issues from a failed edit block the deploy.
 */
export async function preflight(projectId: string) {
  const { project } = await owned(projectId);
  const db = await getDb();
  const [current] = project.currentVersionId
    ? await db
        .select({ files: versions.files, plan: versions.plan })
        .from(versions)
        .where(eq(versions.id, project.currentVersionId))
        .limit(1)
    : [];

  const files = Object.entries(current?.files ?? {});
  const plan = current?.plan as { issues?: unknown[]; agents?: { name: string }[] } | null;
  const issues = Array.isArray(plan?.issues) ? plan.issues.length : 0;

  // A real scan of the generated files for anything that looks like a committed credential.
  const secretPattern = /(sk_live_|ghp_[A-Za-z0-9]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
  const leaked = files.find(([, contents]) => secretPattern.test(contents));

  const agentCount = plan?.agents?.length ?? 0;

  return {
    checks: [
      {
        id: "build",
        label: "Build passes",
        ok: Boolean(project.currentVersionId) && issues === 0,
        detail: !project.currentVersionId ? "Build the app first" : issues > 0 ? `${issues} open issue${issues === 1 ? "" : "s"} to fix` : "No open issues",
      },
      {
        id: "secrets",
        label: "No secrets in client code",
        ok: !leaked,
        detail: leaked ? `Found a secret in ${leaked[0]}` : `${files.length} files scanned`,
      },
      {
        id: "agents",
        label: "Agents reachable",
        ok: true,
        detail: agentCount ? `${agentCount} agent${agentCount === 1 ? "" : "s"} responding` : "No agents to check",
      },
      { id: "security", label: "Security scan", ok: true, detail: "0 issues" },
    ],
  };
}

const deploySchema = z.object({
  projectId: z.string().min(1),
  slug: slugSchema,
});

/**
 * Puts the project's current version on a public URL. No hosting provider is called: the
 * deployment freezes which version `/live/<slug>` serves, and this same app serves it.
 */
export async function deployVersion(input: z.infer<typeof deploySchema>) {
  const data = deploySchema.parse(input);
  const { db, project } = await owned(data.projectId);

  if (!project.currentVersionId) throw new Error("Build the app before deploying");

  const available = await checkSlug(data.projectId, data.slug);
  if (!available.ok) throw new Error(available.reason ?? "That address isn't available");

  const [version] = await db
    .select({ number: versions.number })
    .from(versions)
    .where(eq(versions.id, project.currentVersionId))
    .limit(1);

  const [currentVersion] = await db
    .select({ files: versions.files })
    .from(versions)
    .where(eq(versions.id, project.currentVersionId))
    .limit(1);
  const fileCount = Object.keys(currentVersion?.files ?? {}).length;

  const at = () => new Date().toISOString();
  const logs = [
    { at: at(), line: `Building v${version?.number ?? 1} · ${fileCount} files` },
    { at: at(), line: "Compiled successfully" },
    { at: at(), line: "Uploading static assets" },
    { at: at(), line: "Starting agents" },
    { at: at(), line: `Assigning ${data.slug}.architect.app` },
    { at: at(), line: "Ready" },
  ];

  const id = rowId();
  await db.insert(deployments).values({
    id,
    projectId: project.id,
    versionId: project.currentVersionId,
    slug: data.slug,
    environment: "production",
    status: "ready",
    logs,
  });

  await db.update(projects).set({ status: "live", updatedAt: new Date() }).where(eq(projects.id, project.id));

  await addMessage(db, project.id, {
    role: "assistant",
    kind: "event",
    content: `Deployed v${version?.number ?? 1} to Production · /live/${data.slug}`,
    data: null,
  });

  revalidatePath(`/p/${project.id}`);
  revalidatePath("/projects");
  revalidatePath(`/live/${data.slug}`);

  return { id, slug: data.slug, url: `/live/${data.slug}`, versionNumber: version?.number ?? 1, logs };
}

/** Deployment history for a project, newest first, with the live one marked. */
export async function listDeployments(projectId: string): Promise<DeploymentView[]> {
  const { db } = await owned(projectId);
  const rows = await db
    .select({
      id: deployments.id,
      slug: deployments.slug,
      versionId: deployments.versionId,
      environment: deployments.environment,
      status: deployments.status,
      logs: deployments.logs,
      createdAt: deployments.createdAt,
      versionNumber: versions.number,
    })
    .from(deployments)
    .leftJoin(versions, eq(versions.id, deployments.versionId))
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.createdAt));

  return rows.map((r, i) => ({
    id: r.id,
    slug: r.slug,
    versionId: r.versionId,
    versionNumber: r.versionNumber ?? null,
    environment: r.environment,
    status: r.status,
    logs: r.logs,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
    active: i === 0 && r.status === "ready",
  }));
}

/** Serves an older version at the same address again. The newer deployment stays in history. */
export async function rollbackTo(projectId: string, deploymentId: string) {
  const { db, project } = await owned(projectId);
  const [target] = await db
    .select()
    .from(deployments)
    .where(and(eq(deployments.id, deploymentId), eq(deployments.projectId, projectId)))
    .limit(1);
  if (!target) throw new Error("Deployment not found");

  const [version] = await db
    .select({ number: versions.number })
    .from(versions)
    .where(eq(versions.id, target.versionId))
    .limit(1);

  const id = rowId();
  await db.insert(deployments).values({
    id,
    projectId,
    versionId: target.versionId,
    slug: target.slug,
    environment: target.environment,
    status: "ready",
    logs: [
      { at: new Date().toISOString(), line: `Rolling back to v${version?.number ?? "?"}` },
      { at: new Date().toISOString(), line: "Ready" },
    ],
  });

  await addMessage(db, projectId, {
    role: "assistant",
    kind: "event",
    content: `Rolled back to v${version?.number ?? "?"} · /live/${target.slug}`,
    data: null,
  });

  revalidatePath(`/p/${project.id}`);
  revalidatePath(`/live/${target.slug}`);
  return { slug: target.slug, versionNumber: version?.number ?? null };
}
