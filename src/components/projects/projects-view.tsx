"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus, LayoutGrid, List, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { stackLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { ProjectThumb } from "@/components/common/project-thumb";
import { StatusBadge } from "@/components/common/status-badge";
import { ProjectCard, type ProjectSummary } from "@/components/projects/project-card";
import { ProjectMenu } from "@/components/projects/project-menu";
import type { ProjectStatus } from "@/db/schema";
import { layoutForTemplate } from "@/lib/templates";

type Filter = "all" | ProjectStatus;
type Sort = "updated" | "created" | "name";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "live", label: "Live" },
  { id: "error", label: "Needs a fix" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "updated", label: "Last edited" },
  { id: "created", label: "Newest" },
  { id: "name", label: "Name" },
];

const VIEW_KEY = "architect:projects-view";

export function ProjectsView({ projects, isPro }: { projects: ProjectSummary[]; isPro: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-browser preference
      if (stored === "list" || stored === "grid") setView(stored);
    } catch {}
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: projects.length, draft: 0, building: 0, live: 0, error: 0 };
    for (const p of projects) c[p.status]++;
    return c;
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => filter === "all" || p.status === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "created") return +new Date(b.createdAt) - +new Date(a.createdAt);
        return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      });
  }, [projects, query, filter, sort]);

  if (projects.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        icon={<FolderPlus />}
        title="No projects yet"
        description="Describe an app on Home, start from a template, or import a GitHub repo. Everything you build lands here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Link href="/home?new=1">Describe your first app</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/import">Import a repo</Link>
            </Button>
          </div>
        }
      />
    );
  }

  function changeView(v: string) {
    if (v !== "grid" && v !== "list") return;
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                filter === f.id && "bg-muted font-medium text-foreground",
              )}
            >
              {f.label}
              <span className="font-mono text-[11px] text-subtle-foreground">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64 md:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-8 bg-card pr-8 pl-8"
            />
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 bg-card">
                {SORTS.find((s) => s.id === sort)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
                {SORTS.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={changeView}
            variant="outline"
            className="bg-card"
            aria-label="Layout"
          >
            <ToggleGroupItem value="grid" aria-label="Grid" className="h-8 px-2.5">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List" className="h-8 px-2.5">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<SearchX />}
          title="Nothing matches"
          description={query ? `No projects match “${query}”.` : "No projects have this status yet."}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} showStack={isPro} />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr className="annotation">
                <th className="px-4 py-2.5 font-normal">Name</th>
                <th className="hidden px-4 py-2.5 font-normal sm:table-cell">Status</th>
                {isPro && <th className="hidden px-4 py-2.5 font-normal md:table-cell">Stack</th>}
                <th className="hidden px-4 py-2.5 font-normal md:table-cell">Started from</th>
                <th className="px-4 py-2.5 font-normal">Edited</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/p/${p.id}`)}
                  className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                        <ProjectThumb seed={p.id} layout={layoutForTemplate(p.templateId)} />
                      </div>
                      <Link
                        href={`/p/${p.id}`}
                        className="truncate font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">
                    <StatusBadge status={p.status} />
                  </td>
                  {isPro && (
                    <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {stackLabel(p.stack)}
                    </td>
                  )}
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {p.source === "prompt" ? "Prompt" : p.source === "template" ? "Template" : "Import"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{timeAgo(p.updatedAt)}</td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <ProjectMenu id={p.id} name={p.name} className="text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
