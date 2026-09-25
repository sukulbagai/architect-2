"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentEntry, agentFiles } from "@/lib/sim/agent-code";
import { frameworkOf } from "@/lib/sim/frameworks";
import type { PlanAgent } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";

const CodeEditor = dynamic(() => import("@/components/workspace/code-editor"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/40" />,
});

/**
 * The generated source for an agent in its framework, read-only and live: it changes as the
 * editor changes. "Open in Code tab" appears once the saved version has the file.
 */
export function AgentCode({
  agent,
  context,
  onOpenCode,
  canOpen,
}: {
  agent: PlanAgent;
  context: { appName: string; agents: PlanAgent[] };
  onOpenCode?: (path: string) => void;
  canOpen?: (path: string) => boolean;
}) {
  const files = agentFiles(agent, context);
  const paths = Object.keys(files).filter((p) => !p.endsWith(".gitkeep"));
  const entry = agentEntry(agent);
  const [picked, setPicked] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const path = picked && files[picked] !== undefined ? picked : paths.includes(entry) ? entry : paths[0];
  const f = frameworkOf(agent.framework);

  function copy() {
    void navigator.clipboard?.writeText(files[path] ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FileCode2 className="size-3.5 shrink-0 text-code-function" />
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label={`${f.label} files`}>
          {paths.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === path}
              onClick={() => setPicked(p)}
              className={cn(
                "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
                p === path && "bg-muted text-foreground",
              )}
              title={p}
            >
              {paths.length > 1 ? p.split("/").slice(2).join("/") || p : p}
            </button>
          ))}
        </div>
        <Button size="icon-xs" variant="ghost" aria-label="Copy code" onClick={copy} className="text-muted-foreground">
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
        {onOpenCode && (
          <Button size="xs" variant="ghost" disabled={!canOpen?.(path)} onClick={() => onOpenCode(path)} title={canOpen?.(path) ? undefined : "Save first: the Code tab shows the saved version"}>
            Open in Code tab
          </Button>
        )}
      </div>
      <div className="h-72 overflow-hidden">
        <CodeEditor path={path} value={files[path] ?? ""} readOnly />
      </div>
    </div>
  );
}
