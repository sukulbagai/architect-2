import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, type DB } from "@/db";
import { messages, projects, usage, versions, type Message, type Project, type Version } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId } from "@/lib/ids";
import { buildPlan, matchBlueprint, modelRate } from "@/lib/sim/plan";
import { generateFiles } from "@/lib/sim/codegen";
import { fileChanges } from "@/lib/sim/script";
import { commitVersion, type ProjectRepo } from "@/lib/sim/github";
import type { EditSummary, Issue, Plan, TestReport } from "@/lib/sim/types";

/* Shared by the project server actions (build, GitHub). Not a "use server" file on purpose: these
   helpers take trusted arguments and must never be callable from the browser. */

export type ClientMessage = Pick<Message, "id" | "role" | "kind" | "content" | "data" | "createdAt">;
export type ClientVersion = Pick<Version, "id" | "number" | "summary" | "files" | "createdAt"> & { plan: Plan | null };

export type EditData = EditSummary & {
  author: "architect" | "you";
  previousVersionId: string | null;
  focusPage?: string;
  commit?: string;
  /** The bug this change left behind, if any. The card offers Fix it while it's still open. */
  issue?: Pick<Issue, "id" | "pageId" | "plain">;
  /** What the testing agent checked, and anything it caught and fixed inside this change. */
  test?: TestReport;
  /** Set when the change came through diff review. */
  review?: { accepted: number; total: number };
  fixed?: boolean;
};

export const toClientMessage = (m: Message): ClientMessage => ({
  id: m.id,
  role: m.role,
  kind: m.kind,
  content: m.content,
  data: m.data,
  createdAt: m.createdAt,
});

export const toClientVersion = (v: Version): ClientVersion => ({
  id: v.id,
  number: v.number,
  summary: v.summary,
  files: v.files,
  createdAt: v.createdAt,
  plan: (v.plan as Plan | null) ?? null,
});

export async function owned(projectId: string) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) throw new Error("Project not found");
  return { db, ws, project };
}

export async function addMessage(db: DB, projectId: string, m: Omit<ClientMessage, "id" | "createdAt">, offsetMs = 0) {
  const [row] = await db
    .insert(messages)
    .values({ id: rowId(), projectId, ...m, createdAt: new Date(Date.now() + offsetMs) })
    .returning();
  return toClientMessage(row);
}

export async function nextVersionNumber(db: DB, projectId: string) {
  const [last] = await db
    .select({ number: versions.number })
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.number))
    .limit(1);
  return (last?.number ?? 0) + 1;
}

export async function currentFiles(db: DB, project: Pick<Project, "currentVersionId">) {
  if (!project.currentVersionId) return {};
  const [v] = await db.select().from(versions).where(eq(versions.id, project.currentVersionId)).limit(1);
  return v?.files ?? {};
}

/**
 * Simulated token accounting at Claude Opus 5 list prices ($5 / $25 per million tokens). Sonnet 5
 * costs 0.4× as much, which is what the Pro model chip changes.
 */
export async function recordUsage(db: DB, workspaceId: string, projectId: string, steps: [string, number, number][], model = "claude-opus-5") {
  if (!steps.length) return;
  const rate = modelRate(model);
  await db.insert(usage).values(
    steps.map(([step, input, output]) => ({
      id: rowId(),
      workspaceId,
      projectId,
      step,
      model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: Math.round(input * 0.6),
      costUsd: (((input * 5 + output * 25) * rate) / 1_000_000).toFixed(5),
    })),
  );
}

export function planOf(project: Project): Plan {
  if (project.plan) return project.plan as Plan;
  const bp = matchBlueprint(project.prompt, project.settings.templateId, project.name);
  return { ...buildPlan({ blueprint: bp, appName: project.name, settings: project.settings }), appName: project.name };
}

/** Every new version is a commit on the linked repo's current branch (pushed straight away with auto-commit). */
export function repoAfter(project: Pick<Project, "repo">, versionId: string): { repo?: ProjectRepo } {
  return project.repo ? { repo: commitVersion(project.repo, versionId, Date.now()) } : {};
}

/**
 * Regenerates the files from a plan and saves them as the next version, with the edit card's data.
 * `repo` decides what the version does to the linked repo; by default it's a commit on the branch.
 */
export async function saveEditVersion(
  db: DB,
  project: Project,
  plan: Plan,
  summary: string,
  changes: string[],
  author: "architect" | "you",
  extra: Partial<EditData> = {},
  repo?: (versionId: string) => ProjectRepo | null,
) {
  const before = await currentFiles(db, project);
  const files = generateFiles(plan, project.stack);
  const number = await nextVersionNumber(db, project.id);
  const [prev] = project.currentVersionId
    ? await db.select({ number: versions.number }).from(versions).where(eq(versions.id, project.currentVersionId)).limit(1)
    : [];
  const [version] = await db.insert(versions).values({ id: rowId(), projectId: project.id, number, summary, files, plan }).returning();
  const edit: EditData = {
    version: number,
    previousVersion: prev?.number ?? number - 1,
    previousVersionId: project.currentVersionId,
    title: summary,
    changes,
    files: fileChanges(before, files),
    author,
    ...extra,
  };
  const nextRepo = repo ? { repo: repo(version.id) } : repoAfter(project, version.id);
  await db
    .update(projects)
    .set({ plan, currentVersionId: version.id, ...nextRepo, updatedAt: new Date() })
    .where(eq(projects.id, project.id));
  return { version: toClientVersion(version), edit, repo: nextRepo.repo ?? project.repo ?? null };
}
