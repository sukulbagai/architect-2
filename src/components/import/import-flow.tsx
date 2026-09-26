"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, FileArchive, GitBranch, Link2, Loader2, ServerCog, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { importRepository } from "@/lib/actions/github";
import {
  SCAN_MS,
  demoValue,
  envHelp,
  parseGitUrl,
  reposFor,
  resolveImport,
  scanSteps,
  type ImportSource,
  type ResolvedImport,
} from "@/lib/sim/github";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { ConnectGithubDialog } from "@/components/github/connect-github-dialog";
import { RepoList } from "@/components/github/repo-list";
import { LanguageDot, Visibility } from "@/components/github/github-bits";

type Tab = "github" | "url" | "zip";
type Step = "source" | "branch" | "scan" | "env" | "ready";
type Picked = { source: ImportSource; resolved: ResolvedImport };

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "github", label: "GitHub", icon: GithubGlyph },
  { id: "url", label: "Git URL", icon: Link2 },
  { id: "zip", label: "ZIP", icon: FileArchive },
];

const MAX_ZIP = 500 * 1024 * 1024;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ImportFlow({ login: initialLogin, name, isPro, initialRepo, initialTab }: { login: string | null; name: string; isPro: boolean; initialRepo: string | null; initialTab: Tab | null }) {
  const router = useRouter();
  const [login, setLogin] = useState(initialLogin);
  // A deep link (/import?repo=support-bot) starts on that repo's branch step.
  const [picked, setPicked] = useState<Picked | null>(() => {
    if (!initialRepo || !initialLogin) return null;
    const source: ImportSource = { kind: "github", repo: initialRepo };
    const resolved = resolveImport(source, initialLogin);
    return "error" in resolved || !resolved.profile.importable ? null : { source, resolved };
  });
  const [step, setStep] = useState<Step>(picked ? "branch" : "source");
  const [tab, setTab] = useState<Tab>(initialTab ?? "github");
  const [branch, setBranch] = useState<string | null>(picked?.resolved.defaultBranch ?? null);
  const [scanned, setScanned] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [env, setEnv] = useState<Record<string, string>>({});
  const [envChoice, setEnvChoice] = useState<"saved" | "skipped" | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [opening, setOpening] = useState<string[] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const profile = picked?.resolved.profile;
  const hasBranch = !!picked && picked.resolved.branches.length > 0;
  const needsEnv = !!profile && profile.envVars.length > 0;
  const steps: { id: Step; label: string }[] = [
    { id: "source", label: "Source" },
    ...(!picked || hasBranch ? [{ id: "branch" as Step, label: "Branch" }] : []),
    { id: "scan", label: "Analysis" },
    ...(!picked || needsEnv ? [{ id: "env" as Step, label: "Environment" }] : []),
  ];
  const index = step === "ready" ? steps.length : steps.findIndex((s) => s.id === step);

  function choose(p: Picked) {
    setPicked(p);
    setEnv({});
    setEnvChoice(null);
    if (p.resolved.branches.length) {
      setBranch(p.resolved.defaultBranch);
      setStep("branch");
    } else {
      setBranch(null);
      scan(p, null);
    }
  }

  function scan(p: Picked, b: string | null) {
    timers.current.forEach(clearTimeout);
    setStep("scan");
    setScanned(0);
    setScanDone(false);
    const lines = scanSteps(p.resolved, b);
    timers.current = [
      ...lines.map((l, i) => setTimeout(() => setScanned(i + 1), l.at + 60)),
      setTimeout(() => setScanDone(true), SCAN_MS),
    ];
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setPicked(null);
    setStep("source");
    setScanDone(false);
  }

  async function open() {
    if (!picked) return;
    const files = picked.resolved.profile.files;
    const labels = ["Creating the project", `Writing ${files} files`, "Opening the Workspace"];
    setOpening([labels[0]]);
    const started = Date.now();
    try {
      const values = envChoice === "saved" ? Object.fromEntries(Object.entries(env).filter(([, v]) => v.trim())) : {};
      const work = importRepository({ source: picked.source, branch, env: values, uiMode: isPro ? "pro" : "simple" });
      await wait(450);
      setOpening(labels.slice(0, 2));
      const res = await work;
      if (!res.ok) {
        setOpening(null);
        toast.error("Couldn't import it", { description: res.error });
        return;
      }
      await wait(Math.max(0, 900 - (Date.now() - started)));
      setOpening(labels);
      router.push(`/p/${res.id}`);
    } catch {
      setOpening(null);
      toast.error("Couldn't import it", { description: "Please try again." });
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Projects
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Import a project</h1>
      <p className="mt-1 max-w-xl text-sm text-pretty text-muted-foreground">
        Bring code you already have. Architect reads it, tells you what it found, and opens it in a Workspace where you can keep building.
      </p>

      <ol className="mt-6 flex flex-wrap items-center gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 text-xs", i < index ? "text-muted-foreground" : i === index ? "font-medium" : "text-subtle-foreground")} aria-current={i === index ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full font-mono text-[9px]",
                  i < index ? "bg-foreground text-background" : i === index ? "bg-brand text-brand-foreground" : "border border-border-strong",
                )}
              >
                {i < index ? <Check className="size-2.5" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-5 bg-border sm:w-6" />}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === "source" && (
          <SourceStep
            tab={tab}
            setTab={setTab}
            login={login}
            onConnect={() => setConnectOpen(true)}
            onPick={choose}
          />
        )}
        {step === "branch" && picked && (
          <BranchStep picked={picked} branch={branch ?? picked.resolved.defaultBranch} setBranch={setBranch} onBack={reset} onScan={() => scan(picked, branch)} />
        )}
        {step === "scan" && picked && (
          <ScanStep
            picked={picked}
            branch={branch}
            scanned={scanned}
            done={scanDone}
            opening={opening}
            onBack={reset}
            onContinue={() => setStep("env")}
            onOpen={() => void open()}
          />
        )}
        {step === "env" && picked && (
          <EnvStep
            picked={picked}
            env={env}
            setEnv={setEnv}
            onBack={() => setStep("scan")}
            onDone={(choice) => {
              setEnvChoice(choice);
              setStep("ready");
            }}
          />
        )}
        {step === "ready" && picked && <ReadyStep picked={picked} branch={branch} env={env} choice={envChoice} opening={opening} onBack={() => setStep("env")} onOpen={() => void open()} />}
      </div>

      {step === "source" && (
        <p className="mt-4 text-center text-xs text-pretty text-muted-foreground">
          Built this in Lovable, v0 or Bolt? Export it to GitHub first, then import it here.
        </p>
      )}

      <ConnectGithubDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        name={name}
        onConnected={({ login: l }) => {
          setLogin(l);
          setTab("github");
          router.refresh();
        }}
      />
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card md:p-6", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------------------------

function SourceStep({ tab, setTab, login, onConnect, onPick }: { tab: Tab; setTab: (t: Tab) => void; login: string | null; onConnect: () => void; onPick: (p: Picked) => void }) {
  return (
    <Card className="p-0 md:p-0">
      <div role="tablist" aria-label="Import from" className="flex gap-1 border-b border-border p-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`import-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`import-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex-none sm:px-3.5",
              tab === id && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`import-panel-${tab}`} aria-labelledby={`import-tab-${tab}`} className="p-5 md:p-6">
        {tab === "github" && (login ? <GithubTab login={login} onPick={onPick} /> : <ConnectCard onConnect={onConnect} />)}
        {tab === "url" && <UrlTab login={login} onPick={onPick} />}
        {tab === "zip" && <ZipTab onPick={onPick} />}
      </div>
    </Card>
  );
}

function ConnectCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-foreground text-background">
        <GithubGlyph className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">Connect GitHub to see your repositories</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Pick one, choose a branch, and Architect scans it. Your project stays linked, so changes sync back.</p>
      <Button className="mt-5" onClick={onConnect}>
        <GithubGlyph className="size-3.5" />
        Connect GitHub
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">Or paste a Git URL, or upload a ZIP, from the tabs above.</p>
    </div>
  );
}

function GithubTab({ login, onPick }: { login: string; onPick: (p: Picked) => void }) {
  const repos = reposFor(login);
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <GithubGlyph className="size-3.5 text-foreground" />
        <span className="font-mono text-foreground">@{login}</span>· {repos.length} repositories
      </p>
      <RepoList
        repos={repos}
        disabled={(r) => (r.profile.importable ? null : r.profile.reason ?? "This repository can't be imported.")}
        onPick={(r) => {
          const source: ImportSource = { kind: "github", repo: r.name };
          const resolved = resolveImport(source, login);
          if (!("error" in resolved)) onPick({ source, resolved });
        }}
      />
    </div>
  );
}

function UrlTab({ login, onPick }: { login: string | null; onPick: (p: Picked) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseGitUrl(url);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    const source: ImportSource = { kind: "url", url: url.trim() };
    const resolved = resolveImport(source, login);
    if ("error" in resolved) {
      setError(resolved.error);
      return;
    }
    if (!resolved.profile.importable) {
      setError(resolved.profile.reason ?? "This repository can't be imported.");
      return;
    }
    onPick({ source, resolved });
  }
  return (
    <form onSubmit={submit} noValidate>
      <Label htmlFor="import-url">Repository URL</Label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id="import-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://github.com/owner/repo"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "import-url-error" : "import-url-hint"}
          className={cn(
            "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 font-mono sm:flex-1 text-[13px] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
            error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          )}
        />
        <Button type="submit" className="h-9" disabled={!url.trim()}>
          Continue
          <ArrowRight />
        </Button>
      </div>
      {error ? (
        <p id="import-url-error" className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p id="import-url-hint" className="mt-2 text-xs text-muted-foreground">
          HTTPS or SSH, like git@github.com:owner/repo.git. {login ? `Your own repos (github.com/${login}/…) scan in full; ` : ""}Others are read as a small React app in this demo.
        </p>
      )}
    </form>
  );
}

function ZipTab({ onPick }: { onPick: (p: Picked) => void }) {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function take(f: File | undefined) {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) {
      setError(`${f.name} isn't a ZIP. Compress the project folder first, then drop the .zip here.`);
      return;
    }
    if (f.size > MAX_ZIP) {
      setError(`${f.name} is ${formatBytes(f.size)}. The limit is ${formatBytes(MAX_ZIP)}; leave out node_modules and build folders.`);
      return;
    }
    setError(null);
    setFile({ name: f.name, size: f.size });
  }

  return (
    <div>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileArchive className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Remove file" onClick={() => setFile(null)}>
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center rounded-xl border border-dashed border-border-strong bg-background px-6 py-10 text-center transition-colors hover:border-foreground/30",
            over && "border-brand bg-brand-soft/40",
          )}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="mt-3 text-sm font-medium">Drop a .zip here, or choose a file</span>
          <span className="mt-1 text-xs text-muted-foreground">Up to {formatBytes(MAX_ZIP)}. Leave out node_modules.</span>
        </button>
      )}
      <input ref={input} type="file" accept=".zip,application/zip" className="sr-only" tabIndex={-1} aria-label="Choose a ZIP file" onChange={(e) => take(e.target.files?.[0])} />
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        In this demo only the file&apos;s name and size are used. Its contents never leave your computer.
      </p>
      {file && (
        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => {
              const source: ImportSource = { kind: "zip", name: file.name, size: file.size };
              const resolved = resolveImport(source, null);
              if (!("error" in resolved)) onPick({ source, resolved });
            }}
          >
            Scan the ZIP
            <ArrowRight />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

/** The repo at the top of a step. With `branch` (after the scan) the language line gives way to the scan's chips. */
function RepoHeader({ picked, branch }: { picked: Picked; branch?: string | null }) {
  const r = picked.resolved;
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
        {picked.source.kind === "zip" ? <FileArchive className="size-5" /> : <GithubGlyph className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-base font-semibold tracking-tight">{r.fullName}</span>
          {r.owner && <Visibility isPrivate={r.private} />}
          {branch && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              <GitBranch className="size-3" />
              {branch}
            </span>
          )}
        </p>
        {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
        {r.repo && branch === undefined && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <LanguageDot language={r.repo.language} />
            <span>{r.repo.framework}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function BranchStep({ picked, branch, setBranch, onBack, onScan }: { picked: Picked; branch: string; setBranch: (b: string) => void; onBack: () => void; onScan: () => void }) {
  const r = picked.resolved;
  return (
    <Card>
      <RepoHeader picked={picked} />
      <div className="mt-6 space-y-1.5">
        <Label htmlFor="import-branch">Branch</Label>
        <div className="relative max-w-xs">
          <GitBranch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <select
            id="import-branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-9 w-full appearance-none rounded-lg border border-input bg-background pr-8 pl-8 font-mono text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {r.branches.map((b) => (
              <option key={b} value={b}>
                {b}
                {b === r.defaultBranch ? " (default)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          {r.branches.length === 1 ? "This repo has one branch." : `${r.branches.length} branches. The project stays on the one you pick, and changes push back to it.`}
        </p>
      </div>
      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="self-start">
          <ArrowLeft />
          Choose another
        </Button>
        <Button onClick={onScan} className="w-full sm:w-auto">
          Scan repository
          <ArrowRight />
        </Button>
      </div>
    </Card>
  );
}

function ScanStep({
  picked,
  branch,
  scanned,
  done,
  opening,
  onBack,
  onContinue,
  onOpen,
}: {
  picked: Picked;
  branch: string | null;
  scanned: number;
  done: boolean;
  opening: string[] | null;
  onBack: () => void;
  onContinue: () => void;
  onOpen: () => void;
}) {
  const lines = scanSteps(picked.resolved, branch);
  const p = picked.resolved.profile;
  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <ol className="space-y-2 font-mono text-[12.5px]" aria-live="polite" aria-label="Scan">
          {lines.slice(0, Math.max(1, scanned)).map((l, i) => {
            const active = !done && i === scanned - 1;
            return (
              <li key={l.text} className="flex animate-rise items-start gap-2.5">
                {active || scanned === 0 ? (
                  <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-brand-text" />
                ) : (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                )}
                <span className={cn(active ? "text-foreground" : "text-muted-foreground")}>{l.text}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      {done && (
        <Card className="animate-rise">
          <RepoHeader picked={picked} branch={branch} />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...new Set([p.framework, p.language, p.packageManager, `${p.files} files`, ...p.uses])].map((c) => (
              <span key={c} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs">
                {c}
              </span>
            ))}
          </div>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Fact title={`Routes · ${p.routes.length}`}>
              {p.routes.length ? (
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {p.routes.map((r) => (
                    <li key={r} className="truncate">
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">None found</span>
              )}
            </Fact>
            <Fact title={`Data models · ${p.models.length}`}>{p.models.length ? p.models.join(", ") : <span className="text-muted-foreground">None found</span>}</Fact>
            <Fact title={`Agents · ${p.agents.length}`}>
              {p.agents.length ? (
                <ul className="space-y-0.5">
                  {p.agents.map((a) => (
                    <li key={a.name}>
                      {a.name} <span className="text-muted-foreground">· {a.library}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">None yet. Architect adds an assistant you can shape or remove.</span>
              )}
            </Fact>
            <Fact title={`Environment variables · ${p.envVars.length}`}>
              {p.envVars.length ? (
                <ul className="space-y-0.5 font-mono text-[12px]">
                  {p.envVars.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">None needed</span>
              )}
            </Fact>
          </dl>

          <div className="mt-5">
            {!p.importable ? (
              <Verdict tone="error" title="Can't import this one">
                {p.reason}
              </Verdict>
            ) : p.previewable ? (
              <Verdict tone="success" title="Ready to preview">
                It runs in the preview, and every change you ask for lands as a new version.
              </Verdict>
            ) : (
              <Verdict tone="warning" title="Code only">
                {p.reason}
              </Verdict>
            )}
            {p.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.notes.map((n) => (
                  <li key={n} className="flex gap-2">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-border-strong" />
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {opening ? (
            <Opening labels={opening} />
          ) : (
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" onClick={onBack} className="self-start">
                <ArrowLeft />
                Choose another
              </Button>
              {p.importable &&
                (p.envVars.length ? (
                  <Button onClick={onContinue} className="w-full sm:w-auto">
                    Set up {p.envVars.length} environment {p.envVars.length === 1 ? "variable" : "variables"}
                    <ArrowRight />
                  </Button>
                ) : (
                  <Button onClick={onOpen} className="w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto">
                    Open in Architect
                    <ArrowRight />
                  </Button>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="annotation">{title}</dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function Verdict({ tone, title, children }: { tone: "success" | "warning" | "error"; title: string; children: React.ReactNode }) {
  const Icon = tone === "success" ? Check : tone === "warning" ? ServerCog : X;
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm",
        tone === "success" && "bg-success-soft text-success",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "error" && "bg-danger-soft text-destructive",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-medium">{title}.</span> <span className="text-pretty">{children}</span>
      </p>
    </div>
  );
}

function Opening({ labels }: { labels: string[] }) {
  return (
    <ol className="mt-6 space-y-2 border-t border-border pt-5" aria-live="polite">
      {labels.map((l, i) => (
        <li key={l} className="flex animate-rise items-center gap-2.5 text-sm">
          {i === labels.length - 1 ? <Loader2 className="size-4 animate-spin text-brand-text" /> : <Check className="size-4 text-success" />}
          <span className={i === labels.length - 1 ? "font-medium" : "text-muted-foreground"}>{l}…</span>
        </li>
      ))}
    </ol>
  );
}

function EnvStep({
  picked,
  env,
  setEnv,
  onBack,
  onDone,
}: {
  picked: Picked;
  env: Record<string, string>;
  setEnv: (e: Record<string, string>) => void;
  onBack: () => void;
  onDone: (choice: "saved" | "skipped") => void;
}) {
  const keys = picked.resolved.profile.envVars;
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [help, setHelp] = useState<Record<string, boolean>>({});
  const filled = keys.filter((k) => env[k]?.trim()).length;

  return (
    <Card>
      <h2 className="text-base font-semibold tracking-tight">Environment variables</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {picked.resolved.name} reads {keys.length === 1 ? "this key" : `these ${keys.length} keys`}. Add them now, or skip and add them later.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
        <span className="flex items-start gap-1.5">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          This is a demo, so don&apos;t paste real secrets. Any value works. Values are encrypted and never shown again.
        </span>
        <button type="button" onClick={() => setEnv(Object.fromEntries(keys.map((k) => [k, env[k]?.trim() ? env[k] : demoValue(k)])))} className="shrink-0 font-medium underline underline-offset-2">
          Fill with placeholders
        </button>
      </div>
      <ul className="mt-5 space-y-4">
        {keys.map((k) => (
          <li key={k}>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`env-${k}`} className="font-mono text-[12.5px]">
                {k}
              </Label>
              <button
                type="button"
                onClick={() => setHelp((h) => ({ ...h, [k]: !h[k] }))}
                aria-expanded={!!help[k]}
                aria-controls={`env-help-${k}`}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Where do I find this?
              </button>
            </div>
            {help[k] && (
              <p id={`env-help-${k}`} className="mt-1 text-xs text-muted-foreground">
                {envHelp(k)}
              </p>
            )}
            <div className="relative mt-1.5">
              <input
                id={`env-${k}`}
                type={shown[k] ? "text" : "password"}
                value={env[k] ?? ""}
                onChange={(e) => setEnv({ ...env, [k]: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                placeholder="Value"
                className="h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setShown((s) => ({ ...s, [k]: !s[k] }))}
                aria-label={shown[k] ? `Hide ${k}` : `Show ${k}`}
                className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {shown[k] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="self-start">
          <ArrowLeft />
          Back
        </Button>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEnv({});
              onDone("skipped");
            }}
          >
            Skip for now
          </Button>
          <Button onClick={() => onDone("saved")} disabled={filled === 0}>
            Save {filled > 0 && filled < keys.length ? `${filled} of ${keys.length}` : ""}
            <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReadyStep({
  picked,
  branch,
  env,
  choice,
  opening,
  onBack,
  onOpen,
}: {
  picked: Picked;
  branch: string | null;
  env: Record<string, string>;
  choice: "saved" | "skipped" | null;
  opening: string[] | null;
  onBack: () => void;
  onOpen: () => void;
}) {
  const p = picked.resolved.profile;
  const saved = choice === "saved" ? p.envVars.filter((k) => env[k]?.trim()).length : 0;
  // Only your own GitHub repos come in linked; URLs and ZIPs can be linked later.
  const linked = !!picked.resolved.repo;
  const rows: [string, React.ReactNode][] = [
    ["Preview", p.previewable ? "Ready to preview" : "Code only (no preview in this demo)"],
    ["Environment", saved === p.envVars.length ? `All ${saved} saved, encrypted` : saved ? `${saved} of ${p.envVars.length} saved; add the rest later` : "Skipped; add them later"],
    ["GitHub", linked ? `Linked to ${picked.resolved.fullName}${branch ? ` on ${branch}` : ""}. Changes sync back.` : "Not linked yet. Link a repository from the Workspace when you're ready."],
  ];
  return (
    <Card>
      <RepoHeader picked={picked} branch={branch} />
      <dl className="mt-5 divide-y divide-border rounded-xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-2.5 text-sm">
            <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {opening ? (
        <Opening labels={opening} />
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onBack} className="self-start">
            <ArrowLeft />
            Back
          </Button>
          <Button onClick={onOpen} className="w-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto">
            Open in Architect
            <ArrowRight />
          </Button>
        </div>
      )}
    </Card>
  );
}
