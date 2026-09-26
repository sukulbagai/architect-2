"use client";

import { useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { updatedLabel, type Repo } from "@/lib/sim/github";
import { LanguageDot, Visibility } from "./github-bits";

/**
 * A searchable list of the account's repositories. Rows that can't be picked stay visible, dimmed,
 * with the reason, so nobody wonders where a repo went.
 */
export function RepoList({
  repos,
  onPick,
  disabled,
  action = "Import",
  className,
}: {
  repos: Repo[];
  onPick: (repo: Repo) => void;
  /** Returns why a repo can't be picked, or null. */
  disabled?: (repo: Repo) => string | null;
  action?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = repos.filter((r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.framework.toLowerCase().includes(q));

  return (
    <div className={className}>
      <label className="relative block">
        <span className="sr-only">Search repositories</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repositories"
          className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </label>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-label="Repositories">
        {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No repositories match “{query}”.</li>}
        {shown.map((r) => {
          const reason = disabled?.(r) ?? null;
          return (
            <li key={r.name}>
              <button
                type="button"
                disabled={!!reason}
                onClick={() => onPick(r)}
                aria-label={reason ? `${r.name}: ${reason}` : `${action} ${r.fullName}`}
                className={cn(
                  "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  reason ? "cursor-not-allowed" : "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
                )}
              >
                <div className={cn("min-w-0 flex-1", reason && "opacity-55")}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    <Visibility isPrivate={r.private} />
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{r.description}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <LanguageDot language={r.language} />
                    <span>{r.framework}</span>
                    {r.stars > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="size-3" />
                        {r.stars}
                      </span>
                    )}
                    <span>{updatedLabel(r.updatedHoursAgo)}</span>
                  </p>
                  {reason && <p className="mt-1.5 text-xs text-warning">{reason}</p>}
                </div>
                {!reason && (
                  <span className="hidden shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground sm:inline-flex">
                    {action}
                    <ChevronRight className="size-3.5" />
                  </span>
                )}
                {!reason && <ChevronRight className="size-4 shrink-0 text-muted-foreground sm:hidden" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
