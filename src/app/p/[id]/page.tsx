import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, projects, versions, type Message, type Project } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { Workspace } from "@/components/workspace/workspace";
import type { Plan } from "@/lib/sim/types";

/**
 * What should happen the moment the Workspace opens. Decided on the server, not in the browser, so
 * both render the same first frame: the opening questions get a short "thinking" beat, and a
 * project created with "Plan first" off starts building straight away.
 */
function arrival(thread: Message[], project: Project, versionCount: number) {
  const now = Date.now();
  const last = thread[thread.length - 1];
  return {
    freshMessageId: last?.kind === "questions" && now - last.createdAt.getTime() < 8000 ? last.id : null,
    autoBuild: project.stage === "build" && versionCount === 0 && !!project.plan && now - project.updatedAt.getTime() < 60_000,
  };
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const ws = await requireWorkspace();
  const db = await getDb();
  const [p] = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws.id)))
    .limit(1);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) notFound();

  const [thread, history] = await Promise.all([
    db.select().from(messages).where(eq(messages.projectId, id)).orderBy(asc(messages.createdAt)),
    db.select().from(versions).where(eq(versions.projectId, id)).orderBy(asc(versions.number)),
  ]);
  await db.update(projects).set({ lastOpenedAt: new Date() }).where(eq(projects.id, id));

  const { freshMessageId, autoBuild } = arrival(thread, project, history.length);

  return (
    <Workspace
      mode={ws.mode}
      project={{
        id: project.id,
        name: project.name,
        status: project.status,
        stage: project.stage,
        stack: project.stack,
        settings: project.settings,
        updatedAt: project.updatedAt,
      }}
      plan={(project.plan as Plan | null) ?? null}
      messages={thread.map((m) => ({ id: m.id, role: m.role, kind: m.kind, content: m.content, data: m.data, createdAt: m.createdAt }))}
      versions={history.map((v) => ({ id: v.id, number: v.number, summary: v.summary, files: v.files, createdAt: v.createdAt, plan: (v.plan as Plan | null) ?? null }))}
      currentVersionId={project.currentVersionId}
      freshMessageId={freshMessageId}
      autoBuild={autoBuild}
    />
  );
}
