"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Check, Copy, Loader2, Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { seededRandom } from "@/lib/seeded";
import { sizePx } from "@/lib/sim/visual";
import type { Plan, PlanAgent, PlanCollection, PlanPage, Row } from "@/lib/sim/types";
import { AgentAnswer, Avatar, FieldValue, Pill, formatValue, logAgentRun, useAppLog, useTyping } from "./bits";
import { useEditable } from "./editable";

/** A card heading that visual edits can rename, restyle or hide. */
function CardTitle({ id, text, className, children }: { id: string; text: string; className?: string; children?: React.ReactNode }) {
  const t = useEditable()(id, text);
  if (t.hidden) return null;
  return (
    <p {...t.attrs} className={className ?? "text-sm font-semibold"} style={{ ...t.style, opacity: t.faded ? 0.4 : undefined }}>
      {children}
      <span data-edit-text="">{t.text || text}</span>
    </p>
  );
}

type Ctx = { plan: Plan; page: PlanPage; collection?: PlanCollection; agent?: PlanAgent };

export function PageBody(ctx: Ctx) {
  switch (ctx.page.kind) {
    case "dashboard":
      return <Dashboard {...ctx} />;
    case "list":
      return <ListPage {...ctx} />;
    case "workbench":
      return <Workbench {...ctx} />;
    case "chat":
      return <ChatPage {...ctx} />;
    case "run":
      return <RunPage {...ctx} />;
    default:
      return <SettingsPage {...ctx} />;
  }
}

// ---------------------------------------------------------------------------------------------

function Dashboard({ plan, page, collection, agent }: Ctx) {
  const rows = useMemo(() => collection?.rows ?? [], [collection]);
  const rnd = seededRandom(plan.appName + page.id);
  const activity = Array.from({ length: 14 }, () => 3 + Math.round(rnd() * 12));
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (collection?.statusField) for (const r of rows) map.set(String(r[collection.statusField]), (map.get(String(r[collection.statusField])) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, collection]);
  const moneyField = collection?.fields.find((f) => f.type === "money");
  const dateField = collection?.fields.find((f) => f.type === "date");
  const tiles: { label: string; value: string; accent?: boolean }[] = [
    { label: `Total ${collection?.name.toLowerCase() ?? "items"}`, value: String(rows.length) },
  ];
  if (statusCounts[0]) tiles.push({ label: statusCounts[0][0], value: String(statusCounts[0][1]), accent: true });
  if (moneyField) tiles.push({ label: `Total ${moneyField.label.toLowerCase()}`, value: formatValue(moneyField, rows.reduce((s, r) => s + Number(r[moneyField.key] ?? 0), 0)) });
  else if (statusCounts[1]) tiles.push({ label: statusCounts[1][0], value: String(statusCounts[1][1]) });
  tiles.push({ label: "Agent runs this week", value: String(40 + rows.length * 7) });
  const [ask, setAsk] = useState("");
  const [run, setRun] = useState(0);
  const ed = useEditable();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => {
          const e = ed(`stat-${page.id}-${i}`, t.label);
          if (e.hidden) return null;
          const tone = e.raw.tone === "accent" || (t.accent && e.raw.tone !== "muted") ? "var(--a-accent)" : e.raw.tone === "muted" ? "var(--a-muted)" : undefined;
          return (
            <div key={t.label} {...e.attrs} className="a-card p-4" style={{ opacity: e.faded ? 0.4 : undefined }}>
              <p className="a-muted text-xs" data-edit-text="">
                {e.text || t.label}
              </p>
              <p className="a-heading mt-1.5 text-2xl font-semibold tabular-nums" style={{ color: tone, fontSize: e.raw.size ? sizePx("stat", e.raw.size) : undefined }}>
                {t.value}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="a-card p-4">
          <CardTitle id={`card-${page.id}-0`} text="Activity, last 14 days" />
          <div className="mt-4 flex h-32 items-end gap-1.5">
            {activity.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-[3px]" style={{ height: `${(v / 15) * 100}%`, background: i === activity.length - 1 ? "var(--a-accent)" : "var(--a-accent-soft)" }} />
            ))}
          </div>
        </div>
        <div className="a-card p-4">
          <CardTitle id={`card-${page.id}-1`} text={`By ${collection?.fields.find((f) => f.key === collection?.statusField)?.label.toLowerCase() ?? "status"}`} />
          <ul className="mt-3 space-y-2.5">
            {statusCounts.map(([s, n]) => (
              <li key={s} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0">
                  <Pill value={s} />
                </span>
                <span className="a-meter flex-1">
                  <span style={{ width: `${(n / rows.length) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="a-card min-w-0 overflow-hidden">
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--a-border)" }}>
            <CardTitle id={`card-${page.id}-2`} text={`Recent ${collection?.name.toLowerCase()}`} />
          </div>
          <ul>
            {rows.slice(0, 4).map((r, i) => (
              <li key={i} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-0" style={{ borderColor: "var(--a-border)" }}>
                <span className="min-w-0 flex-1 truncate">{String(r[collection!.titleField])}</span>
                {collection?.statusField && <Pill value={String(r[collection.statusField])} />}
                {dateField && <span className="a-muted w-14 text-right text-xs">{formatValue(dateField, r[dateField.key])}</span>}
              </li>
            ))}
          </ul>
        </div>
        {agent && (
          <div className="a-card flex min-w-0 flex-col p-4">
            <CardTitle id={`card-${page.id}-3`} text={`Ask ${agent.name}`} className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4" style={{ color: "var(--a-accent)" }} />
            </CardTitle>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setRun((r) => r + 1);
              }}
            >
              <input className="a-input flex-1" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={`e.g. What changed this week?`} />
              <button className="a-btn" type="submit" aria-label="Ask">
                <ArrowUp className="size-4" />
              </button>
            </form>
            <div className="mt-3 min-h-16 flex-1">
              {run > 0 ? <AgentAnswer key={run} agent={agent} sample={run - 1} runKey={run} /> : <p className="a-muted text-xs">{agent.role}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ListPage({ plan, page, collection, agent }: Ctx) {
  const ed = useEditable();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [extra, setExtra] = useState<Row[]>([]);
  const [open, setOpen] = useState<{ row: Row; index: number } | null>(null);
  const [run, setRun] = useState(0);
  if (!collection) return null;
  const rows = [...extra, ...collection.rows];
  const statuses = collection.statusField ? ["All", ...Array.from(new Set(collection.rows.map((r) => String(r[collection.statusField!]))))] : [];
  const visible = rows.filter(
    (r) =>
      (status === "All" || String(r[collection.statusField ?? ""]) === status) &&
      (!query || Object.values(r).some((v) => String(v).toLowerCase().includes(query.toLowerCase()))),
  );
  const cols = collection.fields.slice(0, 6);
  const cta = ed(`cta-${page.id}`, `New ${collection.singular.toLowerCase()}`);

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {plan.ui.search && (
          <label className="a-input flex w-full items-center gap-2 sm:w-64">
            <Search className="a-muted size-3.5 shrink-0" />
            <input className="w-full bg-transparent outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${collection.name.toLowerCase()}`} />
          </label>
        )}
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => (
            <button key={s} type="button" className="a-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
        {!cta.hidden && (
          <button
            type="button"
            {...cta.attrs}
            className="a-btn ml-auto"
            style={{ ...cta.style, opacity: cta.faded ? 0.4 : undefined }}
            onClick={() => {
              const row: Row = {};
              for (const f of collection.fields) row[f.key] = f.key === collection.titleField ? `New ${collection.singular.toLowerCase()}` : f.type === "status" ? String(collection.rows[0]?.[f.key] ?? "New") : "";
              setExtra((e) => [row, ...e]);
            }}
          >
            <Plus className="size-3.5" />
            <span data-edit-text="">{cta.text || `New ${collection.singular.toLowerCase()}`}</span>
          </button>
        )}
      </div>
      <div className="a-card overflow-x-auto">
        <table className="a-table w-full" data-compact={plan.ui.compact ? "true" : undefined}>
          <thead>
            <tr>
              {cols.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr
                key={i}
                onClick={() => {
                  setOpen({ row: r, index: collection.rows.indexOf(r) });
                  setRun((x) => x + 1);
                }}
              >
                {cols.map((f) => (
                  <td key={f.key} className={f.key === collection.titleField ? "font-medium" : undefined}>
                    <FieldValue field={f} row={r} />
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="a-muted py-10 text-center">
                  No {collection.name.toLowerCase()} match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <aside className="a-drawer">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="a-muted text-xs">{collection.singular}</p>
              <h3 className="a-heading text-lg font-semibold">{String(open.row[collection.titleField])}</h3>
            </div>
            <button type="button" className="a-icon-btn" onClick={() => setOpen(null)} aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            {collection.fields.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-4">
                <dt className="a-muted">{f.label}</dt>
                <dd className="text-right">
                  <FieldValue field={f} row={open.row} />
                </dd>
              </div>
            ))}
          </dl>
          {agent && (
            <div className="a-sunken mt-5 p-3.5">
              <AgentAnswer key={run} agent={agent} sample={Math.max(0, open.index)} runKey={run} />
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Workbench({ collection, agent }: Ctx) {
  const rows = collection?.rows ?? [];
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  if (!collection) return null;
  const current = rows[index];

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)] lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav className="a-card min-w-0 overflow-hidden">
        {rows.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIndex(i);
              setRun(0);
            }}
            aria-current={i === index}
            className="a-list-item"
          >
            <span className="block truncate text-sm font-medium">{String(r[collection.titleField])}</span>
            <span className="mt-1 flex items-center gap-2">
              {collection.statusField && <Pill value={approved[i] ? "Approved" : String(r[collection.statusField])} />}
            </span>
          </button>
        ))}
      </nav>
      <section className="a-card min-w-0 p-4">
        <p className="a-muted text-xs">{collection.singular}</p>
        <h3 className="a-heading mt-0.5 text-lg font-semibold">{String(current?.[collection.titleField] ?? "")}</h3>
        <dl className="mt-4 space-y-2.5 text-sm">
          {collection.fields
            .filter((f) => f.key !== collection.titleField)
            .map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-4">
                <dt className="a-muted">{f.label}</dt>
                <dd>{current && <FieldValue field={f} row={current} />}</dd>
              </div>
            ))}
        </dl>
      </section>
      {agent && (
        <section className="a-card flex min-w-0 flex-col p-4 lg:col-span-2 xl:col-span-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4" style={{ color: "var(--a-accent)" }} />
            {agent.name}
          </p>
          <div className="a-sunken mt-3 flex-1 p-3.5">
            <AgentAnswer key={`${index}-${run}`} agent={agent} sample={index + run} runKey={run} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="a-btn" onClick={() => setApproved((a) => ({ ...a, [index]: true }))}>
              {approved[index] ? <Check className="size-3.5" /> : null}
              {approved[index] ? "Approved" : "Approve"}
            </button>
            <button type="button" className="a-btn a-btn-ghost" onClick={() => setRun((x) => x + 1)}>
              <RefreshCw className="size-3.5" />
              Regenerate
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

type ChatMsg = { role: "user" | "agent"; text: string; key: number };

function ChatPage({ plan, agent }: Ctx) {
  const first = plan.data[0];
  const suggestions = [
    first ? `Tell me about ${String(first.rows[0]?.[first.titleField] ?? "the first item")}` : "What can you do?",
    "What should I focus on today?",
    "Summarise this week",
  ];
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [count, setCount] = useState(0);
  if (!agent) return null;

  function send(text: string) {
    if (!text.trim()) return;
    const n = count + 1;
    setCount(n);
    setMessages((m) => [...m, { role: "user", text, key: n * 2 }, { role: "agent", text: "", key: n * 2 + 1 }]);
    setInput("");
  }

  return (
    <div className="a-card mx-auto flex h-[min(620px,calc(100dvh-180px))] max-w-3xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex gap-3">
          <span className="a-bot">
            <Sparkles className="size-3.5" />
          </span>
          <p className="text-[13px] leading-relaxed">
            Hi, I&apos;m {agent.name}. {agent.role}
          </p>
        </div>
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={m.key} className="flex justify-end">
              <p className="a-bubble max-w-[80%] text-[13px]">{m.text}</p>
            </div>
          ) : (
            <div key={m.key} className="flex gap-3">
              <span className="a-bot">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <AgentAnswer agent={agent} sample={Math.floor(i / 2)} runKey={m.key} />
              </div>
            </div>
          ),
        )}
      </div>
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {suggestions.map((s) => (
            <button key={s} type="button" className="a-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t p-3"
        style={{ borderColor: "var(--a-border)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input className="a-input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${agent.name} anything…`} />
        <button type="submit" className="a-btn" aria-label="Send">
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function RunPage({ plan, page, agent }: Ctx) {
  const ed = useEditable();
  const log = useAppLog();
  const [input, setInput] = useState("");
  const [state, setState] = useState<{ step: number; done: boolean } | null>(null);
  const pipeline = plan.agents;
  const final = agent ?? pipeline[pipeline.length - 1];
  const result = final?.samples[0] ?? "";
  const typed = useTyping(result, !!state?.done);
  const [copied, setCopied] = useState(false);

  function start() {
    if (!input.trim()) return;
    setState({ step: 0, done: false });
    pipeline.forEach((a, i) => {
      setTimeout(() => {
        setState({ step: i + 1, done: i + 1 >= pipeline.length });
        logAgentRun(log, a, i + input.length);
      }, 1000 * (i + 1));
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="a-card p-4">
        <label className="text-sm font-semibold" htmlFor="run-input">
          {page.input?.label ?? "Input"}
        </label>
        <textarea
          id="run-input"
          className="a-input mt-2 min-h-24 w-full resize-y py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={page.input?.placeholder}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="a-muted text-xs">
            {pipeline.length} agents: {pipeline.map((a) => a.name).join(" → ")}
          </p>
          {(() => {
            const cta = ed(`cta-${page.id}`, page.input?.cta ?? "Run");
            if (cta.hidden) return null;
            return (
              <button
                type="button"
                {...cta.attrs}
                className="a-btn"
                style={{ ...cta.style, opacity: cta.faded ? 0.4 : undefined }}
                onClick={start}
                disabled={!input.trim() || (state !== null && !state.done)}
              >
                {state && !state.done ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                <span data-edit-text="">{cta.text || page.input?.cta || "Run"}</span>
              </button>
            );
          })()}
        </div>
      </div>

      {state && (
        <div className="a-card p-4">
          <ol className="space-y-2.5">
            {pipeline.map((a, i) => {
              const status = i < state.step ? "done" : i === state.step ? "active" : "todo";
              return (
                <li key={a.id} className="flex items-center gap-3 text-sm" style={{ opacity: status === "todo" ? 0.45 : 1 }}>
                  <span className="a-step" data-status={status}>
                    {status === "done" ? <Check className="size-3" /> : status === "active" ? <Loader2 className="size-3 animate-spin" /> : i + 1}
                  </span>
                  <span className="font-medium">{a.name}</span>
                  <span className="a-muted truncate text-xs">{status === "done" ? a.trace ?? "done" : status === "active" ? "working…" : a.role}</span>
                </li>
              );
            })}
          </ol>
          {state.done && (
            <div className="a-sunken mt-4 p-4">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                {typed.text}
                {!typed.done && <span className="a-caret" />}
              </p>
              {typed.done && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="a-btn a-btn-ghost"
                    onClick={() => {
                      void navigator.clipboard?.writeText(result).catch(() => {});
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {plan.data[0] && <button type="button" className="a-btn">Save to {plan.data[0].name.toLowerCase()}</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function SettingsPage({ plan, page }: Ctx) {
  const [toggles, setToggles] = useState({ digest: true, approvals: true, weekly: false });
  const team = ["Maya Chen", "Omar Haddad", "Lena Fischer"];
  return (
    <div className="max-w-3xl space-y-4">
      <section className="a-card p-4">
        <CardTitle id={`card-${page.id}-0`} text="Connections" />
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--a-border)" }}>
          {(plan.integrations.length ? plan.integrations : ["None yet"]).map((name) => (
            <li key={name} className="flex items-center justify-between py-2.5 text-sm" style={{ borderColor: "var(--a-border)" }}>
              <span className="flex items-center gap-2.5">
                <span className="size-2 rounded-full" style={{ background: plan.integrations.length ? "var(--a-success)" : "var(--a-muted)" }} />
                {name}
              </span>
              {plan.integrations.length > 0 && <span className="a-muted text-xs">Connected</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="a-card p-4">
        <CardTitle id={`card-${page.id}-1`} text="Notifications" />
        <div className="mt-3 space-y-3 text-sm">
          {(
            [
              ["digest", "Email me a daily summary"],
              ["approvals", "Tell me when an agent needs approval"],
              ["weekly", "Send the team a weekly report"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-3">
              {label}
              <button
                type="button"
                role="switch"
                aria-checked={toggles[key]}
                className="a-switch"
                onClick={() => setToggles((t) => ({ ...t, [key]: !t[key] }))}
              >
                <span />
              </button>
            </label>
          ))}
        </div>
      </section>
      <section className="a-card p-4">
        <CardTitle id={`card-${page.id}-2`} text="Team" />
        <ul className="mt-3 space-y-2.5">
          {team.map((n, i) => (
            <li key={n} className="flex items-center gap-3 text-sm">
              <Avatar name={n} size={26} />
              <span className="flex-1">{n}</span>
              <span className="a-muted text-xs">{i === 0 ? "Owner" : "Editor"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
