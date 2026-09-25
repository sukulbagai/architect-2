"use client";

import { useMemo } from "react";
import { diffLines } from "diff";
import { cn } from "@/lib/utils";

type Line = { kind: "add" | "del" | "ctx" | "gap"; text: string; a?: number; b?: number };

/** A unified diff with three lines of context around each change. */
export function DiffView({ before, after, className }: { before: string; after: string; className?: string }) {
  const lines = useMemo(() => {
    const out: Line[] = [];
    let a = 1;
    let b = 1;
    for (const part of diffLines(before, after)) {
      const rows = part.value.replace(/\n$/, "").split("\n");
      for (const text of rows) {
        if (part.added) out.push({ kind: "add", text, b: b++ });
        else if (part.removed) out.push({ kind: "del", text, a: a++ });
        else out.push({ kind: "ctx", text, a: a++, b: b++ });
      }
    }
    const keep = new Set<number>();
    out.forEach((l, i) => {
      if (l.kind !== "ctx") for (let j = Math.max(0, i - 3); j <= Math.min(out.length - 1, i + 3); j++) keep.add(j);
    });
    const collapsed: Line[] = [];
    let skipped = 0;
    out.forEach((l, i) => {
      if (keep.has(i)) {
        if (skipped) collapsed.push({ kind: "gap", text: `${skipped} unchanged lines` });
        skipped = 0;
        collapsed.push(l);
      } else skipped++;
    });
    if (skipped && collapsed.length) collapsed.push({ kind: "gap", text: `${skipped} unchanged lines` });
    return collapsed;
  }, [before, after]);

  if (lines.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">No changes in this file.</p>;

  return (
    <div className={cn("overflow-x-auto font-mono text-[12px] leading-5", className)}>
      {lines.map((l, i) =>
        l.kind === "gap" ? (
          <div key={i} className="border-y border-border bg-muted/50 px-4 py-1 text-[11px] text-muted-foreground">
            ⋯ {l.text}
          </div>
        ) : (
          <div
            key={i}
            className={cn(
              "flex min-w-max",
              l.kind === "add" && "bg-success-soft",
              l.kind === "del" && "bg-danger-soft",
            )}
          >
            <span className="w-10 shrink-0 pr-2 text-right text-subtle-foreground select-none">{l.a ?? ""}</span>
            <span className="w-10 shrink-0 pr-2 text-right text-subtle-foreground select-none">{l.b ?? ""}</span>
            <span
              className={cn(
                "w-5 shrink-0 text-center select-none",
                l.kind === "add" ? "text-success" : l.kind === "del" ? "text-destructive" : "text-subtle-foreground",
              )}
            >
              {l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}
            </span>
            <span className="pr-6 whitespace-pre">{l.text}</span>
          </div>
        ),
      )}
    </div>
  );
}
