"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId } from "@/lib/ids";
import { toConnectionView } from "@/lib/agent-store";
import { INTEGRATIONS, mcpNameFromUrl, mcpTools } from "@/lib/integrations";

/* Connections are simulated: the consent screen is ours, nothing talks to the service, and no
   token is stored. The row records what was "granted" so agents can use the tool. */

const account = (ws: { email: string | null; name: string }) => ws.email ?? ws.name;

export async function connectIntegration(rawId: string) {
  const id = z.string().max(40).parse(rawId);
  const integration = INTEGRATIONS.find((i) => i.id === id);
  if (!integration || integration.category === "Custom" || integration.id === "github") throw new Error("That integration can't be connected here.");
  const ws = await requireWorkspace();
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, ws.id), eq(connections.integrationId, id), eq(connections.kind, "oauth")))
    .limit(1);
  if (existing) return toConnectionView(existing, account(ws));
  const [row] = await db
    .insert(connections)
    .values({
      id: rowId(),
      workspaceId: ws.id,
      integrationId: id,
      kind: "oauth",
      label: integration.name,
      config: { scopes: integration.scopes, account: account(ws) },
    })
    .returning();
  revalidatePath("/", "layout");
  return toConnectionView(row, account(ws));
}

const https = z
  .string()
  .trim()
  .url("Enter a full URL, like https://mcp.example.com/mcp")
  .refine((u) => u.startsWith("https://"), "The URL must start with https://");

const customInput = z.object({
  name: z.string().trim().max(40).optional(),
  url: https,
  header: z.string().max(500).optional(),
});

/** "Bearer sk-live-abc123" → "Bearer ••••c123". The header itself is never stored. */
function hint(header?: string) {
  const h = header?.trim();
  if (!h) return undefined;
  const [scheme, ...rest] = h.split(/\s+/);
  const secret = rest.length ? rest.join(" ") : scheme;
  return `${rest.length ? `${scheme} ` : ""}••••${secret.slice(-4)}`;
}

export async function addMcpServer(raw: z.infer<typeof customInput>) {
  const input = customInput.parse(raw);
  const ws = await requireWorkspace();
  const db = await getDb();
  const label = input.name || mcpNameFromUrl(input.url);
  const taken = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.workspaceId, ws.id), eq(connections.kind, "mcp"), eq(connections.label, label)))
    .limit(1);
  if (taken.length) return { ok: false as const, error: `You already have an MCP server called ${label}. Pick another name.` };
  const [row] = await db
    .insert(connections)
    .values({ id: rowId(), workspaceId: ws.id, integrationId: "mcp", kind: "mcp", label, config: { url: input.url, tools: mcpTools(input.url), headerHint: hint(input.header) } })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true as const, connection: toConnectionView(row, account(ws)) };
}

export async function addHttpTool(raw: z.infer<typeof customInput>) {
  const input = customInput.parse(raw);
  const ws = await requireWorkspace();
  const db = await getDb();
  let host = "API";
  try {
    host = new URL(input.url).hostname.replace(/^(api|www)\./, "");
  } catch {}
  const label = input.name || host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
  const [row] = await db
    .insert(connections)
    .values({ id: rowId(), workspaceId: ws.id, integrationId: "webhook", kind: "http", label, config: { url: input.url, tools: ["request"], headerHint: hint(input.header) } })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true as const, connection: toConnectionView(row, account(ws)) };
}

export async function disconnect(rawId: string) {
  const id = z.string().max(40).parse(rawId);
  const ws = await requireWorkspace();
  const db = await getDb();
  await db.delete(connections).where(and(eq(connections.id, id), eq(connections.workspaceId, ws.id)));
  revalidatePath("/", "layout");
  return { ok: true };
}
