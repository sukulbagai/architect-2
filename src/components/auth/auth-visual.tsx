import { Check } from "lucide-react";

const STEPS = [
  { label: "Plan locked", detail: "4 pages · 3 agents · 2 tables" },
  { label: "Agents", detail: "Triage, Answer drafter, Escalation" },
  { label: "Data", detail: "tickets, replies" },
  { label: "UI", detail: "Queue, Draft editor, Settings" },
  { label: "Test", detail: "Fixed 1 issue on its own" },
];

/**
 * The sign-in side panel shows what's on the other side: a build timeline, drawn on the drafting
 * grid with dimension marks, instead of a stock illustration.
 */
export function AuthVisual() {
  return (
    <div className="relative hidden overflow-hidden border-l border-border bg-sunken lg:flex lg:flex-col lg:justify-between">
      <div className="bg-grid-major pointer-events-none absolute inset-0" />
      <div className="relative p-10">
        <p className="annotation">Sheet A-01 · Build timeline</p>
      </div>

      <div className="relative mx-auto w-full max-w-[380px] px-6">
        <div className="absolute -top-7 right-6 left-6 flex items-center gap-2 text-[10px] text-subtle-foreground">
          <span className="h-px flex-1 bg-border-strong" />
          <span className="font-mono">≈ 3 min 40 s</span>
          <span className="h-px flex-1 bg-border-strong" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-float">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Support Desk Copilot</p>
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">Ready</span>
          </div>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex items-start gap-3 animate-rise" style={{ animationDelay: `${150 + i * 120}ms` }}>
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm">{s.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
            <span className="truncate font-mono text-xs text-muted-foreground">support-desk.architect.app</span>
            <span className="rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-brand-foreground">Deploy</span>
          </div>
        </div>
      </div>

      <div className="relative p-10">
        <blockquote className="max-w-sm">
          <p className="font-display text-[26px] leading-[1.15] tracking-[-0.01em]">
            Describe it. Check the plan. <span className="italic">Ship it.</span>
          </p>
          <footer className="mt-3 text-sm text-muted-foreground">
            The same project, in plain language or in code, whichever you prefer.
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
