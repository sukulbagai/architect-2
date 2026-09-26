"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Workspace } from "@/components/workspace/use-workspace";

type Tone = "success" | "warning" | "info" | "muted";

const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  muted: "bg-border-strong",
};

/** "Short" drops the time on small screens, so the chip never pushes Deploy off the bar. */
function chipState(ws: Workspace, now: number | null): { label: string; short: string; tone: Tone | null; tip: string; spinning?: boolean } {
  const repo = ws.repo;
  const git = ws.git;
  if (!repo || !git) {
    if (!ws.githubLogin) return { label: "Connect GitHub", short: "GitHub", tone: null, tip: "Connect GitHub to keep this project in a repository" };
    return { label: "Link repository", short: "Link", tone: null, tip: "Create a repository for this project, or link one" };
  }
  if (!ws.githubLogin) return { label: "Reconnect GitHub", short: "Reconnect", tone: "warning", tip: `GitHub is disconnected. Reconnect to sync ${repo.owner}/${repo.name}` };
  if (ws.pushing) return { label: "Pushing…", short: "Pushing…", tone: null, tip: `Pushing to origin/${repo.branch}`, spinning: true };
  if (git.behind) return { label: `${repo.branch} · ${git.behind} to pull`, short: `${git.behind} to pull`, tone: "info", tip: "A teammate pushed a change. Pull to get it." };
  if (!git.published) return { label: `${repo.branch} · not pushed`, short: "Not pushed", tone: "warning", tip: "This branch isn't on GitHub yet" };
  if (git.ahead) return { label: `${repo.branch} · ${git.ahead} to push`, short: `${git.ahead} to push`, tone: "warning", tip: `${git.ahead} ${git.ahead === 1 ? "commit is" : "commits are"} waiting to be pushed` };
  const when = git.pushedAt && now ? timeAgo(git.pushedAt, now).replace(/^(\d+) minutes? ago$/, "$1m ago").replace(/^(\d+) hours? ago$/, "$1h ago") : null;
  return { label: `${repo.branch} · synced${when ? ` ${when}` : ""}`, short: "Synced", tone: "success", tip: `In sync with ${repo.owner}/${repo.name}` };
}

export function SyncChip({ ws, onClick }: { ws: Workspace; onClick: () => void }) {
  const now = useNow();
  const s = chipState(ws, now);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`GitHub: ${s.label}`}
          className="inline-flex h-7 max-w-56 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <GithubGlyph className="size-3.5 shrink-0 text-foreground" />
          {s.spinning ? <Loader2 className="size-3 shrink-0 animate-spin text-brand-text" /> : s.tone && <span className={cn("size-1.5 shrink-0 rounded-full", DOT[s.tone])} />}
          <span className="hidden truncate lg:inline" suppressHydrationWarning>
            {s.label}
          </span>
          <span className="truncate lg:hidden">{s.short}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{s.tip}</TooltipContent>
    </Tooltip>
  );
}
