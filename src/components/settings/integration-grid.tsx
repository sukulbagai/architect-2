"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, Plug, Server, Unplug, Webhook } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import { disconnect } from "@/lib/actions/connections";
import { INTEGRATIONS, type ConnectionView, type Integration, type IntegrationCategory } from "@/lib/integrations";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConnectDialog, IntegrationTile } from "@/components/integrations/connect-dialog";
import { CustomToolDialog } from "@/components/integrations/custom-tool-dialog";
import { ConnectGithubDialog } from "@/components/github/connect-github-dialog";
import { reposFor } from "@/lib/sim/github";

const ORDER: IntegrationCategory[] = ["Code & deploy", "Communication", "Workspace", "CRM & data", "Custom"];

function hostOf(url?: string) {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return url ?? "";
  }
}

export function IntegrationGrid({ integrations, connections: initial, account, name }: { integrations: Integration[]; connections: ConnectionView[]; account: string; name: string }) {
  const [connections, setConnections] = useState(initial);
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const [github, setGithub] = useState(false);
  const [custom, setCustom] = useState<"mcp" | "http" | null>(null);
  const [removing, setRemoving] = useState<ConnectionView | null>(null);
  const [, startTransition] = useTransition();
  const mounted = useMounted();

  const byIntegration = new Set(connections.filter((c) => c.kind === "oauth").map((c) => c.integrationId));
  const githubLogin = connections.find((c) => c.integrationId === "github")?.account.replace(/^@/, "") ?? null;
  const added = (c: ConnectionView) => setConnections((list) => [c, ...list.filter((x) => x.id !== c.id)]);

  function open(i: Integration) {
    if (i.id === "github") {
      setGithub(true);
      return;
    }
    if (i.id === "mcp") setCustom("mcp");
    else if (i.id === "webhook") setCustom("http");
    else setConnecting(i);
  }

  function confirmRemove() {
    const c = removing;
    if (!c) return;
    setRemoving(null);
    setConnections((list) => list.filter((x) => x.id !== c.id));
    startTransition(async () => {
      try {
        await disconnect(c.id);
        toast.success(`Disconnected ${c.label}`);
      } catch {
        setConnections((list) => [c, ...list]);
        toast.error(`Couldn't disconnect ${c.label}`);
      }
    });
  }

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="connected-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="connected-heading" className="annotation">
            Connected
          </h2>
          {connections.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {connections.length} {connections.length === 1 ? "connection" : "connections"} · shared by every agent in this workspace
            </span>
          )}
        </div>
        {connections.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-4 text-sm text-muted-foreground">
            <Plug className="size-4 shrink-0" />
            Nothing connected yet. Connect a service below and your agents can switch it on as a tool.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((c) => {
              const meta = INTEGRATIONS.find((i) => i.id === c.integrationId);
              return (
                <li key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                  {c.kind === "oauth" && meta ? (
                    <IntegrationTile integration={meta} />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-text" aria-hidden="true">
                      {c.kind === "mcp" ? <Server className="size-4" /> : <Webhook className="size-4" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{c.label}</span>
                      <span className="size-1.5 shrink-0 rounded-full bg-success" aria-label="Connected" />
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.kind === "oauth" ? c.account : `${c.kind === "mcp" ? "MCP" : "HTTP"} · ${c.tools.length} ${c.tools.length === 1 ? "tool" : "tools"} · ${hostOf(c.url)}`}
                    </p>
                    <p className="mt-1 text-[11px] text-subtle-foreground" suppressHydrationWarning>
                      {mounted ? `Connected ${timeAgo(c.createdAt)}` : "Connected"}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${c.label}`} className="text-muted-foreground hover:text-destructive" onClick={() => setRemoving(c)}>
                    <Unplug />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {ORDER.map((cat) => {
        const items = integrations.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="annotation mb-3">
              {cat}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => {
                const isOn = byIntegration.has(i.id);
                const count = i.id === "mcp" ? connections.filter((c) => c.kind === "mcp").length : i.id === "webhook" ? connections.filter((c) => c.kind === "http").length : 0;
                return (
                  <div key={i.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                    <IntegrationTile integration={i} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{i.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.description}</p>
                      {count > 0 && <p className="mt-1 text-[11px] text-subtle-foreground">{count} added</p>}
                      {i.id === "github" && githubLogin && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle-foreground">
                          <span>
                            <span className="font-mono text-muted-foreground">@{githubLogin}</span> · {reposFor(githubLogin).length} repositories
                          </span>
                          <Link href="/import" className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                            Import one
                            <ArrowRight className="size-3" />
                          </Link>
                        </p>
                      )}
                    </div>
                    {isOn ? (
                      <span className="inline-flex h-7 shrink-0 items-center gap-1 px-1 text-xs font-medium text-success">
                        <Check className="size-3.5" />
                        Connected
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => open(i)}>
                        {i.category === "Custom" ? "Add" : "Connect"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <ConnectDialog integration={connecting} account={account} open={!!connecting} onOpenChange={(o) => !o && setConnecting(null)} onConnected={added} />
      <ConnectGithubDialog open={github} onOpenChange={setGithub} name={name} onConnected={(c) => added(c.connection)} />
      <CustomToolDialog kind={custom ?? "mcp"} open={!!custom} onOpenChange={(o) => !o && setCustom(null)} onConnected={added} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {removing?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.integrationId === "github"
                ? "Projects stay linked to their repositories but stop syncing, and imports need GitHub again. Reconnect any time."
                : "Agents that use it keep the tool switched on, but show a warning until you connect it again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmRemove}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
