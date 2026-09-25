"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, GitCommitHorizontal, GitCompare, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { EmptyState } from "@/components/common/empty-state";
import type { ProposalData } from "@/lib/sim/types";
import { DiffView } from "./diff-view";
import type { Workspace } from "./use-workspace";

const LETTER = { added: "A", modified: "M", deleted: "D" } as const;
const LETTER_TONE = { added: "text-success", modified: "text-warning", deleted: "text-destructive" } as const;

function isTyping(el: Element | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function ReviewPanel({ ws }: { ws: Workspace }) {
  const proposal = ws.pendingProposal;
  if (!proposal) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-lg bg-background/70"
          icon={<GitCompare />}
          title="Nothing to review"
          description="With diff review on, each change you ask for waits here as a diff until you accept it."
          action={
            <Button variant="outline" onClick={() => ws.setTab("preview")}>
              Back to the preview
            </Button>
          }
        />
      </div>
    );
  }
  return <Review key={proposal.id} ws={ws} id={proposal.id} data={proposal.data} />;
}

function Review({ ws, id, data }: { ws: Workspace; id: string; data: ProposalData }) {
  const files = data.files;
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState(0);
  const [commit, setCommit] = useState(data.commit);
  const [busy, setBusy] = useState<"accept" | "discard" | null>(null);
  const selected = files[Math.min(cursor, files.length - 1)];
  const included = files.filter((f) => !skipped[f.path]);
  const stale = ws.currentVersionId !== data.baseVersionId;
  const totals = useMemo(
    () => included.reduce((t, f) => ({ added: t.added + f.added, removed: t.removed + f.removed }), { added: 0, removed: 0 }),
    [included],
  );

  async function accept() {
    if (busy || stale || included.length === 0 || !commit.trim()) return;
    setBusy("accept");
    const ok = await ws.acceptProposal(
      id,
      included.map((f) => f.path),
      commit.trim(),
    );
    if (!ok) setBusy(null);
  }

  async function discard() {
    if (busy) return;
    setBusy("discard");
    await ws.discardProposal(id);
  }

  const toggle = (path: string) => setSkipped((s) => ({ ...s, [path]: !s[path] }));

  // j / k move between files, x includes or leaves one out, ⌘↵ accepts (even from the commit box).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void accept();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement) || document.querySelector("[role=dialog]")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(files.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "x" && selected) {
        e.preventDefault();
        toggle(selected.path);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="annotation">Proposed change · not applied yet</p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-tight">{data.title}</h2>
          </div>
          <p className="shrink-0 font-mono text-xs text-muted-foreground sm:pt-4">
            {included.length} of {files.length} files · <span className="text-success">+{totals.added}</span> <span className="text-destructive">−{totals.removed}</span>
          </p>
        </div>
        {data.changes.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.changes.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Check className="size-3 text-success" />
                {c}
              </li>
            ))}
          </ul>
        )}
        {stale && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            The app changed since this was proposed. Discard it and ask again, and I&apos;ll redo it against the latest version.
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-border bg-sidebar p-1.5 scrollbar-thin md:max-h-none md:w-72 md:border-r md:border-b-0">
          <p className="annotation flex items-center justify-between px-2 py-1.5">
            Files
            <span className="hidden items-center gap-1 normal-case md:flex">
              <Kbd className="h-4 min-w-4 font-mono text-[10px]">j</Kbd>
              <Kbd className="h-4 min-w-4 font-mono text-[10px]">k</Kbd>
              <Kbd className="h-4 min-w-4 font-mono text-[10px]">x</Kbd>
            </span>
          </p>
          <ul role="listbox" aria-label="Changed files" className="space-y-0.5">
            {files.map((f, i) => {
              const on = !skipped[f.path];
              const active = i === cursor;
              return (
                <li key={f.path} role="option" aria-selected={active} className={cn("flex items-center gap-2 rounded-md pr-2 pl-1.5", active ? "bg-muted" : "hover:bg-muted/60")}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(f.path)}
                    aria-label={`Include ${f.path}`}
                    className="size-3.5 shrink-0 accent-[var(--foreground)]"
                  />
                  <button type="button" onClick={() => setCursor(i)} className="flex h-8 min-w-0 flex-1 items-center gap-2 text-left">
                    <span className={cn("w-3 shrink-0 font-mono text-[11px] font-semibold", LETTER_TONE[f.status])}>{LETTER[f.status]}</span>
                    <span className={cn("min-w-0 flex-1 truncate font-mono text-[12px]", !on && "text-subtle-foreground line-through")} title={f.path}>
                      {f.path.split("/").pop()}
                      <span className="text-subtle-foreground"> {f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ""}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px]">
                      <span className="text-success">+{f.added}</span> <span className="text-destructive">−{f.removed}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected && (
            <>
              <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
                <span className="truncate font-mono text-xs text-muted-foreground">{selected.path}</span>
                <Button size="xs" variant="ghost" onClick={() => toggle(selected.path)} className="shrink-0">
                  {skipped[selected.path] ? <Check /> : <X />}
                  {skipped[selected.path] ? "Include this file" : "Leave this file out"}
                </Button>
              </div>
              <div className={cn("min-h-0 flex-1 overflow-auto bg-card py-2 scrollbar-thin", skipped[selected.path] && "opacity-50")}>
                <DiffView before={selected.before ?? ""} after={selected.after ?? ""} />
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="shrink-0 border-t border-border bg-card px-3 py-3 md:px-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label htmlFor="commit-message" className="sr-only">
            Commit message
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-ring">
            <GitCommitHorizontal className="size-4 shrink-0 text-muted-foreground" />
            <input
              id="commit-message"
              value={commit}
              onChange={(e) => setCommit(e.target.value)}
              maxLength={200}
              className="h-9 min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none"
              placeholder="Describe the change"
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <Button variant="outline" onClick={() => void discard()} disabled={!!busy}>
              {busy === "discard" && <Loader2 className="animate-spin" />}
              Discard
            </Button>
            <Button
              onClick={() => void accept()}
              disabled={!!busy || stale || included.length === 0 || !commit.trim()}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
              aria-keyshortcuts="Meta+Enter"
            >
              {busy === "accept" ? <Loader2 className="animate-spin" /> : <Check />}
              {included.length === files.length ? "Accept all" : `Accept ${included.length} of ${files.length}`}
              <Kbd className="ml-0.5 hidden bg-brand-foreground/15 font-mono text-[10px] text-brand-foreground md:inline-flex">⌘↵</Kbd>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
