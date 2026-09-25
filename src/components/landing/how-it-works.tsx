import { Check, Globe, Loader2, Rocket } from "lucide-react";

export function HowItWorks() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Step n="01" title="Plan it together" body="Answer a few questions. Get a plan you can edit: pages, agents, data and what it will cost.">
        <div className="space-y-2">
          {[
            ["Pages", "Queue, Draft editor"],
            ["Agents", "Triage, Drafter, Escalation"],
            ["Data", "tickets, replies"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-md bg-card px-2.5 py-1.5 text-[11px] shadow-card">
              <span className="text-muted-foreground">{k}</span>
              <span className="truncate font-medium">{v}</span>
            </div>
          ))}
          <div className="rounded-md bg-foreground px-2.5 py-1.5 text-center text-[11px] font-medium text-background">Build this</div>
        </div>
      </Step>
      <Step n="02" title="Watch it get built" body="Step by step, in plain words, with a live preview from the very first screen.">
        <div className="space-y-2">
          {["Agents", "Data", "UI"].map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-[11px]">
              <span className={i < 2 ? "flex size-4 items-center justify-center rounded-full bg-foreground text-background" : "flex size-4 items-center justify-center rounded-full border border-brand text-brand-text"}>
                {i < 2 ? <Check className="size-2.5" strokeWidth={3} /> : <Loader2 className="size-2.5 animate-spin" />}
              </span>
              {s}
            </div>
          ))}
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full w-2/3 rounded-full bg-brand" />
          </div>
        </div>
      </Step>
      <Step n="03" title="Ship it" body="One click to a live URL after a pre-flight check. Sync to GitHub, roll back any time.">
        <div className="space-y-2">
          {["Build passes", "Secrets set", "No keys in client code"].map((c) => (
            <div key={c} className="flex items-center gap-2 text-[11px]">
              <Check className="size-3 text-success" strokeWidth={3} />
              {c}
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-[11px] shadow-card">
            <Globe className="size-3 text-muted-foreground" />
            <span className="truncate font-mono">support-desk.architect.app</span>
            <Rocket className="ml-auto size-3 text-brand-text" />
          </div>
        </div>
      </Step>
    </div>
  );
}

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="bg-dots border-b border-border p-5">
        <div className="mx-auto max-w-[220px]">{children}</div>
      </div>
      <div className="p-5">
        <p className="font-mono text-xs text-brand-text">{n}</p>
        <h3 className="mt-1.5 text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
