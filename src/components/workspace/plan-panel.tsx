"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Check, FileText, Hammer, Loader2, Plus, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { newAgent, newPage, estimate } from "@/lib/sim/plan";
import { APP_THEMES } from "@/lib/sim/themes";
import type { PageKind, Plan } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageIcon } from "@/components/preview/bits";
import { AgentAvatar, FrameworkChip } from "@/components/agents/agent-bits";
import { toolLabel } from "@/lib/sim/agents";
import type { Workspace } from "./use-workspace";

const AgentFlow = dynamic(() => import("@/components/agents/agent-flow").then((m) => m.AgentFlow), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/30" />,
});

const KIND_LABEL: Record<PageKind, string> = {
  dashboard: "Dashboard",
  list: "Table",
  workbench: "Review",
  chat: "Chat",
  run: "Run",
  settings: "Settings",
};

function AutoTextarea({ value, onChange, className, ariaLabel }: { value: string; onChange: (v: string) => void; className?: string; ariaLabel: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn("w-full resize-none overflow-hidden rounded-md bg-transparent outline-none focus:bg-muted/50 focus:ring-2 focus:ring-ring/30", className)}
    />
  );
}

function Section({ n, show, title, hint, children }: { n: number; show: boolean; title: string; hint?: string; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <section className="animate-rise border-t border-border py-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold">
          <span className="font-mono text-[11px] font-normal text-brand-text">{String(n).padStart(2, "0")}</span>
          {title}
        </h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function PlanPanel({ ws, isPro }: { ws: Workspace; isPro: boolean }) {
  const plan = ws.plan;
  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-lg bg-background/70"
          icon={<FileText />}
          title="The plan appears here"
          description="Answer the questions in the chat, or skip them, and Architect drafts a plan you can edit before anything is built."
        />
      </div>
    );
  }
  const r = ws.planReveal;
  const set = (patch: Partial<Plan>) => {
    const next = { ...plan, ...patch };
    ws.updatePlan({ ...next, estimate: estimate(next) });
  };
  const building = !!ws.build;
  const stage = ws.project.stage;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 md:px-10 md:py-8">
      <header className="animate-rise">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="annotation">Plan · {stage === "plan" ? "draft" : `built as v${ws.currentVersion?.number ?? 1}`}</p>
          {stage === "plan" && !building && (
            <Button size="sm" onClick={() => void ws.runBuild()} className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Hammer />
              Build this
            </Button>
          )}
          {building && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Building from this plan
            </span>
          )}
          {stage === "ready" && !building && (ws.planDirty ? (
            <Button size="sm" onClick={() => void ws.applyPlanChanges()} className="bg-brand text-brand-foreground hover:bg-brand/90">
              Apply changes to the app
              <ArrowRight />
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" />
              In sync with the app
            </span>
          ))}
        </div>
        <input
          aria-label="App name"
          value={plan.appName}
          onChange={(e) => set({ appName: e.target.value })}
          className="mt-3 w-full rounded-md bg-transparent text-[28px] leading-tight font-semibold tracking-[-0.03em] outline-none focus:bg-muted/50"
        />
        <AutoTextarea ariaLabel="Tagline" value={plan.tagline} onChange={(v) => set({ tagline: v })} className="mt-1 text-[15px] text-muted-foreground" />
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>{plan.pages.length} pages</span>
          <span>{plan.agents.length} agents</span>
          <span>
            {plan.data.length} {plan.data.length === 1 ? "table" : "tables"}
          </span>
          <span>{APP_THEMES[plan.ui.theme].label} theme</span>
          <span>
            About {plan.estimate.seconds} s · {plan.estimate.credits} credits
          </span>
        </div>
        {ws.planDirty && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            You&apos;ve changed the plan. The app still reflects the last version until you apply the changes.
          </p>
        )}
      </header>

      <Section n={1} show={r >= 1} title="Overview">
        <AutoTextarea ariaLabel="Overview" value={plan.overview} onChange={(v) => set({ overview: v })} className="text-sm leading-relaxed" />
        <p className="mt-2 text-xs text-muted-foreground">
          For: <span className="text-foreground">{plan.audience}</span>
        </p>
      </Section>

      <Section n={2} show={r >= 2} title="Pages" hint="Rename, retype or remove">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {plan.pages.map((p, i) => (
            <li key={p.id} className="group flex items-start gap-3 px-3 py-2.5">
              <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <PageIcon name={p.icon} className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Page name"
                    value={p.name}
                    onChange={(e) => set({ pages: plan.pages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                    className="min-w-0 flex-1 rounded bg-transparent text-sm font-medium outline-none focus:bg-muted/50"
                  />
                  <select
                    aria-label="Page type"
                    value={p.kind}
                    disabled={p.kind === "settings"}
                    onChange={(e) =>
                      set({ pages: plan.pages.map((x, j) => (j === i ? { ...x, kind: e.target.value as PageKind } : x)) })
                    }
                    className="h-6 rounded-md border border-border bg-background px-1.5 text-[11px] text-muted-foreground outline-none"
                  >
                    {(Object.keys(KIND_LABEL) as PageKind[])
                      .filter((k) => k !== "settings" || p.kind === "settings")
                      .map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                  </select>
                </div>
                <AutoTextarea
                  ariaLabel="Page purpose"
                  value={p.purpose}
                  onChange={(v) => set({ pages: plan.pages.map((x, j) => (j === i ? { ...x, purpose: v } : x)) })}
                  className="mt-0.5 text-xs text-muted-foreground"
                />
              </div>
              {p.kind !== "settings" && (
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => set({ pages: plan.pages.filter((_, j) => j !== i) })}
                  className="mt-1 rounded-md p-1 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <Button
          size="xs"
          variant="ghost"
          className="mt-2"
          onClick={() => {
            const page = newPage(plan, "New page");
            page.id = `${page.id}-${plan.pages.length}`;
            set({ pages: [...plan.pages.slice(0, -1), page, ...plan.pages.slice(-1)] });
          }}
        >
          <Plus />
          Add a page
        </Button>
      </Section>

      <Section n={3} show={r >= 3} title="Agents" hint="Open one to set its tools, framework and guardrails">
        <ul className="space-y-2">
          {plan.agents.map((a, i) => (
            <li key={a.id} className="group rounded-xl border border-border bg-card px-3.5 py-3 shadow-card">
              <div className="flex items-start gap-3">
                <AgentAvatar id={a.id} name={a.name} className="mt-0.5 size-7 rounded-md text-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Agent name"
                      value={a.name}
                      onChange={(e) => set({ agents: plan.agents.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      className="min-w-0 flex-1 rounded bg-transparent text-sm font-medium outline-none focus:bg-muted/50"
                    />
                    <button
                      type="button"
                      onClick={() => ws.openAgent(a.id)}
                      className="group/agent inline-flex shrink-0 items-center gap-1 rounded-md text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Open ${a.name} in the Agents tab`}
                    >
                      <FrameworkChip framework={a.framework} className="group-hover/agent:border-border-strong" />
                      {isPro && <span className="hidden font-mono sm:inline">{a.model.replace("claude-", "")}</span>}
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                  <AutoTextarea
                    ariaLabel="Agent role"
                    value={a.role}
                    onChange={(v) => set({ agents: plan.agents.map((x, j) => (j === i ? { ...x, role: v } : x)) })}
                    className="mt-0.5 text-xs text-muted-foreground"
                  />
                  {a.tools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.tools.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          <Wrench className="size-2.5" />
                          {toolLabel(t)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {plan.agents.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() =>
                      set({
                        agents: plan.agents.filter((_, j) => j !== i),
                        pages: plan.pages.map((p) => (p.agent === a.id ? { ...p, agent: plan.agents.find((x) => x.id !== a.id)?.id } : p)),
                      })
                    }
                    className="rounded-md p-1 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Button
          size="xs"
          variant="ghost"
          className="mt-2"
          onClick={() => {
            const a = newAgent("Helper");
            a.id = `${a.id}-${plan.agents.length}`;
            set({ agents: [...plan.agents, a] });
          }}
        >
          <Plus />
          Add an agent
        </Button>
      </Section>

      <Section n={4} show={r >= 4} title="How the agents work together" hint="Pages, handoffs and where results go">
        <div className="relative h-[300px] overflow-hidden rounded-xl border border-border bg-sunken">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
          <AgentFlow plan={plan} compact onSelect={(id) => ws.openAgent(id)} connections={ws.connections} />
        </div>
      </Section>

      <Section n={5} show={r >= 5} title="Data" hint="Ask in the chat to add a field">
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.data.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-3.5 shadow-card">
              <p className="text-sm font-medium">
                {c.name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{c.rows.length} sample rows</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.fields.map((f) => (
                  <span key={f.key} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {f.key}
                    <span className="text-subtle-foreground">: {f.type}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={6} show={r >= 6} title="Connections and decisions">
        <div className="flex flex-wrap gap-1.5">
          {plan.integrations.length ? (
            plan.integrations.map((i) => (
              <span key={i} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                {i}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No outside connections.</span>
          )}
        </div>
        {plan.notes.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {plan.notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
                {n}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
