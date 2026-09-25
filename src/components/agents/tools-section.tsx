"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Check, ChevronDown, Globe, Plus, Server, SquareTerminal, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUILTIN_TOOLS, isCustomTool, isHttpTool, isMcpTool, toolId, toolIntegration, toolLabel } from "@/lib/sim/agents";
import { INTEGRATIONS, type ConnectionView, type Integration } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConnectDialog, IntegrationTile } from "@/components/integrations/connect-dialog";
import { CustomToolDialog } from "@/components/integrations/custom-tool-dialog";
import { toast } from "sonner";

const BUILTIN_ICON = { "Web search": Globe, "Knowledge base": BookOpen, "Code interpreter": SquareTerminal } as const;

/** Whether a tool the agent uses has what it needs: built-ins always do; integrations need a connection. */
export function toolConnected(tool: string, connections: ConnectionView[]) {
  if (isMcpTool(tool)) return connections.some((c) => c.kind === "mcp" && c.label === toolLabel(tool));
  if (isHttpTool(tool)) return connections.some((c) => c.kind === "http" && c.label === toolLabel(tool));
  const integration = toolIntegration(tool);
  return !integration || connections.some((c) => c.kind === "oauth" && c.integrationId === integration.id);
}

type Row = { tool: string; label: string; note: string; kind: "builtin" | "integration" | "custom"; integration?: Integration; connection?: ConnectionView };

export function ToolsSection({
  tools,
  onChange,
  connections,
  onConnected,
  account,
  isPro,
  readOnly,
}: {
  tools: string[];
  onChange: (tools: string[]) => void;
  connections: ConnectionView[];
  onConnected: (c: ConnectionView) => void;
  account: string;
  isPro: boolean;
  readOnly?: boolean;
}) {
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const [custom, setCustom] = useState<"mcp" | "http" | null>(null);

  const rows: Row[] = BUILTIN_TOOLS.map((b) => ({ tool: b.name, label: b.name, note: b.note, kind: "builtin" as const }));
  const seen = new Set(rows.map((r) => r.tool));
  for (const c of connections) {
    const tool = c.kind === "mcp" ? `mcp:${c.label}` : c.kind === "http" ? `http:${c.label}` : INTEGRATIONS.find((i) => i.id === c.integrationId)?.name;
    if (!tool || seen.has(tool)) continue;
    seen.add(tool);
    const integration = INTEGRATIONS.find((i) => i.id === c.integrationId);
    rows.push({
      tool,
      label: c.label,
      note: c.kind === "oauth" ? integration?.description ?? "" : `${c.kind === "mcp" ? "MCP" : "HTTP"} · ${c.tools.join(", ")}`,
      kind: c.kind === "oauth" ? "integration" : "custom",
      integration,
      connection: c,
    });
  }
  // Tools the agent already uses but the workspace hasn't connected yet.
  for (const tool of tools) {
    if (seen.has(tool)) continue;
    seen.add(tool);
    const integration = toolIntegration(tool) ?? undefined;
    rows.push({ tool, label: toolLabel(tool), note: integration?.description ?? "Not set up in this workspace.", kind: isCustomTool(tool) ? "custom" : "integration", integration });
  }
  const unconnected = INTEGRATIONS.filter((i) => i.category !== "Custom" && !seen.has(i.name));

  const toggle = (tool: string, on: boolean) => onChange(on ? [...tools, tool] : tools.filter((t) => t !== tool));

  function connect(i: Integration) {
    if (i.id === "github") {
      toast("GitHub connects in the GitHub milestone", { description: "Until then the tool stays switched on, and the agent's code already calls it." });
      return;
    }
    setConnecting(i);
  }

  return (
    <div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {rows.map((r) => {
          const on = tools.includes(r.tool);
          const connected = toolConnected(r.tool, connections);
          const Icon = r.kind === "builtin" ? BUILTIN_ICON[r.tool as keyof typeof BUILTIN_ICON] : isMcpTool(r.tool) ? Server : Webhook;
          const id = `tool-${toolId(r.tool).replace(/[^a-z0-9]/gi, "-")}`;
          return (
            <li key={r.tool} className="flex items-center gap-3 px-3.5 py-2.5">
              {r.integration && r.kind === "integration" ? (
                <IntegrationTile integration={r.integration} className="size-7 text-[10px]" />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-3.5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  {r.label}
                  {isPro && <span className="font-mono text-[10.5px] font-normal text-subtle-foreground">{toolId(r.tool)}</span>}
                </label>
                <p className="truncate text-xs text-muted-foreground">{r.note}</p>
              </div>
              {r.kind !== "builtin" &&
                (connected ? (
                  <span className="hidden shrink-0 items-center gap-1 text-[11px] text-success sm:inline-flex">
                    <Check className="size-3" />
                    Connected
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cn("hidden items-center gap-1 text-[11px] sm:inline-flex", on ? "text-warning" : "text-muted-foreground")}>
                      <AlertTriangle className="size-3" />
                      Not connected
                    </span>
                    {r.integration && !readOnly && (
                      <Button size="xs" variant="outline" onClick={() => connect(r.integration!)}>
                        Connect
                      </Button>
                    )}
                  </span>
                ))}
              <Switch id={id} checked={on} disabled={readOnly} onCheckedChange={(v) => toggle(r.tool, v)} aria-label={`${on ? "Turn off" : "Turn on"} ${r.label}`} />
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="mt-2 flex flex-wrap gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost">
                <Plus />
                Connect a service
                <ChevronDown className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
              <DropdownMenuLabel className="annotation py-1">Integrations</DropdownMenuLabel>
              {unconnected.map((i) => (
                <DropdownMenuItem key={i.id} onSelect={() => connect(i)}>
                  <IntegrationTile integration={i} className="size-5 rounded-md text-[8px]" />
                  {i.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCustom("http")}>
                <Webhook />
                HTTP tool…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="xs" variant="ghost" onClick={() => setCustom("mcp")}>
            <Server />
            Add MCP server
          </Button>
        </div>
      )}
      <ConnectDialog
        integration={connecting}
        account={account}
        open={!!connecting}
        onOpenChange={(o) => !o && setConnecting(null)}
        onConnected={(c) => {
          onConnected(c);
          const name = INTEGRATIONS.find((i) => i.id === c.integrationId)?.name;
          if (name && !tools.includes(name)) onChange([...tools, name]);
        }}
      />
      <CustomToolDialog
        kind={custom ?? "mcp"}
        open={!!custom}
        onOpenChange={(o) => !o && setCustom(null)}
        onConnected={(c) => {
          onConnected(c);
          onChange([...tools, `${c.kind === "mcp" ? "mcp" : "http"}:${c.label}`]);
        }}
      />
    </div>
  );
}
