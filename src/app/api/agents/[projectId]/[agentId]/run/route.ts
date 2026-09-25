import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { connections, projects, usage } from "@/db/schema";
import { getWorkspace } from "@/lib/session";
import { rowId } from "@/lib/ids";
import { agentInput } from "@/lib/agent-store";
import { simulateRun } from "@/lib/sim/agents";
import type { Plan } from "@/lib/sim/types";

/**
 * Runs one of a project's agents for the test console. Real HTTP, scripted output: the reply comes
 * from the agent's samples and the trace from its config (the unsaved draft, when one is sent).
 */

const body = z.object({
  input: z.string().trim().min(1).max(4000),
  turn: z.number().int().min(0).max(10_000).optional(),
  agent: agentInput.optional(),
});

const error = (status: number, message: string) => NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest, ctx: RouteContext<"/api/agents/[projectId]/[agentId]/run">) {
  const ws = await getWorkspace();
  if (!ws) return error(401, "Sign in to run this agent.");
  const { projectId, agentId } = await ctx.params;
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) return error(404, "Project not found.");
  const plan = project.plan as Plan | null;
  const saved = plan?.agents.find((a) => a.id === agentId);
  if (!plan || !saved) return error(404, "That agent isn't in this project's plan.");

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'Send JSON like {"input": "Hello"}.');
  const { input, turn = 0, agent: draft } = parsed.data;

  const agent = draft ? { ...saved, ...draft, id: saved.id, samples: saved.samples, trace: saved.trace } : saved;
  const mcpRows = await db.select().from(connections).where(and(eq(connections.workspaceId, ws.id), eq(connections.kind, "mcp")));
  const run = simulateRun(agent, input, turn, { agents: plan.agents, mcp: Object.fromEntries(mcpRows.map((r) => [r.label, r.config.tools ?? []])) });

  const rate = agent.model === "claude-sonnet-5" ? 0.4 : 1;
  await db.insert(usage).values({
    id: rowId(),
    workspaceId: ws.id,
    projectId,
    step: "agent-test",
    model: agent.model,
    inputTokens: run.usage.inputTokens,
    outputTokens: run.usage.outputTokens,
    cacheReadTokens: Math.round(run.usage.inputTokens * 0.4),
    costUsd: (((run.usage.inputTokens * 5 + run.usage.outputTokens * 25) * rate) / 1_000_000).toFixed(5),
  });
  return NextResponse.json(run);
}
