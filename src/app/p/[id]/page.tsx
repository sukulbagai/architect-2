import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { WorkspaceFrame } from "@/components/workspace/workspace-frame";

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

  const thread = await db.select().from(messages).where(eq(messages.projectId, id)).orderBy(asc(messages.createdAt));
  await db.update(projects).set({ lastOpenedAt: new Date() }).where(eq(projects.id, id));

  return (
    <WorkspaceFrame
      project={{
        id: project.id,
        name: project.name,
        status: project.status,
        stage: project.stage,
        stack: project.stack,
        settings: project.settings,
      }}
      messages={thread.map((m) => ({ id: m.id, role: m.role, kind: m.kind, content: m.content, data: m.data, createdAt: m.createdAt }))}
      mode={ws.mode}
    />
  );
}
