import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ArrowRight, Bot, Boxes, Plus, Wrench } from "lucide-react";
import { getDb } from "@/db";
import { agents, projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { usageSeries } from "@/lib/agent-store";
import { FRAMEWORK_LIST } from "@/lib/sim/frameworks";
import type { Plan } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { AgentAvatar, FrameworkChip } from "@/components/agents/agent-bits";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [standalone, projectRows] = await Promise.all([
    db
      .select()
      .from(agents)
      .where(and(eq(agents.workspaceId, ws.id), isNull(agents.projectId)))
      .orderBy(desc(agents.updatedAt)),
    db
      .select({ id: projects.id, name: projects.name, status: projects.status, plan: projects.plan })
      .from(projects)
      .where(eq(projects.workspaceId, ws.id))
      .orderBy(desc(projects.updatedAt)),
  ]);
  const now = new Date();
  const inApps = projectRows
    .map((p) => ({ ...p, agents: (p.plan as Plan | null)?.agents ?? [] }))
    .filter((p) => p.agents.length > 0);
  const appAgentCount = inApps.reduce((s, p) => s + p.agents.length, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        description="Every agent across your apps, plus agents that stand on their own as an API or an embeddable chat widget."
        actions={
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Link href="/agents/new">
              <Plus />
              New agent
            </Link>
          </Button>
        }
      />

      <section className="mt-10" aria-labelledby="standalone-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="standalone-heading" className="text-base font-semibold tracking-tight">
            Standalone agents
          </h2>
          {standalone.length > 0 && <span className="text-xs text-muted-foreground">Runs are for the last 14 days</span>}
        </div>
        {standalone.length === 0 ? (
          <EmptyState
            icon={<Bot />}
            title="No standalone agents yet"
            description="Build an agent with no app around it, then call it from your own code or put it on your site as a chat widget."
            action={
              <Button asChild variant="outline">
                <Link href="/agents/new">Describe an agent</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {standalone.map((a) => {
              const runs = usageSeries(a, now).days.reduce((s, d) => s + d.runs, 0);
              return (
                <li key={a.id} className="min-w-0">
                  <Link
                    href={`/agents/${a.id}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-float"
                  >
                    <div className="flex items-start gap-3">
                      <AgentAvatar id={a.id} name={a.name} className="size-9 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.role}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <FrameworkChip framework={a.framework} />
                      <span className={a.published ? "inline-flex items-center gap-1.5 text-xs font-medium text-success" : "inline-flex items-center gap-1.5 text-xs text-muted-foreground"}>
                        <span className={a.published ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-subtle-foreground"} />
                        {a.published ? "Published" : "Draft"}
                      </span>
                      <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
                        {runs.toLocaleString("en-US")} {runs === 1 ? "run" : "runs"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="apps-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="apps-heading" className="text-base font-semibold tracking-tight">
            In your apps
          </h2>
          {appAgentCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {appAgentCount} {appAgentCount === 1 ? "agent" : "agents"} in {inApps.length} {inApps.length === 1 ? "app" : "apps"}
            </span>
          )}
        </div>
        {inApps.length === 0 ? (
          <EmptyState
            icon={<Boxes />}
            title="No agents in your apps yet"
            description="When a project's plan calls for agents, they show up here, grouped by app."
            action={
              <Button asChild variant="outline">
                <Link href="/home?new=1">Start a project</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {inApps.map((p) => (
              <div key={p.id}>
                <div className="mb-2 flex items-center gap-3">
                  <Link href={`/p/${p.id}`} className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium hover:underline">
                    <span className="truncate">{p.name}</span>
                  </Link>
                  <StatusBadge status={p.status} />
                  <Link href={`/p/${p.id}?tab=agents`} className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Open the Agents tab <ArrowRight className="size-3" />
                  </Link>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {p.agents.map((a) => (
                    <li key={a.id} className="min-w-0">
                      <Link
                        href={`/p/${p.id}?tab=agents&agent=${encodeURIComponent(a.id)}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card transition-colors hover:border-border-strong"
                      >
                        <AgentAvatar id={a.id} name={a.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{a.role}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <FrameworkChip framework={a.framework} />
                          {a.tools.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-subtle-foreground">
                              <Wrench className="size-2.5" />
                              {a.tools.length}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14 border-t border-border pt-6">
        <p className="annotation">Build in the framework you already use</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FRAMEWORK_LIST.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
              <span className="font-medium">{f.label}</span>
              <span className="font-mono text-[10px] text-subtle-foreground">{f.language}</span>
            </span>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
