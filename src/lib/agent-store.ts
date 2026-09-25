import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { slugify } from "@/lib/ids";
import { hashString, seededRandom } from "@/lib/seeded";
import { withAgentDefaults } from "@/lib/sim/agents";
import type { Agent, Connection } from "@/db/schema";
import type { ConnectionView } from "@/lib/integrations";
import type { PlanAgent } from "@/lib/sim/types";

/** What the agent editor may change. Samples and traces stay server-side, so replies stay honest. */
export const agentInput = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1, "Give the agent a name.").max(60),
  role: z.string().trim().max(300),
  framework: z.string().max(40),
  model: z.enum(["claude-opus-5", "claude-sonnet-5"]),
  tools: z.array(z.string().max(80)).max(30),
  instructions: z.string().max(8000),
  memory: z.object({ mode: z.enum(["off", "conversation", "long-term"]), window: z.number().int().min(1).max(100).optional() }).optional(),
  guardrails: z.array(z.string().max(40)).max(10).optional(),
  handoffs: z.array(z.string().max(80)).max(20).optional(),
  knowledge: z
    .array(z.object({ name: z.string().max(200), size: z.number().int().min(0).max(2_000_000_000), chunks: z.number().int().min(0).max(1_000_000) }))
    .max(50)
    .optional(),
  tests: z.array(z.object({ id: z.string().max(40), input: z.string().max(2000), expect: z.string().trim().min(1).max(200) })).max(50).optional(),
});

export const testsInput = agentInput.shape.tests.unwrap();

/** A standalone agent row in the shape the editor, console and codegen share. */
export function rowToPlanAgent(row: Agent): PlanAgent {
  const c = row.config ?? {};
  return withAgentDefaults({
    id: slugify(row.name) || "agent",
    name: row.name,
    role: row.role,
    framework: row.framework,
    model: row.model,
    tools: row.tools,
    instructions: row.instructions,
    samples: c.samples ?? [],
    trace: c.trace,
    memory: c.memory,
    guardrails: c.guardrails,
    handoffs: [],
    knowledge: row.knowledge.map((k) => ({ ...k, chunks: k.chunks ?? Math.max(1, Math.round(k.size / 2048)) })),
    tests: c.tests,
  });
}

export function toConnectionView(row: Connection, fallbackAccount: string): ConnectionView {
  return {
    id: row.id,
    integrationId: row.integrationId,
    kind: row.kind,
    label: row.label,
    account: row.config.account ?? (row.kind === "oauth" ? fallbackAccount : row.config.url ?? ""),
    tools: row.config.tools ?? [],
    url: row.config.url,
    createdAt: row.createdAt,
  };
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function keyMatches(key: string, hash: string | null) {
  if (!hash) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type UsageDay = { date: string; runs: number };

/**
 * Fourteen days of runs for a standalone agent: simulated history for the days since it was created
 * (busier on weekdays once it's published), and today's real calls through the API and widget.
 * Computed on the server so it renders the same.
 */
export function usageSeries(row: Pick<Agent, "id" | "published" | "runs" | "createdAt">, now = new Date()): { days: UsageDay[]; latencyMs: number; tokens: number } {
  const rnd = seededRandom(row.id);
  const created = new Date(row.createdAt);
  created.setHours(0, 0, 0, 0);
  const days: UsageDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const base = rnd();
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let runs = 0;
    if (i === 0) runs = row.runs;
    else if (d >= created) runs = row.published ? Math.round((weekend ? 6 : 18) + base * (weekend ? 10 : 42)) : Math.round(base * 3);
    days.push({ date: d.toISOString().slice(0, 10), runs });
  }
  const h = hashString(row.id);
  return { days, latencyMs: 900 + (h % 700), tokens: 1400 + (h % 1100) };
}
