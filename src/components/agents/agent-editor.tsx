"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS } from "@/lib/constants";
import { GUARDRAILS, MEMORY_OPTIONS, tokenCount, typicalCredits, withAgentDefaults } from "@/lib/sim/agents";
import { FRAMEWORK_LIST, frameworkOf } from "@/lib/sim/frameworks";
import type { ConnectionView } from "@/lib/integrations";
import type { AgentMemory, PlanAgent } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";
import { AgentAvatar, LanguageChip } from "./agent-bits";
import { AgentCode } from "./agent-code";
import { KnowledgeSection } from "./knowledge-section";
import { ToolsSection } from "./tools-section";

export type AgentEditorProps = {
  /** The draft being edited. */
  agent: PlanAgent;
  onChange: (next: PlanAgent) => void;
  /** Agents this one can hand work to (empty for standalone agents). */
  others: PlanAgent[];
  connections: ConnectionView[];
  onConnected: (c: ConnectionView) => void;
  /** Shown on the connect consent screen. */
  account: string;
  isPro: boolean;
  /** Used to generate the framework code preview. */
  codeContext: { appName: string; agents: PlanAgent[] };
  onOpenCode?: (path: string) => void;
  canOpenCode?: (path: string) => boolean;
  onTest?: () => void;
  /** Phones: back to the list. */
  onBack?: () => void;
  readOnly?: boolean;
  /** A note above the form, e.g. "Editing unlocks when the build finishes". */
  notice?: React.ReactNode;
};

function Section({ title, hint, children, id }: { title: string; hint?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-2" aria-labelledby={id}>
      <div className="mb-3">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function AutoGrow({ value, onChange, id, readOnly, className, placeholder }: { value: string; onChange: (v: string) => void; id: string; readOnly?: boolean; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 120)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full resize-none rounded-xl border border-border bg-card px-3.5 py-3 text-sm leading-relaxed shadow-card outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/30",
        className,
      )}
    />
  );
}

export function AgentEditor(props: AgentEditorProps) {
  const { onChange, others, isPro, readOnly } = props;
  const agent = withAgentDefaults(props.agent);
  const [showFrameworks, setShowFrameworks] = useState(false);
  const set = (patch: Partial<PlanAgent>) => onChange({ ...agent, ...patch });
  const framework = frameworkOf(agent.framework);
  const memory = agent.memory ?? { mode: "conversation", window: 20 };
  const pickFrameworks = isPro || showFrameworks;
  const idp = `agent-${agent.id}`;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-5 pb-24 md:px-8 md:pt-7">
      {props.onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground md:hidden" onClick={props.onBack}>
          <ArrowLeft />
          All agents
        </Button>
      )}
      <header className="flex items-start gap-3.5">
        <AgentAvatar id={agent.id} name={agent.name} className="mt-1 size-11 rounded-xl text-sm" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idp}-name`} className="sr-only">
            Agent name
          </label>
          <input
            id={`${idp}-name`}
            value={agent.name}
            readOnly={readOnly}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full rounded-md bg-transparent text-xl font-semibold tracking-tight outline-none focus:bg-muted/50"
          />
          <label htmlFor={`${idp}-role`} className="sr-only">
            Role
          </label>
          <input
            id={`${idp}-role`}
            value={agent.role}
            readOnly={readOnly}
            maxLength={300}
            placeholder="What this agent is for, in one line"
            onChange={(e) => set({ role: e.target.value })}
            className="mt-0.5 w-full rounded-md bg-transparent text-sm text-muted-foreground outline-none focus:bg-muted/50"
          />
        </div>
        {props.onTest && (
          <Button variant="outline" size="sm" className="mt-1 shrink-0" onClick={props.onTest}>
            <FlaskConical />
            Test
          </Button>
        )}
      </header>
      {props.notice && <div className="mt-4">{props.notice}</div>}

      <div className="mt-6">
        <Section
          id={`${idp}-instructions-h`}
          title={isPro ? "Instructions" : "What it does"}
          hint={
            isPro ? (
              <>
                The system prompt. <span className="font-mono">~{tokenCount(agent.instructions).toLocaleString("en-US")} tokens</span>
                {agent.guardrails?.length ? " · guardrails are appended as rules" : ""}
              </>
            ) : (
              "Describe the job like you would to a new teammate: what to look at, what good looks like, and when to ask for help."
            )
          }
        >
          <AutoGrow
            id={`${idp}-instructions`}
            value={agent.instructions}
            readOnly={readOnly}
            onChange={(v) => set({ instructions: v })}
            className={isPro ? "font-mono text-[12.5px]" : undefined}
            placeholder="You read each new ticket and…"
          />
        </Section>

        <Section id={`${idp}-model-h`} title="Model" hint="Opus is the most capable. Sonnet is faster and costs about 60% less per run.">
          <div role="radiogroup" aria-labelledby={`${idp}-model-h`} className="grid gap-2 sm:grid-cols-2">
            {MODELS.map((m) => {
              const on = agent.model === m.id;
              const credits = typicalCredits({ ...agent, model: m.id });
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={readOnly}
                  onClick={() => set({ model: m.id })}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left shadow-card transition-colors",
                    on ? "border-foreground/40 ring-1 ring-foreground/15" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground" : "border-border-strong")}>
                    {on && <span className="size-2 rounded-full bg-foreground" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">About {credits.toFixed(2)} credits a run</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          id={`${idp}-framework-h`}
          title="Framework"
          hint={isPro ? "The code this agent is generated in. Switch any time: the old files are removed and the new ones added in one version." : undefined}
        >
          {!pickFrameworks ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 shadow-card">
              <span className="text-sm">
                Runs on <span className="font-medium">{framework.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">{framework.id === "lyzr" ? "Hosted for you, nothing to set up." : framework.description}</span>
              {!readOnly && (
                <button type="button" onClick={() => setShowFrameworks(true)} className="ml-auto text-xs font-medium text-brand-text underline-offset-4 hover:underline">
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <div role="radiogroup" aria-labelledby={`${idp}-framework-h`} className="grid gap-2 sm:grid-cols-2">
                {FRAMEWORK_LIST.map((f) => {
                  const on = framework.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={readOnly}
                      onClick={() => set({ framework: f.id })}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left shadow-card transition-colors",
                        on ? "border-foreground/40 ring-1 ring-foreground/15" : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className={cn("mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground" : "border-border-strong")}>
                        {on && <span className="size-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{f.label}</span>
                          <LanguageChip language={f.language} />
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{f.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {isPro && (
                <div className="mt-3">
                  <AgentCode agent={agent} context={props.codeContext} onOpenCode={props.onOpenCode} canOpen={props.canOpenCode} />
                </div>
              )}
            </>
          )}
        </Section>

        <Section id={`${idp}-tools-h`} title="Tools" hint={isPro ? "Built-ins, the workspace's connections and MCP servers. Keys stay on the server." : "What this agent is allowed to use. Switch a tool on to let it."}>
          <ToolsSection
            tools={agent.tools}
            onChange={(tools) => set({ tools })}
            connections={props.connections}
            onConnected={props.onConnected}
            account={props.account}
            isPro={isPro}
            readOnly={readOnly}
          />
        </Section>

        <Section id={`${idp}-knowledge-h`} title={isPro ? "Knowledge" : "Files this agent can read"} hint={isPro ? undefined : "Add documents and sheets. The agent quotes them when it answers."}>
          <KnowledgeSection
            files={agent.knowledge ?? []}
            isPro={isPro}
            readOnly={readOnly}
            onChange={(knowledge) =>
              set({
                knowledge,
                // Files are only useful with the knowledge base on, so adding the first one switches it on.
                tools: knowledge.length > (agent.knowledge?.length ?? 0) && !agent.tools.includes("Knowledge base") ? [...agent.tools, "Knowledge base"] : agent.tools,
              })
            }
          />
        </Section>

        <Section id={`${idp}-memory-h`} title="Memory">
          <div role="radiogroup" aria-labelledby={`${idp}-memory-h`} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            {MEMORY_OPTIONS.map((o) => {
              const on = memory.mode === o.mode;
              return (
                <div key={o.mode} className={cn("flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-0", on && "bg-muted/40")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={readOnly}
                    onClick={() => set({ memory: { mode: o.mode, ...(o.mode === "conversation" ? { window: memory.window ?? 20 } : {}) } as AgentMemory })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground" : "border-border-strong")}>
                      {on && <span className="size-2 rounded-full bg-foreground" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">{o.note}</span>
                    </span>
                  </button>
                  {o.mode === "conversation" && on && (
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      Last
                      <select
                        value={memory.window ?? 20}
                        disabled={readOnly}
                        onChange={(e) => set({ memory: { mode: "conversation", window: Number(e.target.value) } })}
                        className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none"
                        aria-label="How many turns to remember"
                      >
                        {[5, 10, 20, 50].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      turns
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section id={`${idp}-guardrails-h`} title="Guardrails" hint="Checked before every reply. When one trips, the trace in the test console says so.">
          <ul className="space-y-1">
            {GUARDRAILS.map((g) => {
              const on = !!agent.guardrails?.includes(g.id);
              return (
                <li key={g.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={readOnly}
                      onChange={(e) => set({ guardrails: e.target.checked ? [...(agent.guardrails ?? []), g.id] : (agent.guardrails ?? []).filter((x) => x !== g.id) })}
                      className="mt-0.5 size-4 shrink-0 accent-foreground"
                    />
                    <span className="min-w-0">
                      {g.label}
                      {isPro && <span className="ml-2 font-mono text-[10.5px] text-subtle-foreground">{g.code}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>

        {others.length > 0 && (
          <Section id={`${idp}-handoffs-h`} title="Hands off to" hint="Agents it can pass work to. Handoffs show as dashed lines in the Flow view.">
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${idp}-handoffs-h`}>
              {others.map((o) => {
                const on = !!agent.handoffs?.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    disabled={readOnly}
                    onClick={() => set({ handoffs: on ? (agent.handoffs ?? []).filter((x) => x !== o.id) : [...(agent.handoffs ?? []), o.id] })}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors",
                      on ? "border-brand/50 bg-brand-soft text-brand-text" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    <AgentAvatar id={o.id} name={o.name} className="size-7 rounded-full text-[10px]" />
                    {o.name}
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
