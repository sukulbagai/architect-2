"use client";

import { useState } from "react";
import { Check, FileCode2, GitCommitHorizontal, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The core idea of 2.0 in one widget: one change, rendered for a builder and for a developer.
 */
export function TwoDepths() {
  const [mode, setMode] = useState<"simple" | "pro">("simple");

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <p className="annotation">One project, two depths</p>
        <h2 className="mt-3 text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance md:text-[40px]">
          The same change, told two ways.
        </h2>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-muted-foreground">
          Builders see what changed in the app and can undo it in one click. Developers see the diff, review it file by
          file, and commit it with a message. It&apos;s one project underneath, so a founder and an engineer can work on
          it together.
        </p>
        <div role="radiogroup" aria-label="Show as" className="mt-7 inline-flex rounded-xl border border-border bg-muted/60 p-1">
          {(
            [
              { id: "simple", label: "Simple", note: "for builders" },
              { id: "pro", label: "Pro", note: "for developers" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mode === o.id}
              onClick={() => setMode(o.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-left text-sm transition-colors",
                mode === o.id ? "bg-card shadow-card dark:bg-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="bg-dots absolute -inset-6 rounded-3xl" />
        <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-card shadow-composer">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">You asked: “Show urgent tickets first”</span>
            <span className="annotation">v7</span>
          </div>
          <div key={mode} className="animate-rise p-5">
            {mode === "simple" ? <SimpleView /> : <ProView />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleView() {
  return (
    <div>
      <p className="text-base font-semibold tracking-tight">Urgent tickets now come first</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(["Before", "After"] as const).map((label) => (
          <div key={label}>
            <p className="annotation mb-1.5">{label}</p>
            <div className="space-y-1.5 rounded-lg border border-border bg-sunken p-2.5">
              {[0, 1, 2].map((i) => {
                const urgent = label === "After" ? i === 0 : i === 2;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-card px-2 py-1.5 shadow-card">
                    <span className="h-1.5 flex-1 rounded-full bg-border-strong" />
                    {urgent && <span className="rounded bg-danger-soft px-1 text-[9px] font-medium text-destructive">Urgent</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {["Urgent tickets get a red tag and move to the top", "A new filter shows only urgent tickets"].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm">
          <Undo2 className="size-3.5" />
          Undo
        </span>
        <span className="inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-sm text-background">Looks good</span>
      </div>
    </div>
  );
}

const DIFF: { t: "ctx" | "add" | "del"; line: string }[] = [
  { t: "ctx", line: "export function Queue({ tickets }: Props) {" },
  { t: "del", line: "  const sorted = tickets" },
  { t: "add", line: "  const sorted = [...tickets].sort(byUrgency)" },
  { t: "add", line: "  const [urgentOnly, setUrgentOnly] = useState(false)" },
  { t: "ctx", line: "  return (" },
  { t: "add", line: '    <Filter label="Urgent only" on={urgentOnly} />' },
];

function ProView() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <GitCommitHorizontal className="size-4 text-muted-foreground" />
        <p className="font-mono text-sm">feat(queue): urgent-first sort and filter</p>
      </div>
      <div className="mt-2 flex gap-3 font-mono text-xs text-muted-foreground">
        <span>2 files</span>
        <span className="text-success">+18</span>
        <span className="text-destructive">−3</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
          <FileCode2 className="size-3.5 text-muted-foreground" />
          <span className="font-mono text-xs">src/components/Queue.tsx</span>
        </div>
        <pre className="overflow-x-auto py-1.5 font-mono text-[11.5px] leading-5">
          {DIFF.map((d, i) => (
            <div
              key={i}
              className={cn(
                "px-3",
                d.t === "add" && "bg-success-soft text-success",
                d.t === "del" && "bg-danger-soft text-destructive",
                d.t === "ctx" && "text-muted-foreground",
              )}
            >
              {d.t === "add" ? "+ " : d.t === "del" ? "− " : "  "}
              {d.line}
            </div>
          ))}
        </pre>
      </div>
      <div className="mt-5 flex gap-2">
        <span className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm">Reject</span>
        <span className="inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-sm text-background">Accept and commit</span>
      </div>
    </div>
  );
}
