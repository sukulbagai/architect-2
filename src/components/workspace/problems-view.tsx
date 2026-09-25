"use client";

import { CheckCircle2, CircleX, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "./use-workspace";

export function ProblemsView({ ws }: { ws: Workspace }) {
  if (ws.issues.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-sunken text-sm text-muted-foreground">
        <CheckCircle2 className="size-5 text-success" />
        No problems. Nice.
      </div>
    );
  }
  return (
    <ul className="h-full divide-y divide-border overflow-y-auto bg-sunken scrollbar-thin">
      {ws.issues.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          {i.severity === "error" ? <CircleX className="size-4 shrink-0 text-destructive" /> : <TriangleAlert className="size-4 shrink-0 text-warning" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{i.plain}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">{i.title}</span>
          </span>
          <button
            type="button"
            onClick={() => ws.openCode(i.file, i.line)}
            className="hidden shrink-0 font-mono text-xs text-info underline-offset-2 hover:underline sm:block"
          >
            {i.file}:{i.line}
          </button>
          <Button size="xs" variant="outline" onClick={() => void ws.fixIssue(i.id)} disabled={!!ws.thinking}>
            <Wrench />
            Fix it
          </Button>
        </li>
      ))}
    </ul>
  );
}
