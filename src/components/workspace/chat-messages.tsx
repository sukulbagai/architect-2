"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  FileCode2,
  Hammer,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import type { ClientMessage } from "@/lib/actions/build";
import type { BuildSummary, EditSummary, PlanQuestion } from "@/lib/sim/types";
import { STEP_LABEL, STEP_ORDER, type Workspace } from "./use-workspace";

type Props = { ws: Workspace; isPro: boolean; onSend: (text: string, mode: "plan" | "build") => void };

export function ChatMessages({ ws, isPro, onSend }: Props) {
  const { messages, hiddenId, project, plan, build, thinking } = ws;
  const hasPlanMessage = messages.some((m) => m.kind === "plan");
  const visible = messages.filter((m) => m.id !== hiddenId);

  return (
    <div className="space-y-5">
      {visible.map((m) => (
        <MessageView key={m.id} m={m} {...{ ws, isPro, onSend }} />
      ))}

      {project.stage === "plan" && plan && !hasPlanMessage && !thinking && (
        <PlanReady ws={ws} data={{ pages: plan.pages.length, agents: plan.agents.length, tables: plan.data.length, estimate: plan.estimate }} />
      )}

      {build && <LiveBuildCard ws={ws} isPro={isPro} />}

      {!build && project.stage === "build" && !thinking && (
        <AssistantRow>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-medium">The last build was interrupted</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing was saved. The plan is intact, so you can pick up from there.</p>
            <Button className="mt-3" size="sm" onClick={() => void ws.runBuild()}>
              <RotateCcw />
              Resume build
            </Button>
          </div>
        </AssistantRow>
      )}

      {thinking && <Thinking label={thinking} />}
    </div>
  );
}

function AssistantRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 size-6" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
      <LogoMark className="size-6" />
      <span className="flex items-center gap-2">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-pulse rounded-full bg-brand-text/70" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </span>
        {label}…
      </span>
    </div>
  );
}

function MessageView({ m, ws, isPro, onSend }: { m: ClientMessage } & Props) {
  const data = (m.data ?? {}) as Record<string, unknown>;

  if (m.role === "user") {
    const attachments = (data.attachments as { name: string }[] | undefined) ?? [];
    return (
      <div className="flex flex-col items-end gap-1.5">
        {data.mode === "plan" && data.stage === "ready" && <span className="annotation text-info">Plan mode</span>}
        <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1">
            {attachments.map((a) => (
              <span key={a.name} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (m.role === "system") {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span className="max-w-[80%] text-center text-pretty">{m.content}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }

  switch (m.kind) {
    case "questions":
      return (
        <AssistantRow>
          <p className="mb-3 text-sm leading-relaxed">{m.content}</p>
          <QuestionsCard ws={ws} messageId={m.id} questions={(data.questions as PlanQuestion[]) ?? []} answered={(data.answered ?? ws.answered[m.id]) as Record<string, string[]> | "skipped" | undefined} />
        </AssistantRow>
      );
    case "plan":
      return (
        <AssistantRow>
          <p className="mb-3 text-sm leading-relaxed">{m.content}</p>
          <PlanReady ws={ws} data={data as PlanReadyData} />
        </AssistantRow>
      );
    case "build":
      return (
        <AssistantRow>
          <BuildDone ws={ws} isPro={isPro} data={data as unknown as BuildSummary} onSend={onSend} />
        </AssistantRow>
      );
    case "edit":
      return (
        <AssistantRow>
          <EditCard ws={ws} isPro={isPro} data={data as unknown as EditSummary & { previousVersionId: string | null; author: string }} />
        </AssistantRow>
      );
    case "plan-reply":
      return (
        <AssistantRow>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info">
              <Lightbulb className="size-3" />
              Planning
            </span>
            <p className="mt-2 text-sm">{m.content}</p>
            <ul className="mt-3 space-y-2">
              {((data.ideas as string[]) ?? []).map((idea) => (
                <li key={idea} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{idea}</span>
                  <Button size="xs" variant="outline" onClick={() => onSend(idea, "build")}>
                    Build this
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </AssistantRow>
      );
    default: {
      const examples = (data.examples as string[] | undefined) ?? [];
      const changes = (data.changes as string[] | undefined) ?? [];
      return (
        <AssistantRow>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
          {changes.length > 1 && (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {changes.map((c) => (
                <li key={c} className="flex items-center gap-2">
                  <Check className="size-3.5 text-success" />
                  {c}
                </li>
              ))}
            </ul>
          )}
          {examples.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {examples.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onSend(e, "build")}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-border-strong"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </AssistantRow>
      );
    }
  }
}

// ---------------------------------------------------------------------------------------------

function QuestionsCard({
  ws,
  messageId,
  questions,
  answered,
}: {
  ws: Workspace;
  messageId: string;
  questions: PlanQuestion[];
  answered?: Record<string, string[]> | "skipped";
}) {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [sending, setSending] = useState(false);
  const locked = !!answered || sending || ws.project.stage !== "plan";

  function toggle(q: PlanQuestion, id: string) {
    if (locked) return;
    setPicks((p) => {
      const cur = p[q.id] ?? [];
      const next = q.multi ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id];
      return { ...p, [q.id]: next };
    });
  }

  const selected = answered && answered !== "skipped" ? answered : picks;
  const count = Object.values(picks).filter((v) => v.length).length;

  return (
    <div className={cn("space-y-4 rounded-xl border border-border bg-card p-4 shadow-card", answered && "bg-muted/30 shadow-none")} data-message={messageId}>
      {questions.map((q, qi) => (
        <fieldset key={q.id} disabled={locked}>
          <legend className="mb-2 text-sm font-medium">
            <span className="mr-1.5 font-mono text-xs text-subtle-foreground">{qi + 1}</span>
            {q.text}
            {q.multi && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Pick any</span>}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((o) => {
              const on = (selected[q.id] ?? []).includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role={q.multi ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => toggle(q, o.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:cursor-default",
                    on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-border-strong",
                    locked && !on && "opacity-50",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {!locked ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setSending(true);
              void ws.answer(null);
            }}
          >
            Skip questions
          </button>
          <Button
            size="sm"
            disabled={count === 0}
            className="bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={() => {
              setSending(true);
              void ws.answer(picks);
            }}
          >
            Draft the plan
            <ArrowRight />
          </Button>
        </div>
      ) : (
        answered === "skipped" && <p className="text-xs text-muted-foreground">Skipped. The plan uses sensible defaults.</p>
      )}
    </div>
  );
}

type PlanReadyData = { pages: number; agents: number; tables: number; estimate: { seconds: number; credits: number } };

function PlanReady({ ws, data: saved }: { ws: Workspace; data: PlanReadyData }) {
  const canBuild = ws.project.stage === "plan" && !ws.build;
  const live = ws.project.stage === "plan" && ws.plan;
  const data: PlanReadyData = live
    ? { pages: live.pages.length, agents: live.agents.length, tables: live.data.length, estimate: live.estimate }
    : saved;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="flex size-5 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-3" strokeWidth={3} />
          </span>
          Plan ready
        </span>
        <button type="button" onClick={() => ws.setTab("plan")} className="text-xs text-muted-foreground hover:text-foreground">
          Open plan
        </button>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border">
        {[
          [data.pages, "pages"],
          [data.agents, "agents"],
          [data.tables, data.tables === 1 ? "table" : "tables"],
        ].map(([n, label]) => (
          <div key={String(label)} className="px-4 py-3">
            <p className="text-xl font-semibold tabular-nums">{n}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          About {data.estimate.seconds} s · {data.estimate.credits} credits
        </p>
        {canBuild ? (
          <Button size="sm" onClick={() => void ws.runBuild()} className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Hammer />
            Build this
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{ws.project.stage === "ready" ? "Built" : "Building…"}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function StepIcon({ status }: { status: "todo" | "active" | "done" }) {
  if (status === "done")
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (status === "active")
    return (
      <span className="flex size-5 items-center justify-center rounded-full border border-brand text-brand-text">
        <Loader2 className="size-3 animate-spin" />
      </span>
    );
  return (
    <span className="flex size-5 items-center justify-center text-border-strong">
      <Circle className="size-3.5" />
    </span>
  );
}

function LiveBuildCard({ ws, isPro }: { ws: Workspace; isPro: boolean }) {
  const b = ws.build!;
  const seconds = Math.floor(b.elapsed / 1000);
  const total = Object.keys(b.files).length;
  const written = b.order.filter((p) => (b.streamed[p] ?? 0) >= 1).length;

  return (
    <AssistantRow>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card" aria-live="polite">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Building {ws.plan?.appName}</span>
          <span className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
            <Button size="xs" variant="outline" onClick={() => void ws.stop()}>
              <Square className="size-3 fill-current" />
              Stop
            </Button>
          </span>
        </div>
        <ol className="space-y-3 px-4 py-4">
          {STEP_ORDER.map((id) => {
            const s = b.steps[id];
            return (
              <li key={id} className={cn("flex gap-3", s.status === "todo" && "opacity-45")}>
                <StepIcon status={s.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{STEP_LABEL[id]}</p>
                  {s.detail && s.status === "done" && <p className="truncate text-xs text-muted-foreground">{s.detail}</p>}
                  {s.status === "active" && id !== "ui" && s.subs.length > 0 && (
                    <p className="animate-rise truncate text-xs text-muted-foreground" key={s.subs.length}>
                      {s.subs[s.subs.length - 1]}
                    </p>
                  )}
                  {id === "test" && s.status === "done" && s.subs.some((x) => x.startsWith("Fixed")) && (
                    <p className="mt-1 text-xs text-success">{s.subs.find((x) => x.startsWith("Fixed"))}</p>
                  )}
                  {id === "ui" && s.status === "active" && (
                    <div className="mt-1.5">
                      <p className="text-xs text-muted-foreground">
                        {isPro ? "Writing files" : "Building the screens"} · {written} of {total}
                      </p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(written / total) * 100}%` }} />
                      </div>
                      {isPro && (
                        <ul className="mt-2 space-y-1">
                          {b.order.slice(-4).map((p) => (
                            <li key={p} className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                              {(b.streamed[p] ?? 0) >= 1 ? <Check className="size-3 text-success" /> : <Loader2 className="size-3 animate-spin text-brand-text" />}
                              <span className="truncate">{p}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </AssistantRow>
  );
}

function BuildDone({ ws, isPro, data, onSend }: { ws: Workspace; isPro: boolean; data: BuildSummary; onSend: Props["onSend"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className="truncate">Built and ready to try</span>
        </span>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">v{data.version}</span>
      </div>
      <div className="space-y-3 px-4 py-3.5 text-sm">
        {(
          [
            ["Pages", data.pages],
            ["Agents", data.agents],
            ["Data", data.tables],
          ] as const
        ).map(([label, items]) => (
          <div key={label} className="flex gap-3">
            <span className="w-14 shrink-0 text-xs leading-6 text-muted-foreground">{label}</span>
            <div className="flex flex-wrap gap-1">
              {items.map((i) => (
                <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs leading-5">
                  {i}
                </span>
              ))}
            </div>
          </div>
        ))}
        {data.issue && (
          <div className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
            <span className="font-medium">Caught and fixed during testing:</span> {data.issue.found.charAt(0).toLowerCase() + data.issue.found.slice(1)}.{" "}
            {data.issue.fix}.
          </div>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Built in {data.seconds} s · {data.credits} credits
          </span>
          {isPro && (
            <button type="button" onClick={() => ws.setTab("code")} className="inline-flex items-center gap-1 hover:text-foreground">
              <FileCode2 className="size-3.5" />
              {data.files} files · open the code
            </button>
          )}
        </p>
      </div>
      {data.suggestions.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand-text" />
              What you could do next
            </span>
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {(open || ws.messages[ws.messages.length - 1]?.kind === "build") && (
            <div className="mt-2.5 flex flex-col gap-1.5">
              {data.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSend(s, "build")}
                  disabled={!!ws.thinking}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:border-border-strong disabled:opacity-50"
                >
                  {s}
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditCard({ ws, isPro, data }: { ws: Workspace; isPro: boolean; data: EditSummary & { previousVersionId: string | null; author: string } }) {
  const isCurrent = ws.currentVersion?.number === data.version;
  const added = data.files.reduce((s, f) => s + f.added, 0);
  const removed = data.files.reduce((s, f) => s + f.removed, 0);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="min-w-0 truncate text-sm font-medium">{data.author === "you" ? data.title : "Updated the app"}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          v{data.version}
          {isPro && (
            <>
              {" "}
              · <span className="text-success">+{added}</span> <span className="text-destructive">−{removed}</span>
            </>
          )}
        </span>
      </div>
      <ul className="space-y-1.5 px-4 py-3 text-sm">
        {data.changes.map((c) => (
          <li key={c} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
            {c}
          </li>
        ))}
      </ul>
      {isPro && data.files.length > 0 && (
        <ul className="space-y-0.5 border-t border-border px-4 py-2.5">
          {data.files.slice(0, 6).map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className="truncate text-muted-foreground">
                {f.status === "added" ? "A" : f.status === "deleted" ? "D" : "M"} {f.path}
              </span>
              <span className="shrink-0">
                <span className="text-success">+{f.added}</span> <span className="text-destructive">−{f.removed}</span>
              </span>
            </li>
          ))}
          {data.files.length > 6 && <li className="text-[11px] text-muted-foreground">and {data.files.length - 6} more</li>}
        </ul>
      )}
      <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
        {data.previousVersionId && isCurrent && (
          <Button size="xs" variant="outline" onClick={() => void ws.restore(data.previousVersionId!)}>
            <Undo2 />
            Undo
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => ws.setTab(isPro ? "versions" : "preview")}>
          {isPro ? "View changes" : "See it"}
        </Button>
      </div>
    </div>
  );
}
