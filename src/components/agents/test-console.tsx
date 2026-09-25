"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  CircleCheck,
  CircleX,
  EyeOff,
  FlaskConical,
  Inbox,
  Loader2,
  Play,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { defaultExpect, evaluateTest, type RunResult, type TestResult, type TraceKind } from "@/lib/sim/agents";
import type { AgentTest, PlanAgent } from "@/lib/sim/types";
import { useTyping } from "@/components/preview/bits";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "./agent-bits";

type Turn = {
  id: number;
  input: string;
  status: "running" | "tracing" | "answering" | "done" | "error";
  result?: RunResult;
  /** How many trace steps have streamed in. */
  shown: number;
};

const STEP_ICON: Record<TraceKind, typeof Inbox> = {
  input: Inbox,
  redact: EyeOff,
  memory: Brain,
  tool: Wrench,
  retrieve: BookOpen,
  generate: Sparkles,
  guardrail: ShieldCheck,
  handoff: ArrowRightLeft,
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Starts a stopwatch; call the result for the milliseconds since. */
function stopwatch() {
  const started = Date.now();
  return () => Date.now() - started;
}
const newTestId = () => `t${Date.now().toString(36)}${++testSeq}`;
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toLocaleString("en-US")} ms`);

let turnSeq = 0;
let testSeq = 0;

/**
 * Chat with one agent on its own. Before each reply its trace streams in (tool calls, retrieval,
 * tokens, guardrails or a handoff), then the answer types out. Replies can become test cases.
 */
export function TestConsole({
  agent,
  isPro,
  run,
  tests,
  onSaveTests,
  dirty,
  className,
}: {
  agent: PlanAgent;
  isPro: boolean;
  run: (input: string, turn: number) => Promise<RunResult>;
  tests: AgentTest[];
  onSaveTests: (tests: AgentTest[]) => Promise<void>;
  /** The editor has unsaved changes: runs and tests use them. */
  dirty?: boolean;
  className?: string;
}) {
  const [view, setView] = useState<"chat" | "tests">("chat");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [traceView, setTraceView] = useState<"steps" | "json">("steps");
  const [results, setResults] = useState<Record<string, TestResult | "running">>({});
  const [runningAll, setRunningAll] = useState<{ done: number; total: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "running" || t.status === "tracing");
  const last = turns[turns.length - 1];

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length, last?.shown, last?.status]);

  const update = (id: number, patch: Partial<Turn>) => setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function send(raw: string) {
    const input = raw.trim();
    if (!input || busy) return;
    setText("");
    const id = ++turnSeq;
    const index = turns.length;
    setTurns((list) => [...list, { id, input, status: "running", shown: 0 }]);
    const elapsed = stopwatch();
    let result: RunResult;
    try {
      result = await run(input, index);
    } catch {
      update(id, { status: "error" });
      return;
    }
    await wait(Math.max(0, 350 - elapsed()));
    update(id, { status: "tracing", result, shown: 1 });
    for (let i = 1; i < result.trace.length; i++) {
      await wait(Math.min(460, Math.max(160, result.trace[i].ms / 3)));
      update(id, { shown: i + 1 });
    }
    await wait(180);
    update(id, { status: "answering" });
  }

  async function saveTest(input: string, expect: string) {
    const next = [...tests, { id: newTestId(), input, expect: expect.trim() }];
    try {
      await onSaveTests(next);
      toast.success(`Saved as test case ${next.length}`, { description: `Expects the reply to mention “${expect.trim()}”.` });
      return true;
    } catch {
      toast.error("Couldn't save the test case");
      return false;
    }
  }

  async function removeTest(id: string) {
    try {
      await onSaveTests(tests.filter((t) => t.id !== id));
    } catch {
      toast.error("Couldn't remove the test case");
    }
  }

  async function runAll() {
    if (!tests.length || runningAll) return;
    setResults({});
    setRunningAll({ done: 0, total: tests.length });
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      setResults((r) => ({ ...r, [t.id]: "running" }));
      await wait(650);
      setResults((r) => ({ ...r, [t.id]: evaluateTest(agent, t) }));
      setRunningAll({ done: i + 1, total: tests.length });
    }
    await wait(250);
    setRunningAll(null);
  }

  const finished = Object.values(results).filter((r): r is TestResult => r !== "running");
  const passed = finished.filter((r) => r.pass).length;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div role="tablist" aria-label="Console" className="flex items-center rounded-lg bg-muted/60 p-0.5">
          {(["chat", "tests"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("h-7 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", view === v && "bg-card text-foreground shadow-card dark:bg-accent")}
            >
              {v === "chat" ? "Chat" : `Tests${tests.length ? ` · ${tests.length}` : ""}`}
            </button>
          ))}
        </div>
        {view === "chat" && isPro && (
          <div role="radiogroup" aria-label="Trace view" className="ml-auto flex items-center rounded-lg bg-muted/60 p-0.5">
            {(["steps", "json"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={traceView === v}
                onClick={() => setTraceView(v)}
                className={cn("h-7 rounded-md px-2 font-mono text-[11px] text-muted-foreground uppercase", traceView === v && "bg-card text-foreground shadow-card dark:bg-accent")}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {view === "chat" && turns.length > 0 && (
          <Button size="xs" variant="ghost" className={cn("text-muted-foreground", !isPro && "ml-auto")} disabled={busy} onClick={() => setTurns([])}>
            Clear
          </Button>
        )}
      </div>

      {view === "chat" ? (
        <>
          <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
            <div className="flex items-start gap-2.5">
              <AgentAvatar id={agent.id} name={agent.name} className="size-7 rounded-full text-[10px]" />
              <div className="min-w-0 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                Hi, I&apos;m {agent.name}. {agent.role}
              </div>
            </div>
            {turns.map((t) => (
              <TurnView key={t.id} turn={t} agent={agent} isPro={isPro} traceView={traceView} onSaveTest={saveTest} onDone={() => update(t.id, { status: "done" })} />
            ))}
          </div>
          <div className="shrink-0 border-t border-border p-3">
            {turns.length === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {["What can you help me with?", "A customer is asking for a refund on their last order"].map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
              className="flex items-end gap-2 rounded-xl border border-border-strong bg-card p-1.5 pl-3 focus-within:border-foreground/25"
            >
              <label htmlFor={`console-${agent.id}`} className="sr-only">
                Message {agent.name}
              </label>
              <textarea
                id={`console-${agent.id}`}
                value={text}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                placeholder={`Message ${agent.name}…`}
                className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
              />
              <Button type="submit" size="icon-sm" aria-label="Send" disabled={!text.trim() || busy} className="rounded-lg">
                {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
              </Button>
            </form>
            {dirty && <p className="mt-1.5 text-[11px] text-muted-foreground">Runs use your unsaved changes.</p>}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Test cases</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                A test passes while the agent&apos;s instructions still cover the phrase it expects.{dirty ? " Runs use your unsaved changes." : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => void runAll()} disabled={!tests.length || !!runningAll} className="shrink-0">
              {runningAll ? <Loader2 className="animate-spin" /> : <Play />}
              Run all tests
            </Button>
          </div>
          {runningAll && (
            <div className="mt-4" role="status">
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${(runningAll.done / runningAll.total) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Running {Math.min(runningAll.done + 1, runningAll.total)} of {runningAll.total}…
              </p>
            </div>
          )}
          {!runningAll && finished.length === tests.length && tests.length > 0 && (
            <p className={cn("mt-4 rounded-lg px-3 py-2 text-xs font-medium", passed === tests.length ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive")} role="status">
              {passed} passed{passed < tests.length ? ` · ${tests.length - passed} failed` : ""}
            </p>
          )}
          {tests.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
              <FlaskConical className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No test cases yet</p>
              <p className="mx-auto mt-1 max-w-64 text-xs text-muted-foreground">Chat with the agent, then save a good reply as a test case so later changes can&apos;t quietly break it.</p>
              <Button size="xs" variant="outline" className="mt-3" onClick={() => setView("chat")}>
                Go to chat
              </Button>
            </div>
          ) : (
            <ol className="mt-4 space-y-2">
              {tests.map((t, i) => {
                const r = results[t.id];
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-card px-3.5 py-3 shadow-card">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0">
                        {r === "running" ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : r?.pass ? (
                          <CircleCheck className="size-4 text-success" aria-label="Passed" />
                        ) : r ? (
                          <CircleX className="size-4 text-destructive" aria-label="Failed" />
                        ) : (
                          <span className="flex size-4 items-center justify-center rounded-full border border-border-strong font-mono text-[9px] text-muted-foreground">{i + 1}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{t.input}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Expects <span className="rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground">{t.expect}</span>
                        </p>
                        {r && r !== "running" && <p className={cn("mt-1.5 text-xs", r.pass ? "text-success" : "text-destructive")}>{r.detail}</p>}
                      </div>
                      <Button size="icon-xs" variant="ghost" aria-label={`Delete test case ${i + 1}`} className="text-muted-foreground" onClick={() => void removeTest(t.id)} disabled={!!runningAll}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function TurnView({
  turn,
  agent,
  isPro,
  traceView,
  onSaveTest,
  onDone,
}: {
  turn: Turn;
  agent: PlanAgent;
  isPro: boolean;
  traceView: "steps" | "json";
  onSaveTest: (input: string, expect: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const r = turn.result;
  const answering = turn.status === "answering" || turn.status === "done";
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-foreground px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap text-background">{turn.input}</div>
      </div>
      {turn.status === "running" && (
        <p className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {agent.name} is working…
        </p>
      )}
      {turn.status === "error" && <p className="pl-9 text-xs text-destructive">That run failed. Check your connection and try again.</p>}
      {r && (
        <div className="pl-9">
          {traceView === "json" && isPro ? (
            <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-sunken p-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
              {JSON.stringify({ trace: r.trace.slice(0, turn.shown), ...(answering ? { usage: r.usage, handoff: r.handoff ?? null } : {}) }, null, 2)}
            </pre>
          ) : (
            <ol className="overflow-hidden rounded-xl border border-border bg-sunken" aria-label="Trace">
              {r.trace.slice(0, turn.shown).map((s, i) => {
                const Icon = STEP_ICON[s.kind];
                const live = turn.status === "tracing" && i === turn.shown - 1;
                return (
                  <li key={i} className={cn("flex items-start gap-2.5 border-b border-border px-3 py-1.5 text-xs last:border-0", s.kind === "handoff" && "bg-warning-soft")}>
                    <Icon className={cn("mt-px size-3.5 shrink-0", s.kind === "handoff" ? "text-warning" : s.kind === "guardrail" ? "text-success" : "text-muted-foreground")} />
                    <span className={cn("min-w-0 flex-1 [overflow-wrap:anywhere]", s.kind === "tool" && "font-mono text-[11px]")}>
                      {s.label}
                      {s.detail && <span className="text-muted-foreground"> · {s.detail}</span>}
                    </span>
                    {s.tokens && (
                      <span className="hidden shrink-0 font-mono text-[10.5px] text-muted-foreground sm:inline">
                        {s.tokens.input.toLocaleString("en-US")} in / {s.tokens.output.toLocaleString("en-US")} out
                      </span>
                    )}
                    <span className="w-14 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground tabular-nums">{live ? <Loader2 className="ml-auto size-3 animate-spin" /> : fmtMs(s.ms)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
      {r && answering && <Answer turn={turn} result={r} agent={agent} isPro={isPro} onSaveTest={onSaveTest} onDone={onDone} />}
    </div>
  );
}

function Answer({
  turn,
  result,
  agent,
  isPro,
  onSaveTest,
  onDone,
}: {
  turn: Turn;
  result: RunResult;
  agent: PlanAgent;
  isPro: boolean;
  onSaveTest: (input: string, expect: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const typed = useTyping(result.output, turn.status === "answering");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const done = typed.done;
  const status = turn.status;

  useEffect(() => {
    if (done && status === "answering") onDone();
  }, [done, status, onDone]);

  const u = result.usage;
  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar id={agent.id} name={agent.name} className="size-7 rounded-full text-[10px]" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {typed.text}
          {!done && <span className="animate-caret ml-px inline-block h-4 w-[2px] translate-y-0.5 bg-foreground" />}
        </div>
        {done && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
            <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
              {fmtMs(u.latencyMs)} · {isPro ? `${u.inputTokens.toLocaleString("en-US")} in / ${u.outputTokens.toLocaleString("en-US")} out` : `${(u.inputTokens + u.outputTokens).toLocaleString("en-US")} tokens`} · {u.credits.toFixed(2)} credits
            </span>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-success">
                <Check className="size-3" />
                Saved as a test case
              </span>
            ) : saving === null ? (
              <button type="button" onClick={() => setSaving(defaultExpect(result.output, agent))} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                <Plus className="size-3" />
                Save as test case
              </button>
            ) : null}
          </div>
        )}
        {saving !== null && !saved && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 pl-3 shadow-card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!saving.trim()) return;
              if (await onSaveTest(turn.input, saving)) setSaved(true);
            }}
          >
            <label htmlFor={`expect-${turn.id}`} className="text-xs text-muted-foreground">
              Expect the reply to mention
            </label>
            <input
              id={`expect-${turn.id}`}
              value={saving}
              autoFocus
              maxLength={200}
              onChange={(e) => setSaving(e.target.value)}
              className="h-7 min-w-24 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus:border-ring"
            />
            <Button size="xs" type="submit" disabled={!saving.trim()}>
              Save test
            </Button>
            <Button size="xs" type="button" variant="ghost" onClick={() => setSaving(null)}>
              Cancel
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
