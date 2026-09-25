"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { agents, connections, type AgentWidget } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId, secretId } from "@/lib/ids";
import { agentInput, hashKey, rowToPlanAgent, testsInput } from "@/lib/agent-store";
import { DEFAULT_GUARDRAILS, DEFAULT_MEMORY, draftAgent, simulateRun } from "@/lib/sim/agents";
import { frameworkOf } from "@/lib/sim/frameworks";
import type { AgentTest, PlanAgent } from "@/lib/sim/types";

/* Standalone agents live in the agents table with no project. Runs are simulated from each agent's
   scripted samples; the API key is real (hashed) so the public endpoint can check it. */

async function ownedAgent(id: string) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.workspaceId, ws.id)))
    .limit(1);
  if (!row) throw new Error("Agent not found");
  return { db, ws, row };
}

const createInput = z.object({
  prompt: z.string().trim().min(3, "Describe what the agent should do.").max(2000),
  name: z.string().trim().min(1, "Give the agent a name.").max(60),
  role: z.string().trim().max(300),
  instructions: z.string().trim().max(8000),
  tools: z.array(z.string().max(80)).max(30),
  framework: z.string().max(40),
  model: z.enum(["claude-opus-5", "claude-sonnet-5"]),
});

export async function createAgent(raw: z.infer<typeof createInput>) {
  const input = createInput.parse(raw);
  const ws = await requireWorkspace();
  const db = await getDb();
  const draft = draftAgent(input.prompt);
  const id = rowId();
  await db.insert(agents).values({
    id,
    workspaceId: ws.id,
    projectId: null,
    name: input.name,
    role: input.role,
    framework: frameworkOf(input.framework).id,
    model: input.model,
    instructions: input.instructions,
    tools: input.tools,
    knowledge: [],
    widget: { color: "#cf4318", greeting: `Hi! I'm ${input.name}. ${input.role}`, position: "bottom-right" },
    config: { memory: DEFAULT_MEMORY, guardrails: DEFAULT_GUARDRAILS, tests: [], samples: draft.samples, trace: draft.trace, prompt: input.prompt },
  });
  revalidatePath("/agents");
  return { id };
}

export async function saveStandaloneAgent(id: string, raw: PlanAgent) {
  const input = agentInput.parse(raw);
  const { db, row } = await ownedAgent(id);
  await db
    .update(agents)
    .set({
      name: input.name,
      role: input.role,
      framework: frameworkOf(input.framework).id,
      model: input.model,
      instructions: input.instructions,
      tools: input.tools,
      knowledge: input.knowledge ?? [],
      config: { ...row.config, memory: input.memory, guardrails: input.guardrails },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id));
  const [saved] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  revalidatePath("/agents");
  return { agent: rowToPlanAgent(saved) };
}

export async function saveStandaloneTests(id: string, raw: AgentTest[]) {
  const tests = testsInput.parse(raw);
  const { db, row } = await ownedAgent(id);
  await db.update(agents).set({ config: { ...row.config, tests } }).where(eq(agents.id, id));
  return { ok: true };
}

export async function deleteAgent(id: string) {
  const { db } = await ownedAgent(id);
  await db.delete(agents).where(eq(agents.id, id));
  revalidatePath("/agents");
}

export async function setAgentPublished(id: string, published: boolean) {
  const { db } = await ownedAgent(id);
  await db.update(agents).set({ published: z.boolean().parse(published), updatedAt: new Date() }).where(eq(agents.id, id));
  revalidatePath("/agents");
  return { published };
}

/** Creates a key, returns it once, and keeps only its sha256 and a short prefix. Replaces any old key. */
export async function createApiKey(id: string) {
  const { db } = await ownedAgent(id);
  const key = `ak_live_${secretId()}`;
  const prefix = key.slice(0, 12);
  const createdAt = new Date();
  await db.update(agents).set({ apiKeyHash: hashKey(key), apiKeyPrefix: prefix, apiKeyCreatedAt: createdAt }).where(eq(agents.id, id));
  return { key, prefix, createdAt };
}

export async function revokeApiKey(id: string) {
  const { db } = await ownedAgent(id);
  await db.update(agents).set({ apiKeyHash: null, apiKeyPrefix: null, apiKeyCreatedAt: null }).where(eq(agents.id, id));
  return { ok: true };
}

const widgetInput = z.object({
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour."),
  greeting: z.string().trim().min(1).max(200),
  position: z.enum(["bottom-right", "bottom-left"]),
});

export async function saveWidget(id: string, raw: AgentWidget) {
  const widget = widgetInput.parse(raw);
  const { db } = await ownedAgent(id);
  await db.update(agents).set({ widget, updatedAt: new Date() }).where(eq(agents.id, id));
  return { widget };
}

/** The test console on a standalone agent's page. Runs the unsaved draft, with the saved samples. */
export async function testStandaloneAgent(id: string, rawDraft: PlanAgent, rawInput: string, rawTurn: number) {
  const draft = agentInput.parse(rawDraft);
  const input = z.string().trim().min(1).max(2000).parse(rawInput);
  const turn = z.number().int().min(0).max(10_000).parse(rawTurn);
  const { db, ws, row } = await ownedAgent(id);
  const saved = rowToPlanAgent(row);
  const mcp = await mcpToolsByLabel(db, ws.id);
  return simulateRun({ ...saved, ...draft, samples: saved.samples, trace: saved.trace }, input, turn, { mcp });
}

/** Standalone agents for the Home composer's "Add existing agents". */
export async function listStandaloneAgents() {
  const ws = await requireWorkspace();
  const db = await getDb();
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.workspaceId, ws.id), isNull(agents.projectId)))
    .orderBy(desc(agents.updatedAt));
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, framework: r.framework }));
}

async function mcpToolsByLabel(db: Awaited<ReturnType<typeof getDb>>, workspaceId: string) {
  const rows = await db.select().from(connections).where(and(eq(connections.workspaceId, workspaceId), eq(connections.kind, "mcp")));
  return Object.fromEntries(rows.map((r) => [r.label, r.config.tools ?? []]));
}
