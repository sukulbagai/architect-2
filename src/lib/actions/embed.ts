"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agents } from "@/db/schema";
import { rowToPlanAgent } from "@/lib/agent-store";
import { simulateRun } from "@/lib/sim/agents";

/**
 * The embeddable chat widget's runner. Public on purpose (the widget runs on other people's sites),
 * so it only works for published agents and returns the reply, never the agent's config.
 */
export async function runWidget(rawId: string, rawInput: string, rawTurn: number) {
  const id = z.string().max(40).parse(rawId);
  const input = z.string().trim().min(1).max(2000).parse(rawInput);
  const turn = z.number().int().min(0).max(1000).parse(rawTurn);
  const db = await getDb();
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!row || !row.published || row.projectId) return { ok: false as const, error: "This assistant isn't available right now." };
  const run = simulateRun(rowToPlanAgent(row), input, turn);
  await db.update(agents).set({ runs: sql`${agents.runs} + 1` }).where(eq(agents.id, id));
  return { ok: true as const, output: run.output, handoff: run.handoff?.name ?? null };
}
