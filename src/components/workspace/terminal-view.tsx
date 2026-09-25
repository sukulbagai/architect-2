"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pagePath } from "@/lib/sim/codegen";
import { complete, prompt, runCommand, type TermContext, type TermLine, type Tone } from "@/lib/sim/terminal";
import type { Workspace } from "./use-workspace";

const TONE: Record<Tone, string> = {
  muted: "text-muted-foreground",
  error: "text-destructive",
  success: "text-success",
  accent: "text-code-function",
  warning: "text-warning",
  info: "text-info",
  strong: "font-semibold text-foreground",
};

type Entry = TermLine & { id: number };
let seq = 0;

/** A scripted shell over the current version's files. Output streams line by line. */
export function TerminalView({ ws, user, active }: { ws: Workspace; user: string; active: boolean }) {
  const [lines, setLines] = useState<Entry[]>(() => [
    { id: ++seq, segs: [{ text: "Architect demo shell", tone: "strong" }, { text: ` · ~/${ws.project.slug}`, tone: "muted" }] },
    { id: ++seq, segs: [{ text: "A scripted terminal that reads this project's real files. Type ", tone: "muted" }, { text: "help", tone: "accent" }, { text: " to see what it can do.", tone: "muted" }] },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const ctx: TermContext = useMemo(() => {
    const plan = ws.plan;
    return {
      files: ws.currentVersion?.files ?? {},
      pages: (plan?.pages ?? []).map((p) => ({ id: p.id, name: p.name, file: pagePath(plan!, p, ws.project.stack) })),
      issues: ws.issues,
      versions: ws.versions.map((v) => ({ id: v.id, number: v.number, summary: v.summary, current: v.id === ws.currentVersionId })),
      projectName: ws.project.name,
      slug: ws.project.slug,
      user,
      stack: ws.project.stack,
      cwd,
    };
  }, [ws.plan, ws.currentVersion, ws.issues, ws.versions, ws.currentVersionId, ws.project, user, cwd]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);
  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  const echo = (text: string): Entry => ({
    id: ++seq,
    segs: [
      { text: prompt(ctx), tone: "info" },
      { text: " (main) ", tone: "muted" },
      { text: "$ ", tone: "muted" },
      { text },
    ],
  });

  function execute(raw: string) {
    const text = raw.trim();
    setInput("");
    setCursor(null);
    if (text) setHistory((h) => (h[h.length - 1] === text ? h : [...h, text]));
    const res = runCommand(text, ctx);
    if (res.clear) {
      setLines([]);
      return;
    }
    setLines((l) => [...l, echo(raw)]);
    if (res.cwd !== undefined) setCwd(res.cwd);
    // Output streams in (about 15 ms a line, plus any pause a command takes).
    let t = 0;
    const out = res.lines;
    if (out.length === 0) return;
    const slow = out.some((l) => l.wait);
    if (!slow && out.length > 60) {
      setLines((l) => [...l, ...out.map((x) => ({ ...x, id: ++seq }))]);
      return;
    }
    setRunning(true);
    out.forEach((line, i) => {
      t += 15 + (line.wait ?? 0);
      timers.current.push(
        setTimeout(() => {
          setLines((l) => [...l, { ...line, id: ++seq }]);
          if (i === out.length - 1) {
            setRunning(false);
            inputRef.current?.focus({ preventScroll: true });
          }
        }, t),
      );
    });
  }

  function interrupt() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunning(false);
    setLines((l) => [...l, { id: ++seq, segs: [{ text: "^C", tone: "muted" }] }]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      if (running) interrupt();
      else {
        setLines((l) => [...l, echo(`${input}^C`)]);
        setInput("");
      }
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (running) return;
    if (e.key === "Enter") {
      e.preventDefault();
      execute(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
      setCursor(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === null) return;
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(null);
        setInput("");
      } else {
        setCursor(next);
        setInput(history[next]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const res = complete(input, ctx);
      setInput(res.value);
      if (res.options.length) {
        setLines((l) => [...l, echo(input), { id: ++seq, segs: res.options.flatMap((o) => [{ text: o, tone: o.endsWith("/") ? ("accent" as Tone) : undefined }, { text: "   " }]) }]);
      }
    }
  }

  return (
    <div
      ref={scroller}
      className="h-full overflow-y-auto bg-sunken px-3 py-2 font-mono text-[12px] leading-[1.6] scrollbar-thin"
      onMouseUp={() => {
        if (!window.getSelection()?.toString()) inputRef.current?.focus({ preventScroll: true });
      }}
    >
      {lines.map((l) => (
        <div key={l.id} className="min-h-[1.6em] break-words whitespace-pre-wrap">
          {l.segs.map((s, i) => (
            <span key={i} className={s.tone ? TONE[s.tone] : undefined}>
              {s.text}
            </span>
          ))}
        </div>
      ))}
      <div className={cn("flex items-center", running && "opacity-0")}>
        <span className="shrink-0 whitespace-pre">
          <span className="text-info">{prompt(ctx)}</span>
          <span className="text-muted-foreground"> (main) $ </span>
        </span>
        <label htmlFor="terminal-input" className="sr-only">
          Terminal command
        </label>
        <input
          id="terminal-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent caret-brand-text outline-none"
        />
      </div>
    </div>
  );
}
