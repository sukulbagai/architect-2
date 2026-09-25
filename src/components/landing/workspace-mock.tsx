"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Plan locked", detail: "3 pages · 3 agents · 2 tables" },
  { label: "Agents", detail: "Triage · Answer drafter · Escalation" },
  { label: "Data", detail: "tickets, replies" },
  { label: "UI", detail: "Queue, Draft editor" },
  { label: "Test", detail: "Caught and fixed 1 issue" },
];

const TICKETS = [
  { who: "Maya Chen", subject: "Refund for double charge", tag: "Urgent" },
  { who: "Omar Haddad", subject: "Can't reset my password", tag: "Account" },
  { who: "Lena Fischer", subject: "Invoice needs our VAT number", tag: "Billing" },
  { who: "Sam Okafor", subject: "Export to CSV is greyed out", tag: "Bug" },
];

/** A living miniature of the Workspace: the build timeline ticks, then the app appears. */
export function WorkspaceMock() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the finished state once
      setDone(STEPS.length);
      return;
    }
    const t = setInterval(() => setDone((d) => (d >= STEPS.length + 4 ? 0 : d + 1)), 1100);
    return () => clearInterval(t);
  }, []);

  const shown = Math.min(done, STEPS.length);
  const uiVisible = shown >= 4;

  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-card shadow-composer">
      <div className="flex h-10 items-center gap-3 border-b border-border px-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </div>
        <span className="text-xs font-medium">Support Desk Copilot</span>
        <span className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Simple</span>
          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors", shown >= STEPS.length ? "bg-brand text-brand-foreground" : "bg-muted text-subtle-foreground")}>
            Deploy
          </span>
        </span>
      </div>
      <div className="grid md:grid-cols-[280px_1fr]">
        <div className="border-b border-border p-4 md:border-r md:border-b-0">
          <div className="ml-6 rounded-xl rounded-tr-sm bg-muted px-3 py-2 text-xs leading-relaxed">
            A support desk that drafts replies from our help docs and escalates tricky tickets to Slack.
          </div>
          <ol className="mt-4 space-y-2.5">
            {STEPS.map((s, i) => {
              const state = i < shown ? "done" : i === shown ? "active" : "todo";
              return (
                <li key={s.label} className={cn("flex items-start gap-2.5 transition-opacity", state === "todo" && "opacity-40")}>
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                      state === "done" && "border-foreground bg-foreground text-background",
                      state === "active" && "border-brand text-brand-text",
                      state === "todo" && "border-border-strong",
                    )}
                  >
                    {state === "done" && <Check className="size-2.5" strokeWidth={3} />}
                    {state === "active" && <Loader2 className="size-2.5 animate-spin" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{s.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{s.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="relative min-h-[280px] bg-sunken p-4">
          <div className="bg-grid absolute inset-0" />
          <div
            className={cn(
              "relative h-full rounded-xl border border-border bg-background shadow-card transition-[opacity,transform] duration-500",
              uiVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold">Queue</span>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-text">4 open</span>
            </div>
            <ul>
              {TICKETS.map((t, i) => (
                <li key={t.subject} className={cn("flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0", i === 0 && "bg-muted/60")}>
                  <span className="avatar-hue flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold" style={{ "--hue": 40 + i * 70 } as React.CSSProperties}>
                    {t.who.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{t.subject}</span>
                    <span className="block text-[10px] text-muted-foreground">{t.who}</span>
                  </span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", i === 0 ? "bg-danger-soft text-destructive" : "bg-muted text-muted-foreground")}>{t.tag}</span>
                </li>
              ))}
            </ul>
            <div className="m-3 rounded-lg border border-dashed border-brand/40 bg-brand-soft/60 p-2.5">
              <p className="text-[10px] font-medium text-brand-text">Draft reply · from Refund policy §2</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Hi Maya, sorry about the double charge. I&apos;ve refunded the duplicate; you&apos;ll see it in 3–5 days.
              </p>
            </div>
          </div>
          {!uiVisible && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="annotation">Preview appears with the first screen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
