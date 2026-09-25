"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Bot, List, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { describeAgentChanges, type RunResult } from "@/lib/sim/agents";
import { EmptyState } from "@/components/common/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AgentAvatar, FrameworkChip } from "@/components/agents/agent-bits";
import { AgentEditor } from "@/components/agents/agent-editor";
import { SaveBar } from "@/components/agents/save-bar";
import { TestConsole } from "@/components/agents/test-console";
import { toolConnected } from "@/components/agents/tools-section";
import type { Workspace } from "./use-workspace";

const AgentFlow = dynamic(() => import("@/components/agents/agent-flow").then((m) => m.AgentFlow), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/30" />,
});

/**
 * The Agents tab: a list and an editor (or the Flow graph), a sticky save bar, and a test console
 * in a side sheet. Saving an agent after the first build regenerates its files as a new version.
 */
export function AgentsPanel({ ws, isPro, account }: { ws: Workspace; isPro: boolean; account: string }) {
  const agents = ws.plan?.agents ?? [];
  const [view, setView] = useState<"list" | "flow">("list");
  const [mobileDetail, setMobileDetail] = useState(!!ws.agentId);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!ws.plan || agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-lg bg-background/70"
          icon={<Bot />}
          title="No agents yet"
          description={ws.plan ? "Ask in the chat to add one, like “add a summarizer agent”, and it shows up here to shape and test." : "The plan decides which agents your app needs. Once it's drafted, you can shape and test each one here."}
        />
      </div>
    );
  }

  const selected = agents.find((a) => a.id === ws.agentId) ?? agents[0];
  const draft = ws.agentDrafts[selected.id] ?? selected;
  const dirty = !!ws.agentDrafts[selected.id] && describeAgentChanges(selected, draft, agents).length > 0;
  const building = !!ws.build || ws.project.stage === "build";
  const blocked = ws.planDirty;
  const warnings = agents.filter((a) => a.tools.some((t) => !toolConnected(t, ws.connections))).length;

  function select(id: string) {
    ws.setAgentId(id);
    setMobileDetail(true);
  }

  async function save() {
    if (saving || blocked) return;
    setSaving(true);
    await ws.saveAgent(draft);
    setSaving(false);
  }

  async function run(input: string, turn: number): Promise<RunResult> {
    const res = await fetch(`/api/agents/${ws.project.id}/${selected.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, turn, agent: draft }),
    });
    if (!res.ok) throw new Error(`Run failed: ${res.status}`);
    return res.json();
  }

  const notice = building ? (
    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">The app is building. Editing unlocks when it finishes.</p>
  ) : ws.project.stage === "plan" ? (
    <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">You&apos;re shaping the plan. Changes here are built into the app when you click Build this.</p>
  ) : blocked ? (
    <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">You have unapplied changes in the Plan tab. Apply them first, then save this agent.</p>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <div role="radiogroup" aria-label="Agents view" className="flex items-center rounded-lg bg-muted/60 p-0.5">
          {(
            [
              { id: "list", label: "List", icon: List },
              { id: "flow", label: "Flow", icon: Waypoints },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                view === id && "bg-card text-foreground shadow-card dark:bg-accent",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="ml-auto flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          {agents.length} {agents.length === 1 ? "agent" : "agents"}
          {warnings > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <AlertTriangle className="size-3 shrink-0 text-warning" />
              <span className="truncate">
                {warnings} {warnings === 1 ? "needs" : "need"} a connection
              </span>
            </>
          )}
        </p>
      </div>

      {view === "flow" ? (
        <div className="relative min-h-0 flex-1 bg-sunken">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <AgentFlow
            plan={ws.plan}
            selectedId={selected.id}
            connections={ws.connections}
            onSelect={(id) => {
              select(id);
              setView("list");
            }}
          />
          <p className="pointer-events-none absolute top-3 left-3 rounded-md bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur-sm">
            Click an agent to edit it · drag to move around
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav aria-label="Agents" className={cn("w-full shrink-0 overflow-y-auto border-border p-2 scrollbar-thin md:block md:w-64 md:border-r", mobileDetail ? "hidden" : "block")}>
            <ul className="space-y-0.5">
              {agents.map((a) => {
                const on = a.id === selected.id;
                const warn = a.tools.some((t) => !toolConnected(t, ws.connections));
                const unsaved = !!ws.agentDrafts[a.id] && describeAgentChanges(a, ws.agentDrafts[a.id], agents).length > 0;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => select(a.id)}
                      aria-current={on ? "true" : undefined}
                      className={cn("flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60", on && "bg-muted")}
                    >
                      <AgentAvatar id={a.id} name={ws.agentDrafts[a.id]?.name ?? a.name} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{ws.agentDrafts[a.id]?.name ?? a.name}</span>
                          {unsaved && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Unsaved changes" />}
                          {warn && <AlertTriangle className="size-3 shrink-0 text-warning" aria-label="A tool isn't connected" />}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{a.role}</span>
                        <FrameworkChip framework={ws.agentDrafts[a.id]?.framework ?? a.framework} className="mt-1.5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 px-2.5 text-[11px] leading-relaxed text-subtle-foreground">To add or remove an agent, ask in the chat or edit the Plan tab.</p>
          </nav>
          <div className={cn("relative min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin md:flex", mobileDetail ? "flex" : "hidden")}>
            <div className="flex-1">
              <AgentEditor
                key={selected.id}
                agent={draft}
                onChange={(next) => ws.setAgentDraft(selected.id, next)}
                others={agents.filter((a) => a.id !== selected.id)}
                connections={ws.connections}
                onConnected={ws.addConnection}
                account={account}
                isPro={isPro}
                codeContext={{ appName: ws.plan.appName, agents: agents.map((a) => (a.id === selected.id ? draft : a)) }}
                onOpenCode={(path) => ws.openCode(path)}
                canOpenCode={(path) => !dirty && ws.currentVersion?.files[path] !== undefined}
                onTest={() => setTesting(true)}
                onBack={() => setMobileDetail(false)}
                readOnly={building}
                notice={notice}
              />
            </div>
            <SaveBar
              show={dirty && !building}
              saving={saving}
              onSave={() => void save()}
              onDiscard={() => ws.setAgentDraft(selected.id, null)}
              note={ws.project.stage === "ready" ? "saving makes a new version" : "saving updates the plan"}
            />
          </div>
        </div>
      )}

      <Sheet open={testing} onOpenChange={setTesting}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <AgentAvatar id={draft.id} name={draft.name} className="size-6 rounded-md text-[9px]" />
              Test {draft.name}
            </SheetTitle>
            <SheetDescription className="text-xs">Chat with this agent on its own and watch its trace. Nothing here touches the app.</SheetDescription>
          </SheetHeader>
          <TestConsole
            key={selected.id}
            className="min-h-0 flex-1"
            agent={draft}
            isPro={isPro}
            run={run}
            tests={selected.tests ?? []}
            onSaveTests={(tests) => ws.saveAgentTests(selected.id, tests)}
            dirty={dirty}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
