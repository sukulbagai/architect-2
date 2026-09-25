"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  History,
  Inbox,
  LayoutDashboard,
  Library,
  List,
  ListChecks,
  Loader2,
  MessageSquare,
  PenLine,
  Receipt,
  Scale,
  Settings,
  Sparkles,
  Swords,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { hashString } from "@/lib/seeded";
import type { PlanAgent, PlanField, Row } from "@/lib/sim/types";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  inbox: Inbox,
  "pen-line": PenLine,
  settings: Settings,
  sparkles: Sparkles,
  users: Users,
  calendar: Calendar,
  "list-checks": ListChecks,
  history: History,
  "message-square": MessageSquare,
  library: Library,
  swords: Swords,
  scale: Scale,
  receipt: Receipt,
  list: List,
};

export function PageIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? List;
  return <Icon className={className} aria-hidden="true" />;
}

const TONES: Record<string, "danger" | "success" | "warning" | "info" | "neutral"> = {};
for (const w of ["urgent", "high", "overdue", "exception", "blocked", "rejected", "stale", "unanswered", "missing receipt", "needs a fix"]) TONES[w] = "danger";
for (const w of ["done", "paid", "sent", "mastered", "ok", "indexed", "clean", "answered", "published", "offer", "meeting", "replied", "low", "approved"]) TONES[w] = "success";
for (const w of ["in progress", "review", "needs review", "learning", "medium", "drafting", "syncing", "screened", "contacted", "scheduled", "on hold", "draft"]) TONES[w] = "warning";
for (const w of ["new", "open", "normal", "interview", "researched", "idea", "planned", "active", "researching", "final"]) TONES[w] = "info";

export function toneFor(value: string) {
  return TONES[value.toLowerCase()] ?? "neutral";
}

export function Pill({ value }: { value: string }) {
  if (!value) return <span className="a-muted">—</span>;
  return (
    <span className="a-pill" data-tone={toneFor(value)}>
      {value}
    </span>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const hue = hashString(name) % 360;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="a-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, "--h": hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

const money = (currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });

export function formatValue(field: PlanField, value: string | number | undefined) {
  if (value === undefined || value === "") return "—";
  if (field.type === "money") return money(field.currency).format(Number(value));
  if (field.type === "date") {
    const d = new Date(String(value) + "T12:00:00");
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (field.type === "number") return Number(value).toLocaleString("en-US");
  return String(value);
}

export function FieldValue({ field, row }: { field: PlanField; row: Row }) {
  const value = row[field.key];
  if (field.type === "status") return <Pill value={String(value ?? "")} />;
  if (field.type === "person" && value) {
    return (
      <span className="inline-flex items-center gap-2">
        <Avatar name={String(value)} size={20} />
        <span className="truncate">{String(value)}</span>
      </span>
    );
  }
  if (field.type === "tag" && value) return <span className="a-tag">{String(value)}</span>;
  if (field.type === "number" && /mastery|score/i.test(field.key) && typeof value === "number") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="a-meter">
          <span style={{ width: `${Math.min(100, Number(value))}%` }} />
        </span>
        <span className="tabular-nums">{value}</span>
      </span>
    );
  }
  return <span className={field.type === "money" || field.type === "number" ? "tabular-nums" : undefined}>{formatValue(field, value)}</span>;
}

/** Reveals text progressively, like a streamed model response. */
export function useTyping(text: string, active: boolean) {
  const [shown, setShown] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(text.length, i + Math.max(2, Math.round(text.length / 90)));
      setShown(i);
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, active]);
  return { text: text.slice(0, shown), done: shown >= text.length };
}

/** An agent run: a short "thinking" trace, then the answer typed out. */
export function AgentAnswer({ agent, sample, runKey }: { agent: PlanAgent; sample: number; runKey: number }) {
  const [phase, setPhase] = useState<"trace" | "answer">("trace");
  const text = agent.samples[sample % agent.samples.length] ?? "Done.";
  const typed = useTyping(text, phase === "answer");

  useEffect(() => {
    const t = setTimeout(() => setPhase("answer"), 900);
    return () => clearTimeout(t);
  }, [runKey]);

  return (
    <div className="space-y-2.5">
      <div className="a-trace">
        {phase === "trace" ? <Loader2 className="size-3 animate-spin" /> : <Wrench className="size-3" />}
        <span>{agent.name}</span>
        <span className="a-muted">· {phase === "trace" ? "thinking…" : agent.trace ?? "done"}</span>
      </div>
      {phase === "answer" && (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
          {typed.text}
          {!typed.done && <span className="a-caret" />}
        </p>
      )}
    </div>
  );
}
