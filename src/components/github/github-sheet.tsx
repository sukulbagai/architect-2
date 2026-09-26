"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CloudCheck,
  CloudUpload,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Loader2,
  Plus,
  Unlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { useNow } from "@/hooks/use-now";
import { prBlocked, prDraft, reposFor, slugForRepo, switchBlocked, validRepoName, type PullRequest, type Repo } from "@/lib/sim/github";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GithubGlyph } from "@/components/auth/brand-icons";
import type { Workspace } from "@/components/workspace/use-workspace";
import { RepoList } from "./repo-list";
import { ShaChip, SimulatedLink, Visibility } from "./github-bits";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GithubSheet({
  ws,
  isPro,
  open,
  onOpenChange,
  onConnect,
}: {
  ws: Workspace;
  isPro: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the connect dialog. */
  onConnect: () => void;
}) {
  const repo = ws.repo;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]"
        // Focus the panel itself, not its first button, so the repo link's tooltip doesn't pop up.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <SheetHeader className="border-b border-border px-4 py-3.5">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <GithubGlyph className="size-4" />
            GitHub
          </SheetTitle>
          {repo ? (
            <SheetDescription asChild>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="truncate font-medium text-foreground">
                  {repo.owner}/{repo.name}
                </span>
                <Visibility isPrivate={repo.private} />
                <SimulatedLink text={repo.url} />
              </div>
            </SheetDescription>
          ) : (
            <SheetDescription className="text-xs">Keep this project in a repository you own. Every version becomes a commit.</SheetDescription>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {!ws.githubLogin && !repo ? (
            <ConnectPrompt onConnect={onConnect} />
          ) : !repo ? (
            <LinkForm ws={ws} key={open ? "open" : "closed"} />
          ) : (
            <LinkedView ws={ws} isPro={isPro} onConnect={onConnect} onUnlinked={() => onOpenChange(false)} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="p-4">
      <div className="rounded-xl border border-border bg-card p-5 text-center shadow-card">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-foreground text-background">
          <GithubGlyph className="size-5" />
        </span>
        <p className="mt-3 text-sm font-medium">Connect GitHub first</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Then create a repository for this project, or link one you already have.</p>
        <Button className="mt-4" onClick={onConnect}>
          <GithubGlyph className="size-3.5" />
          Connect GitHub
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Linking

type Step = { label: string; state: "active" | "done" };

function Progress({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5 text-sm">
          {s.state === "done" ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-3" strokeWidth={3} />
            </span>
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full border border-brand text-brand-text">
              <Loader2 className="size-3 animate-spin" />
            </span>
          )}
          <span className={cn(s.state === "active" && "font-medium")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function LinkForm({ ws }: { ws: Workspace }) {
  const login = ws.githubLogin!;
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [name, setName] = useState(() => slugForRepo(ws.project.slug.replace(/-[a-z0-9]{4}$/, "")));
  const [description, setDescription] = useState(ws.plan?.tagline ?? "");
  const [isPrivate, setPrivate] = useState(true);
  const [error, setError] = useState<{ text: string; suggestion?: string } | null>(null);
  const [picked, setPicked] = useState<Repo | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const files = Object.keys(ws.currentVersion?.files ?? {}).length;

  async function run(first: string, push: string | null, work: () => ReturnType<Workspace["linkRepo"]>) {
    setError(null);
    setSteps([{ label: first, state: "active" }]);
    const started = Date.now();
    const res = await work().catch(() => ({ ok: false as const, error: "Something went wrong. Please try again.", suggestion: undefined }));
    await wait(Math.max(0, 800 - (Date.now() - started)));
    if (!res.ok) {
      setSteps(null);
      setError({ text: res.error, suggestion: "suggestion" in res ? res.suggestion : undefined });
      return;
    }
    if (push) {
      setSteps([{ label: first, state: "done" }, { label: push, state: "active" }]);
      await wait(900);
    }
    setSteps([{ label: first, state: "done" }, ...(push ? [{ label: push, state: "done" as const }] : []), { label: "Done", state: "done" }]);
    await wait(700);
    res.adopt();
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const bad = validRepoName(name.trim());
    if (bad) {
      setError({ text: bad });
      return;
    }
    const n = name.trim();
    void run(`Creating ${login}/${n}`, files ? `Pushing ${files} files` : null, () => ws.linkRepo({ mode: "create", name: n, private: isPrivate, description: description.trim() || undefined }));
  }

  if (steps) return <div className="p-4">{<Progress steps={steps} />}</div>;

  return (
    <div className="space-y-4 p-4">
      <div role="radiogroup" aria-label="Repository" className="grid grid-cols-2 rounded-lg bg-muted/60 p-0.5">
        {(
          [
            ["create", "New repository"],
            ["existing", "Existing repository"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => {
              setMode(id);
              setError(null);
              setPicked(null);
            }}
            className={cn("h-7 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", mode === id && "bg-card text-foreground shadow-card dark:bg-accent")}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gh-name">Repository name</Label>
            <div className={cn("flex h-9 items-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40", error && "border-destructive")}>
              <span className="shrink-0 pl-3 font-mono text-xs text-muted-foreground">{login} /</span>
              <input
                id="gh-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                maxLength={100}
                aria-invalid={!!error}
                aria-describedby={error ? "gh-name-error" : undefined}
                className="h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-sm outline-none"
              />
            </div>
            {error && (
              <p id="gh-name-error" className="flex flex-wrap items-center gap-x-2 text-xs text-destructive" role="alert">
                {error.text}
                {error.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(error.suggestion!);
                      setError(null);
                    }}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Use {error.suggestion}
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-desc">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="gh-desc" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} className="bg-background" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Visibility</legend>
            <div role="radiogroup" aria-label="Visibility" className="mt-2 grid gap-2">
              {(
                [
                  [true, "Private", "Only you and people you invite can see it."],
                  [false, "Public", "Anyone on the internet can see the code."],
                ] as const
              ).map(([value, label, note]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={isPrivate === value}
                  onClick={() => setPrivate(value)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-[border-color,box-shadow]",
                    isPrivate === value ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", isPrivate === value ? "border-foreground" : "border-border-strong")}>
                    {isPrivate === value && <span className="size-2 rounded-full bg-foreground" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{note}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="w-full">
            Create repository
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            {files ? `Pushes the current version (${files} files) as the first commit.` : "The first build is pushed as the first commit."}
          </p>
        </form>
      ) : picked ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="flex items-center gap-2 text-sm font-medium">
              {picked.fullName}
              <Visibility isPrivate={picked.private} />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{picked.description}</p>
            <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
              This repo already has code. Architect pushes your project to a new branch, <span className="font-mono">architect/…</span>, and leaves {picked.defaultBranch} as it is. Merge it with a pull request when you&apos;re ready.
            </p>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error.text}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPicked(null)}>
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => void run(`Linking ${picked.fullName}`, files ? `Pushing ${files} files to a new branch` : null, () => ws.linkRepo({ mode: "existing", name: picked.name }))}
            >
              Link and push
            </Button>
          </div>
        </div>
      ) : (
        <RepoList repos={reposFor(login)} onPick={setPicked} action="Link" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// A linked repository

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-4 first:border-t-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="annotation">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LinkedView({ ws, isPro, onConnect, onUnlinked }: { ws: Workspace; isPro: boolean; onConnect: () => void; onUnlinked: () => void }) {
  const repo = ws.repo!;
  const git = ws.git!;
  const now = useNow();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const connected = !!ws.githubLogin;
  const byId = new Map(ws.versions.map((v) => [v.id, v]));
  const history = [...(repo.branches[repo.branch]?.commits ?? [])].reverse();
  const pushedSet = new Set((repo.branches[repo.branch]?.commits ?? []).slice(0, repo.branches[repo.branch]?.pushed ?? 0));
  const busy = ws.pushing || !!ws.thinking;

  let status: React.ReactNode;
  let action: React.ReactNode = null;
  if (ws.pushing) {
    status = (
      <span className="flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin text-brand-text" />
        Pushing…
      </span>
    );
  } else if (git.behind) {
    status = <span className="text-info">1 new commit on GitHub</span>;
    action = (
      <Button size="sm" onClick={() => void ws.pullRepo()} disabled={busy || !connected}>
        <ArrowDownToLine />
        Pull
      </Button>
    );
  } else if (!git.published) {
    status = <span className="text-warning">Not on GitHub yet</span>;
    action = (
      <Button size="sm" onClick={() => void ws.pushRepo()} disabled={busy || !connected}>
        <ArrowUpFromLine />
        Publish branch
      </Button>
    );
  } else if (git.ahead) {
    status = (
      <span className="text-warning">
        {git.ahead} {git.ahead === 1 ? "commit" : "commits"} to push
      </span>
    );
    action = (
      <Button size="sm" onClick={() => void ws.pushRepo()} disabled={busy || !connected}>
        <ArrowUpFromLine />
        Push
      </Button>
    );
  } else {
    status = (
      <span className="text-success" suppressHydrationWarning>
        Up to date{git.pushedAt && now ? ` · pushed ${timeAgo(git.pushedAt, now)}` : ""}
      </span>
    );
  }

  return (
    <div>
      {!connected && (
        <div className="flex items-center gap-3 border-b border-warning/25 bg-warning-soft px-4 py-2.5 text-xs text-warning">
          <span className="min-w-0 flex-1">GitHub is disconnected. Reconnect to push and pull; your versions are all still here.</span>
          <Button size="xs" variant="outline" onClick={onConnect}>
            Reconnect
          </Button>
        </div>
      )}

      <Section title="Sync">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-mono text-[13px] font-medium">
                <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{repo.branch}</span>
              </p>
              <p className="mt-0.5 text-xs">{status}</p>
            </div>
            {action}
          </div>
          <div className="mt-3 flex items-start justify-between gap-4 border-t border-border pt-3">
            <div className="min-w-0">
              <Label htmlFor="gh-auto" className="text-sm font-medium">
                Auto-commit
              </Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {repo.autoCommit ? "Every change is pushed to GitHub as soon as it's saved." : "Changes wait here until you push, so you can group them."}
              </p>
            </div>
            <Switch id="gh-auto" checked={repo.autoCommit} disabled={!connected} onCheckedChange={(v) => void ws.setAutoCommit(v)} className="mt-0.5" />
          </div>
        </div>
        {isPro && git.onDefault && !git.behind && connected && (
          <button type="button" onClick={() => void ws.simulateTeammate()} className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Simulate a teammate pushing to {repo.defaultBranch}
          </button>
        )}
      </Section>

      <Section title={`History on ${repo.branch}`}>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No commits yet. The first build is pushed as the first commit.</p>
        ) : (
          <ol className="space-y-1">
            {history.slice(0, 8).map((id) => {
              const v = byId.get(id);
              const pushed = pushedSet.has(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-md px-1 py-1 text-xs">
                  {pushed ? (
                    <CloudCheck className="size-3.5 shrink-0 text-muted-foreground" aria-label="Pushed" />
                  ) : (
                    <CloudUpload className="size-3.5 shrink-0 text-warning" aria-label="Not pushed yet" />
                  )}
                  <ShaChip versionId={id} />
                  <span className="min-w-0 flex-1 truncate">{ws.commitSubjects[id] ?? v?.summary ?? "Commit"}</span>
                  {v && now && (
                    <span className="shrink-0 text-[11px] text-subtle-foreground" suppressHydrationWarning>
                      {timeAgo(v.createdAt, now)}
                    </span>
                  )}
                </li>
              );
            })}
            {history.length > 8 && <li className="px-1 text-[11px] text-muted-foreground">and {history.length - 8} earlier</li>}
          </ol>
        )}
      </Section>

      {isPro ? (
        <>
          <Branches ws={ws} disabled={!connected} />
          <PullRequests ws={ws} disabled={!connected} />
        </>
      ) : (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Branches and pull requests are in Pro. Switch from the top bar any time.</p>
      )}

      <div className="border-t border-border px-4 py-4">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmUnlink(true)}>
          <Unlink />
          Unlink repository
        </Button>
      </div>

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {repo.owner}/{repo.name}?</AlertDialogTitle>
            <AlertDialogDescription>New versions stop syncing. Nothing on GitHub is deleted, and every version stays in this project.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                onUnlinked();
                void ws.unlinkRepo();
              }}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Branches({ ws, disabled }: { ws: Workspace; disabled: boolean }) {
  const repo = ws.repo!;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("feature/");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const names = Object.keys(repo.branches).sort((a, b) => (a === repo.defaultBranch ? -1 : b === repo.defaultBranch ? 1 : a.localeCompare(b)));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    try {
      const res = await ws.newBranch(name.trim());
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAdding(false);
      setName("feature/");
      setError(null);
    } catch {
      setError("Couldn't create the branch. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Branches"
      action={
        !adding && (
          <Button size="xs" variant="ghost" disabled={disabled || !ws.currentVersionId} onClick={() => setAdding(true)}>
            <Plus />
            New branch
          </Button>
        )
      }
    >
      {adding && (
        <form onSubmit={create} className="mb-3 rounded-lg border border-border bg-card p-3">
          <Label htmlFor="gh-branch" className="text-xs">
            From v{ws.currentVersion?.number} on {repo.branch}
          </Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id="gh-branch"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-invalid={!!error}
              className="h-8 bg-background font-mono text-[13px]"
              maxLength={80}
            />
            <Button type="submit" size="sm" className="h-8" disabled={busy === "new"}>
              {busy === "new" && <Loader2 className="animate-spin" />}
              Create
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" className="size-8" aria-label="Cancel" onClick={() => setAdding(false)}>
              <X />
            </Button>
          </div>
          {error && (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {names.map((n) => {
          const b = repo.branches[n];
          const current = n === repo.branch;
          const blocked = switchBlocked(repo, n);
          const ahead = b.commits.length - b.pushed;
          const pr = repo.prs.find((p) => p.from === n && p.status === "open");
          return (
            <li key={n} className="flex items-center gap-2 px-3 py-2">
              <GitBranch className={cn("size-3.5 shrink-0", current ? "text-brand-text" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12.5px]">{n}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {b.remoteOnly ? "On GitHub only" : !b.published ? "Not pushed yet" : ahead ? `${ahead} to push` : "Pushed"}
                  {pr && ` · PR #${pr.number}`}
                  {n === repo.defaultBranch && " · default"}
                </span>
              </span>
              {current ? (
                <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-text">Current</span>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  disabled={disabled || !!blocked || !!busy}
                  title={blocked ?? undefined}
                  onClick={async () => {
                    setBusy(n);
                    await ws.switchBranch(n);
                    setBusy(null);
                  }}
                >
                  {busy === n && <Loader2 className="animate-spin" />}
                  Switch
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function PullRequests({ ws, disabled }: { ws: Workspace; disabled: boolean }) {
  const repo = ws.repo!;
  const blocked = prBlocked(repo);
  const [form, setForm] = useState<{ title: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function start() {
    setForm(prDraft(repo, ws.commitSubjects));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy("open");
    try {
      const res = await ws.openPr(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setForm(null);
    } catch {
      setError("Couldn't open the pull request. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const ahead = repo.branch === repo.defaultBranch ? 0 : (repo.branches[repo.branch]?.commits ?? []).filter((c) => !(repo.branches[repo.defaultBranch]?.commits ?? []).includes(c)).length;

  return (
    <Section
      title="Pull requests"
      action={
        !form &&
        !blocked && (
          <Button size="xs" variant="ghost" disabled={disabled} onClick={start}>
            <GitPullRequest />
            Open pull request
          </Button>
        )
      }
    >
      {form ? (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-lg border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
            <GitPullRequest className="size-3.5" />
            {repo.branch} → {repo.defaultBranch} · {ahead} {ahead === 1 ? "commit" : "commits"}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pr-title" className="text-xs">
              Title
            </Label>
            <Input id="pr-title" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-body" className="text-xs">
              Description
            </Label>
            <textarea
              id="pr-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={4}
              className="block w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy === "open" || !form.title.trim()}>
              {busy === "open" && <Loader2 className="animate-spin" />}
              Create pull request
            </Button>
          </div>
          {repo.branches[repo.branch] && repo.branches[repo.branch].pushed < repo.branches[repo.branch].commits.length && (
            <p className="text-[11px] text-muted-foreground">The branch is pushed first, so the pull request has your latest commits.</p>
          )}
        </form>
      ) : (
        blocked && repo.prs.length === 0 && <p className="text-xs text-muted-foreground">{blocked}</p>
      )}
      {repo.prs.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {repo.prs.map((pr) => (
            <PrRow
              key={pr.number}
              pr={pr}
              url={`${repo.url}/pull/${pr.number}`}
              busy={busy === `pr-${pr.number}`}
              disabled={disabled || !!busy}
              onMerge={async () => {
                setBusy(`pr-${pr.number}`);
                await ws.mergePr(pr.number);
                setBusy(null);
              }}
              onClose={async () => {
                setBusy(`pr-${pr.number}`);
                await ws.closePr(pr.number);
                setBusy(null);
              }}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function PrRow({ pr, url, busy, disabled, onMerge, onClose }: { pr: PullRequest; url: string; busy: boolean; disabled: boolean; onMerge: () => void; onClose: () => void }) {
  const Icon = pr.status === "merged" ? GitMerge : pr.status === "closed" ? GitPullRequestClosed : GitPullRequest;
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-3.5 shrink-0", pr.status === "open" ? "text-success" : pr.status === "merged" ? "text-info" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm">
            <span className="truncate font-medium">{pr.title}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">#{pr.number}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-1.5 py-px font-medium",
                pr.status === "open" ? "bg-success-soft text-success" : pr.status === "merged" ? "bg-info-soft text-info" : "bg-muted text-muted-foreground",
              )}
            >
              {pr.status === "open" ? "Open" : pr.status === "merged" ? "Merged" : "Closed"}
            </span>
            <span className="font-mono">
              {pr.from} → {pr.to}
            </span>
            <span>
              · {pr.commits} {pr.commits === 1 ? "commit" : "commits"}
            </span>
          </p>
          <SimulatedLink text={url} className="mt-1" />
        </div>
      </div>
      {pr.status === "open" && (
        <div className="mt-2 flex justify-end gap-1.5">
          <Button size="xs" variant="ghost" disabled={disabled} onClick={onClose}>
            Close
          </Button>
          <Button size="xs" disabled={disabled} onClick={onMerge}>
            {busy ? <Loader2 className="animate-spin" /> : <GitMerge />}
            Merge
          </Button>
        </div>
      )}
    </li>
  );
}
