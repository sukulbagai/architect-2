"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Rocket, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { checkSlug, deployVersion, listDeployments, preflight, rollbackTo, suggestedSlug, type DeploymentView } from "@/lib/actions/deploy";
import type { Workspace } from "@/components/workspace/use-workspace";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Check = { id: string; label: string; ok: boolean; detail: string };
type CheckState = Check & { state: "pending" | "running" | "done" };

export function DeploySheet({
  ws,
  open,
  onOpenChange,
}: {
  ws: Workspace;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectId = ws.project.id;
  const [checks, setChecks] = useState<CheckState[]>([]);
  const [slug, setSlug] = useState("");
  const [availability, setAvailability] = useState<{ slug: string; ok: boolean; reason: string | null; suggestion: string | null } | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ url: string; slug: string; versionNumber: number } | null>(null);
  const [history, setHistory] = useState<DeploymentView[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Pre-flight runs each time the sheet opens, one row at a time so it reads as work happening.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setResult(null);
      setLogs([]);
      const [{ checks: rows }, initialSlug, past] = await Promise.all([
        preflight(projectId),
        suggestedSlug(projectId),
        listDeployments(projectId),
      ]);
      if (cancelled) return;
      setSlug(initialSlug);
      setHistory(past);
      setChecks(rows.map((c) => ({ ...c, state: "pending" as const })));

      for (let i = 0; i < rows.length; i++) {
        if (cancelled) return;
        setChecks((list) => list.map((c, n) => (n === i ? { ...c, state: "running" } : c)));
        await wait(320);
        if (cancelled) return;
        setChecks((list) => list.map((c, n) => (n === i ? { ...c, state: "done" } : c)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Debounced availability check on the address. The result carries the slug it was for, so
  // "checking" is derived rather than a second piece of state that can fall out of step.
  useEffect(() => {
    if (!open || !slug) return;
    const t = setTimeout(async () => {
      const res = await checkSlug(projectId, slug);
      setAvailability({ slug, ...res });
    }, 400);
    return () => clearTimeout(t);
  }, [slug, projectId, open]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const checking = Boolean(slug) && availability?.slug !== slug;
  const preflightDone = checks.length > 0 && checks.every((c) => c.state === "done");
  const preflightPassed = preflightDone && checks.every((c) => c.ok);
  const canDeploy = preflightPassed && availability?.ok === true && !deploying && !checking;

  const run = useCallback(async () => {
    setDeploying(true);
    setLogs([]);
    try {
      const res = await deployVersion({ projectId, slug });
      // Stream the stored lines so the wait feels like a build, not a spinner.
      for (const entry of res.logs) {
        setLogs((l) => [...l, entry.line]);
        await wait(entry.line === "Ready" ? 300 : 700);
      }
      setResult({ url: res.url, slug: res.slug, versionNumber: res.versionNumber });
      setHistory(await listDeployments(projectId));
      ws.addLocalMessage({
        role: "assistant",
        kind: "event",
        content: `Deployed v${res.versionNumber} to Production · /live/${res.slug}`,
        data: null,
      });
    } catch (e) {
      toast("Deploy failed", { description: e instanceof Error ? e.message : "Try again in a moment" });
      setLogs((l) => [...l, "Failed"]);
    } finally {
      setDeploying(false);
    }
  }, [projectId, slug, ws]);

  const copy = async (path: string) => {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      // Clipboard access can be refused (an insecure origin, or a denied permission).
      toast("Your public link", { description: url });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[440px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4 text-brand-text" />
            Deploy
          </SheetTitle>
          <SheetDescription>
            Puts this version on a public URL that anyone can open. No hosting account needed.
          </SheetDescription>
        </SheetHeader>

        {result ? (
          <div className="px-5 py-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-success/15">
                  <Check className="size-3 text-success" />
                </span>
                <p className="text-sm font-medium">v{result.versionNumber} is live on Production</p>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">{result.slug}.architect.app</p>
              <p className="mt-1 font-mono text-xs break-all text-foreground">{result.url}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void copy(result.url)}>
                  <Copy />
                  Copy link
                </Button>
                <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" asChild>
                  <a href={result.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open live app
                  </a>
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => setResult(null)}>
              Deploy again
            </Button>
          </div>
        ) : (
          <div className="space-y-6 px-5 py-5">
            <section>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pre-flight</h3>
              <ul className="mt-3 space-y-2">
                {checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {c.state !== "done" ? (
                        <Loader2 className={cn("size-3.5 text-muted-foreground", c.state === "running" && "animate-spin")} />
                      ) : c.ok ? (
                        <Check className="size-3.5 text-success" />
                      ) : (
                        <X className="size-3.5 text-destructive" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-sm", c.state !== "done" && "text-muted-foreground")}>{c.label}</span>
                      {c.state === "done" && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
                    </span>
                  </li>
                ))}
                {checks.length === 0 && <li className="text-sm text-muted-foreground">Running checks…</li>}
              </ul>
            </section>

            <section>
              <Label htmlFor="deploy-slug" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Address
              </Label>
              <Input
                id="deploy-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="mt-2"
                aria-describedby="deploy-slug-note"
                disabled={deploying}
              />
              <p id="deploy-slug-note" className="mt-1.5 text-xs text-muted-foreground">
                {checking ? (
                  "Checking…"
                ) : availability?.ok ? (
                  <span className="text-success">Available · {slug}.architect.app</span>
                ) : availability ? (
                  <span className="text-destructive">
                    {availability.reason}
                    {availability.suggestion && (
                      <button type="button" className="ml-1 underline hover:no-underline" onClick={() => setSlug(availability.suggestion!)}>
                        Use {availability.suggestion}
                      </button>
                    )}
                  </span>
                ) : (
                  "Your app's public address"
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The vanity domain is simulated; the real URL is <span className="font-mono">/live/{slug || "…"}</span>.
              </p>
            </section>

            {logs.length > 0 && (
              <section>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Logs</h3>
                <div ref={logRef} className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs">
                  {logs.map((l, i) => (
                    <p key={i} className={cn("py-0.5", l === "Ready" && "text-success", l === "Failed" && "text-destructive")}>
                      {l}
                    </p>
                  ))}
                </div>
              </section>
            )}

            <Button
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={!canDeploy}
              onClick={run}
            >
              {deploying ? <Loader2 className="animate-spin" /> : <Rocket />}
              {deploying ? "Deploying…" : "Deploy to Production"}
            </Button>
            {preflightDone && !preflightPassed && (
              <p className="-mt-3 text-center text-xs text-destructive">Fix the failing check before deploying.</p>
            )}

            {history.length > 0 && (
              <section className="border-t border-border pt-5">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Deployments</h3>
                <ul className="mt-3 space-y-2">
                  {history.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm">
                          v{d.versionNumber ?? "?"}
                          {d.active && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 text-[10px] font-medium text-success">
                              Live
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          /live/{d.slug} · {timeAgo(new Date(d.createdAt))}
                        </span>
                      </span>
                      {!d.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await rollbackTo(projectId, d.id);
                            setHistory(await listDeployments(projectId));
                            toast(`Rolled back to v${d.versionNumber ?? "?"}`);
                          }}
                        >
                          <RotateCcw />
                          Rollback
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
