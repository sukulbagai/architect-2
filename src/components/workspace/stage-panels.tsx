"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CloudCheck, CloudUpload, Database, Eye, GitBranch, History, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { stackLabel } from "@/lib/constants";
import { fileChanges } from "@/lib/sim/script";
import { deleteProject, renameProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/empty-state";
import { ProjectThumb } from "@/components/common/project-thumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatValue } from "@/components/preview/bits";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { ShaChip, SimulatedLink, Visibility } from "@/components/github/github-bits";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlanField, Row } from "@/lib/sim/types";
import { DiffView } from "./diff-view";
import type { Workspace } from "./use-workspace";

// ---------------------------------------------------------------------------------------------
// Versions

export function VersionsPanel({ ws, isPro }: { ws: Workspace; isPro: boolean }) {
  // Linked to a repo, the history is the current branch's commits; otherwise every version.
  const list = [...ws.branchVersions].reverse();
  const branch = ws.repo?.branches[ws.repo.branch];
  const pushed = new Set(branch ? branch.commits.slice(0, branch.pushed) : []);
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null);
  const [file, setFile] = useState<Record<string, string>>({});

  if (list.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-lg bg-background/70"
          icon={<History />}
          title="No versions yet"
          description="Every build and every change you ask for is saved as a version. You can preview or restore any of them."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {ws.repo && (
        <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <GitBranch className="size-3.5" />
          <span>
            On <span className="font-mono text-foreground">{ws.repo.branch}</span> · {list.length} {list.length === 1 ? "commit" : "commits"}
          </span>
          {ws.git && ws.git.ahead > 0 && (
            <span className="text-warning">
              · {ws.git.ahead} not pushed yet
            </span>
          )}
        </p>
      )}
      <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-border">
        {list.map((v, i) => {
          const prev = list[i + 1];
          const current = v.id === ws.currentVersionId;
          const changes = isPro && prev ? fileChanges(prev.files, v.files) : [];
          const expanded = open === v.id;
          const selected = file[v.id] ?? changes[0]?.path;
          return (
            <li key={v.id} className="relative pl-10">
              <span
                className={cn(
                  "absolute top-3 left-1.5 flex size-5 items-center justify-center rounded-full border-2 bg-background",
                  current ? "border-brand" : "border-border-strong",
                )}
              >
                {current && <span className="size-2 rounded-full bg-brand" />}
              </span>
              <div className={cn("overflow-hidden rounded-xl border bg-card shadow-card", current ? "border-border-strong" : "border-border")}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {!isPro && (
                    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-border">
                      <ProjectThumb seed={`${ws.project.id}-${v.plan?.ui.theme ?? ""}-${v.plan?.pages.length ?? 0}`} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="font-mono text-xs text-muted-foreground">v{v.number}</span>
                      <span className="truncate">{v.summary}</span>
                      {current && <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-text">Current</span>}
                    </p>
                    {ws.repo && (
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <ShaChip versionId={v.id} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" tabIndex={0}>
                              {pushed.has(v.id) ? <CloudCheck className="size-3.5" /> : <CloudUpload className="size-3.5 text-warning" />}
                              {pushed.has(v.id) ? "Pushed" : "Local"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{pushed.has(v.id) ? `On GitHub in ${ws.repo.owner}/${ws.repo.name}` : "Only in Architect until you push"}</TooltipContent>
                        </Tooltip>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(v.createdAt)}
                      {isPro && prev && ` · ${changes.length} ${changes.length === 1 ? "file" : "files"} changed`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        ws.setPreviewVersionId(current ? null : v.id);
                        ws.setTab("preview");
                      }}
                    >
                      <Eye />
                      Preview
                    </Button>
                    {!current && (
                      <Button size="xs" variant="outline" onClick={() => void ws.restore(v.id)}>
                        <RotateCcw />
                        Restore
                      </Button>
                    )}
                    {isPro && prev && (
                      <Button size="icon-xs" variant="ghost" aria-label="Show changes" onClick={() => setOpen(expanded ? null : v.id)}>
                        <ChevronDown className={cn("transition-transform", expanded && "rotate-180")} />
                      </Button>
                    )}
                  </div>
                </div>
                {isPro && expanded && prev && (
                  <div className="border-t border-border">
                    <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 scrollbar-thin">
                      {changes.map((c) => (
                        <button
                          key={c.path}
                          type="button"
                          onClick={() => setFile((f) => ({ ...f, [v.id]: c.path }))}
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted",
                            selected === c.path && "bg-muted text-foreground",
                          )}
                        >
                          {c.path.split("/").pop()} <span className="text-success">+{c.added}</span> <span className="text-destructive">−{c.removed}</span>
                        </button>
                      ))}
                    </div>
                    {selected && <DiffView className="max-h-80 overflow-y-auto py-2" before={prev.files[selected] ?? ""} after={v.files[selected] ?? ""} />}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Data

export function DataPanel({ ws, isPro }: { ws: Workspace; isPro: boolean }) {
  const data = ws.plan?.data ?? [];
  const [active, setActive] = useState(0);
  const [view, setView] = useState<"rows" | "schema">("rows");
  const c = data[Math.min(active, data.length - 1)];
  if (!c) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState className="w-full max-w-lg bg-background/70" icon={<Database />} title="No data yet" description="Tables come from the plan. Once they exist you can browse rows here." />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {data.map((d, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn("h-8 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground", i === active && "bg-muted font-medium text-foreground")}
            >
              {d.name}
              <span className="ml-1.5 font-mono text-[11px] text-subtle-foreground">{d.rows.length}</span>
            </button>
          ))}
        </div>
        {isPro && (
          <div className="flex rounded-lg bg-muted/70 p-0.5">
            {(["rows", "schema"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn("h-7 rounded-md px-2.5 text-xs text-muted-foreground capitalize", view === v && "bg-card text-foreground shadow-card dark:bg-accent")}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>
      {view === "schema" && isPro ? (
        <pre className="overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-[12px] leading-6 shadow-card">
          <span className="text-code-keyword">table</span> <span className="text-code-type">{c.id}</span> {"{\n"}
          {"  "}id <span className="text-code-type">text</span> <span className="text-code-comment">primary key</span>
          {"\n"}
          {c.fields.map((f) => (
            <span key={f.key}>
              {"  "}
              {f.key} <span className="text-code-type">{f.type === "money" ? "numeric(12,2)" : f.type === "number" ? "integer" : f.type === "date" ? "date" : "text"}</span>
              {f.type === "status" && <span className="text-code-comment"> -- {Array.from(new Set(c.rows.map((r) => String(r[f.key])))).join(" | ")}</span>}
              {"\n"}
            </span>
          ))}
          {"}"}
        </pre>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                {c.fields.map((f) => (
                  <th key={f.key} className="annotation px-3 py-2.5 text-left font-normal whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {c.fields.map((f) => (
                    <td key={f.key} className="max-w-60 truncate px-3 py-2 whitespace-nowrap">
                      <DataCell field={f} row={r} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Sample rows from the generated app. Editing them and the SQL console are out of scope for this build.</p>
    </div>
  );
}

function DataCell({ field, row }: { field: PlanField; row: Row }) {
  const value = row[field.key];
  if (field.type === "status") return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{String(value ?? "")}</span>;
  return <span className={field.type === "money" || field.type === "number" ? "tabular-nums" : undefined}>{formatValue(field, value)}</span>;
}

// ---------------------------------------------------------------------------------------------
// Settings

export function SettingsPanel({ ws, isPro, onOpenGithub, onConnectGithub }: { ws: Workspace; isPro: boolean; onOpenGithub: () => void; onConnectGithub: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(ws.project.name);
  const [pending, startTransition] = useTransition();
  const created = useMemo(() => ws.versions[0]?.createdAt, [ws.versions]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold">Project</h3>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              await renameProject(ws.project.id, name);
              ws.setProject((p) => ({ ...p, name }));
              toast.success("Project renamed");
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ps-name">Name</Label>
            <div className="flex gap-2">
              <Input id="ps-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
              <Button type="submit" variant="outline" disabled={pending || !name.trim() || name === ws.project.name}>
                Save
              </Button>
            </div>
          </div>
        </form>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="annotation">Stack</dt>
            <dd className="mt-1">{stackLabel(ws.project.stack)}</dd>
          </div>
          <div>
            <dt className="annotation">Versions</dt>
            <dd className="mt-1">{ws.versions.length}</dd>
          </div>
          {isPro && (
            <div>
              <dt className="annotation">Project ID</dt>
              <dd className="mt-1 font-mono text-xs">{ws.project.id}</dd>
            </div>
          )}
          {created && (
            <div>
              <dt className="annotation">First built</dt>
              <dd className="mt-1">{timeAgo(created)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          {ws.settings.import?.envVars.length
            ? `${ws.settings.import.envVars.length} environment ${ws.settings.import.envVars.length === 1 ? "variable" : "variables"} came with the import (${ws.settings.import.envVars.join(", ")}). Editing secrets and custom domains are out of scope for this build.`
            : "Editing environment variables and custom domains are out of scope for this build."}
        </p>
      </section>

      <GithubSettings ws={ws} isPro={isPro} onOpen={onOpenGithub} onConnect={onConnectGithub} />

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold">Changes</h3>
        <p className="mt-1 text-sm text-muted-foreground">How Architect applies what you ask for in Build mode.</p>
        <div className="mt-4 divide-y divide-border border-t border-border">
          <SettingRow
            id="ps-test"
            title="Test after each change"
            body="A testing agent checks the app in a browser and fixes what it finds before you see it. Adds a few seconds."
            checked={ws.testAfterChanges}
            onChange={(v) => void ws.updateSettings({ testAfterChanges: v })}
          />
          {isPro && (
            <SettingRow
              id="ps-review"
              title="Review each change as a diff"
              body="Changes wait in a Review tab. Accept all, some or none of the files, with a commit message."
              checked={!!ws.settings.reviewChanges}
              onChange={(v) => void ws.updateSettings({ reviewChanges: v })}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-destructive/30 bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold">Delete this project</h3>
        <p className="mt-1 text-sm text-muted-foreground">Removes the project, its chat, versions and deployments.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              <Trash2 />
              Delete project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{ws.project.name}”?</AlertDialogTitle>
              <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() =>
                  startTransition(async () => {
                    await deleteProject(ws.project.id);
                    router.push("/projects");
                  })
                }
              >
                Delete project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}

function GithubSettings({ ws, isPro, onOpen, onConnect }: { ws: Workspace; isPro: boolean; onOpen: () => void; onConnect: () => void }) {
  const repo = ws.repo;
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <GithubGlyph className="size-4" />
        GitHub
      </h3>
      {!repo ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-sm text-muted-foreground">
            {ws.githubLogin ? `Connected as @${ws.githubLogin}. Link a repository and every version becomes a commit.` : "Keep this project in a repository you own. Every version becomes a commit."}
          </p>
          <Button variant="outline" onClick={ws.githubLogin ? onOpen : onConnect}>
            {ws.githubLogin ? "Link repository" : "Connect GitHub"}
          </Button>
        </div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2 min-w-0">
              <dt className="annotation">Repository</dt>
              <dd className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-medium">
                  {repo.owner}/{repo.name}
                </span>
                <SimulatedLink text={repo.url} />
              </dd>
            </div>
            <div>
              <dt className="annotation">Visibility</dt>
              <dd className="mt-1">
                <Visibility isPrivate={repo.private} />
              </dd>
            </div>
            <div>
              <dt className="annotation">{isPro ? "Default branch" : "Branch"}</dt>
              <dd className="mt-1 font-mono text-xs">{isPro ? repo.defaultBranch : repo.branch}</dd>
            </div>
          </dl>
          {!ws.githubLogin && (
            <p className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              GitHub is disconnected, so nothing syncs until you reconnect.
              <Button size="xs" variant="outline" onClick={onConnect}>
                Reconnect
              </Button>
            </p>
          )}
          <div className="mt-4 divide-y divide-border border-t border-border">
            <SettingRow
              id="ps-auto"
              title="Auto-commit"
              body="Push every change to GitHub as soon as it's saved. Turn it off to group changes and push when you choose."
              checked={repo.autoCommit}
              onChange={(v) => void ws.setAutoCommit(v)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onOpen}>
              Open GitHub panel
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirm(true)}>
              Unlink repository
            </Button>
          </div>
          <AlertDialog open={confirm} onOpenChange={setConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Unlink {repo.owner}/{repo.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>New versions stop syncing. Nothing on GitHub is deleted, and every version stays in this project.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void ws.unlinkRepo()}>
                  Unlink
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  );
}

function SettingRow({ id, title, body, checked, onChange }: { id: string; title: string; body: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}
