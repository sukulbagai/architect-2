import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections, messages, projects, versions, type Message, type Project } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { toConnectionView } from "@/lib/agent-store";
import { Workspace } from "@/components/workspace/workspace";
import { CommandProvider } from "@/components/command/command-provider";
import { teammateArrived } from "@/lib/sim/github";
import type { Plan } from "@/lib/sim/types";
import type { TabId } from "@/components/workspace/use-workspace";

const TABS: TabId[] = ["preview", "plan", "agents", "data", "code", "versions", "settings"];

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
    teammateArrived: !!project.repo && teammateArrived(project.repo, now),
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

export default async function ProjectPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) notFound();

  const [thread, history, links] = await Promise.all([
    db.select().from(messages).where(eq(messages.projectId, id)).orderBy(asc(messages.createdAt)),
    db.select().from(versions).where(eq(versions.projectId, id)).orderBy(asc(versions.number)),
    db.select().from(connections).where(eq(connections.workspaceId, ws.id)).orderBy(desc(connections.createdAt)),
  ]);
  await db.update(projects).set({ lastOpenedAt: new Date() }).where(eq(projects.id, id));

  const { freshMessageId, autoBuild, teammateArrived: arrived } = arrival(thread, project, history.length);
  // Deep links from the Agents library: /p/<id>?tab=agents&agent=<agentId>
  const tab = typeof sp.tab === "string" && TABS.includes(sp.tab as TabId) ? (sp.tab as TabId) : null;
  const agent = typeof sp.agent === "string" && (project.plan as Plan | null)?.agents.some((a) => a.id === sp.agent) ? sp.agent : null;
  const account = ws.email ?? ws.name;

  return (
    <CommandProvider mode={ws.mode}>
      <Workspace
        mode={ws.mode}
        user={ws.name}
        account={account}
        connections={links.map((c) => toConnectionView(c, account))}
        initialTab={agent ? "agents" : tab}
        initialAgentId={agent}
        project={{
          id: project.id,
          name: project.name,
          slug: project.slug,
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
        repo={project.repo ?? null}
        githubLogin={ws.githubLogin}
        teammateArrived={arrived}
      />
    </CommandProvider>
  );
}
