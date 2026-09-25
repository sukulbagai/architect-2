import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agents } from "@/db/schema";
import { rowId } from "@/lib/ids";
import { keyMatches, rowToPlanAgent } from "@/lib/agent-store";
import { simulateRun } from "@/lib/sim/agents";

/**
 * The public API for a published standalone agent. Real HTTP and a real key check (by sha256);
 * the reply itself is scripted, so calling it costs nothing. Stays out of the proxy matcher.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/agents/[agentId]/run">) {
  const key = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!key) return error(401, "missing_api_key", "Send your API key in the header: Authorization: Bearer <key>. Create one on the agent's Deploy tab.");

  const { agentId } = await ctx.params;
  const db = await getDb();
  const [row] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  if (!row || row.projectId) return error(404, "agent_not_found", "There's no standalone agent with that id. Copy the endpoint from the agent's Deploy tab.");
  if (!keyMatches(key, row.apiKeyHash)) return error(401, "invalid_api_key", "That API key isn't valid for this agent. It may have been revoked; create a new one on the Deploy tab.");
  if (!row.published) return error(404, "agent_not_published", "This agent isn't published yet. Turn on Publish on its Deploy tab, then try again.");

  const parsed = z.object({ input: z.string().trim().min(1).max(4000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, "invalid_request", 'Send a JSON body with the text to answer, like {"input": "What does the Team plan cost?"}.');

  const run = simulateRun(rowToPlanAgent(row), parsed.data.input, row.runs);
  await db.update(agents).set({ runs: sql`${agents.runs} + 1` }).where(eq(agents.id, row.id));
  return NextResponse.json(
    {
      id: `run_${rowId()}`,
      agent: { id: row.id, name: row.name },
      output: run.output,
      handoff: run.handoff ?? null,
      trace: run.trace.map(({ label, detail, ms }) => ({ step: label, ...(detail ? { detail } : {}), ms })),
      usage: run.usage,
    },
    { headers: CORS },
  );
}
