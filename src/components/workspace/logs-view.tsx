"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { BuildSummary } from "@/lib/sim/types";
import type { LogLevel, LogLine, Workspace } from "./use-workspace";

const LEVELS: ("all" | LogLevel)[] = ["all", "info", "warn", "error"];
const LEVEL_TONE: Record<LogLevel, string> = { info: "text-info", warn: "text-warning", error: "text-destructive" };

/** The latest build, told as log lines, so the Logs tab is never empty after a build. */
function buildLog(ws: Workspace): LogLine[] {
  const m = [...ws.messages].reverse().find((x) => x.kind === "build");
  if (!m) return [];
  const b = m.data as BuildSummary;
  const end = new Date(m.createdAt).getTime();
  const start = end - b.seconds * 1000;
  const at = (f: number) => Math.round(start + (end - start) * f);
  const lines: [number, LogLevel, string][] = [
    [0, "info", `build v${b.version} started · ${b.pages.length} pages, ${b.agents.length} agents, ${b.tables.length} tables`],
    [0.12, "info", `agents: created ${b.agents.join(", ")}`],
    [0.3, "info", `data: created ${b.tables.join(", ").toLowerCase()} with sample rows`],
    [0.72, "info", `ui: wrote ${b.files} files`],
    [0.8, "info", "test: opened the app in a browser"],
    ...(b.issue
      ? ([
          [0.86, "warn", `test: found ${b.issue.found.charAt(0).toLowerCase()}${b.issue.found.slice(1)}`],
          [0.93, "info", `test: fixed it (${b.issue.fix.toLowerCase()})`],
        ] as [number, LogLevel, string][])
      : []),
    [1, "info", `build v${b.version} ready in ${b.seconds}s · ${b.credits} credits`],
  ];
  return lines.map(([f, level, message], i) => ({ id: -1000 - i, at: at(f), level, source: "build", message }));
}

function time(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LogsView({ ws, active }: { ws: Workspace; active: boolean }) {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [follow, setFollow] = useState(true);
  const [clearedAt, setClearedAt] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const all = useMemo(
    () => [...buildLog(ws), ...ws.logs].filter((l) => l.at > clearedAt).sort((a, b) => a.at - b.at || a.id - b.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when messages or runtime logs change
    [ws.messages, ws.logs, clearedAt],
  );
  const shown = level === "all" ? all : all.filter((l) => l.level === level);
  const counts = { warn: all.filter((l) => l.level === "warn").length, error: all.filter((l) => l.level === "error").length };

  // Lines arrive while this tab is hidden too, so catch up when it's shown.
  useEffect(() => {
    if (follow && active) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [shown.length, follow, active]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <div role="radiogroup" aria-label="Level" className="flex items-center rounded-md bg-muted/70 p-0.5">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={cn("h-6 rounded px-2 text-[11px] font-medium text-muted-foreground capitalize hover:text-foreground", level === l && "bg-card text-foreground shadow-card dark:bg-accent")}
            >
              {l}
              {l !== "all" && l !== "info" && counts[l] > 0 && <span className={cn("ml-1 tabular-nums", LEVEL_TONE[l])}>{counts[l]}</span>}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            aria-pressed={follow}
            onClick={() => setFollow((f) => !f)}
            className={cn("text-muted-foreground", follow && "bg-muted text-foreground")}
          >
            <ArrowDownToLine />
            Follow
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setClearedAt(Date.now());
              ws.clearLogs();
            }}
          >
            <Trash2 />
            Clear
          </Button>
        </span>
      </div>
      <div
        ref={scroller}
        onWheel={() => {
          const el = scroller.current;
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 40) setFollow(false);
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-sunken py-1.5 font-mono text-[11.5px] leading-[1.7] scrollbar-thin"
      >
        {shown.length === 0 ? (
          <p className="px-3 py-6 text-center font-sans text-xs text-muted-foreground">
            {all.length === 0 ? "No logs yet. Use the app in the preview (open a page, run an agent) and its requests show up here." : "Nothing at this level."}
          </p>
        ) : (
          shown.map((l) => (
            <div key={l.id} className="flex gap-3 px-3 hover:bg-muted/50">
              <span className="shrink-0 text-subtle-foreground tabular-nums">{time(l.at)}</span>
              <span className={cn("w-10 shrink-0 uppercase", LEVEL_TONE[l.level])}>{l.level}</span>
              <span className="w-10 shrink-0 text-subtle-foreground">{l.source}</span>
              <span className={cn("min-w-0 break-words", l.level === "error" && "text-destructive")}>{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
