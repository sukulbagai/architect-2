import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { agents, connections } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowToPlanAgent, toConnectionView, usageSeries } from "@/lib/agent-store";
import { StandaloneAgent } from "@/components/agents/standalone-agent";

const TABS = ["configure", "test", "deploy", "usage"] as const;

async function load(id: string) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.workspaceId, ws.id), isNull(agents.projectId)))
    .limit(1);
  return { ws, db, row };
}

export async function generateMetadata({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const { row } = await load(id);
  return { title: row?.name ?? "Agent" };
}

/** The public origin for endpoint and embed URLs, as the browser sees this deployment. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function AgentPage({ params, searchParams }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { ws, db, row } = await load(id);
  if (!row) notFound();
  const links = await db.select().from(connections).where(eq(connections.workspaceId, ws.id)).orderBy(desc(connections.createdAt));
  const account = ws.email ?? ws.name;
  const tab = TABS.find((t) => t === sp.tab) ?? "configure";

  return (
    <StandaloneAgent
      id={row.id}
      agent={rowToPlanAgent(row)}
      published={row.published}
      apiKey={row.apiKeyPrefix && row.apiKeyCreatedAt ? { prefix: row.apiKeyPrefix, createdAt: row.apiKeyCreatedAt } : null}
      widget={row.widget ?? { color: "#cf4318", greeting: `Hi! I'm ${row.name}. How can I help?`, position: "bottom-right" }}
      usage={usageSeries(row)}
      realRuns={row.runs}
      connections={links.map((c) => toConnectionView(c, account))}
      account={account}
      isPro={ws.mode === "pro"}
      origin={await origin()}
      initialTab={tab}
    />
  );
}
