"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, CircleX, Hammer, History, MousePointerClick, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import type { EditTarget } from "@/lib/sim/visual";
import type { Issue } from "@/lib/sim/types";
import type { EditDraft } from "@/components/preview/editable";
import { VisualEditPanel } from "./visual-edit-panel";
import type { Workspace } from "./use-workspace";

export type Device = "desktop" | "tablet" | "mobile";

export type SelectState = {
  on: boolean;
  setOn: (on: boolean) => void;
  target: EditTarget | null;
  setTarget: (t: EditTarget | null) => void;
};

export function PreviewPanel({
  ws,
  device,
  nonce,
  route,
  onRoute,
  select,
  isPro,
}: {
  ws: Workspace;
  device: Device;
  nonce: number;
  route: string | null;
  onRoute: (page: string) => void;
  select: SelectState;
  isPro: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const building = ws.build && !ws.build.previewReady;
  const versionId = ws.previewVersionId ?? ws.currentVersionId;
  const source = ws.build ? "draft" : versionId ?? (ws.plan ? "draft" : null);
  const frameKey = `${source}-${nonce}`;
  // Each new frame opens on the page the last change focused on, or wherever you were.
  const [pinned, setPinned] = useState({ key: frameKey, page: ws.previewPage ?? route });
  if (pinned.key !== frameKey) setPinned({ key: frameKey, page: ws.previewPage ?? route });
  const [readyKey, setReadyKey] = useState<string | null>(null);
  // The page this frame says it's on. Until it reports, it's the page it was asked to open.
  const [frameRoute, setFrameRoute] = useState<{ key: string; page: string } | null>(null);
  const shownPage = frameRoute?.key === frameKey ? frameRoute.page : pinned.page;
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const loaded = readyKey === frameKey;
  const post = (data: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(data, window.location.origin);
  const { on: selecting, setOn: setSelecting, target, setTarget } = select;
  const { addLog } = ws;
  const planIssues = ws.plan?.issues;

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === "architect:route" && typeof d.page === "string") {
        onRoute(d.page);
        setFrameRoute({ key: frameKey, page: d.page });
      }
      if (d?.type === "architect:ready") {
        setReadyKey(frameKey);
        if (selecting) frame.current?.contentWindow?.postMessage({ type: "architect:select-mode", on: true }, window.location.origin);
      }
      if (d?.type === "architect:selected" && d.target?.editId) setTarget(d.target as EditTarget);
      if (d?.type === "architect:select-cancel") {
        setSelecting(false);
        setTarget(null);
      }
      if (d?.type === "architect:log" && typeof d.message === "string") {
        addLog(d.level === "warn" || d.level === "error" ? d.level : "info", d.message, /\/api\/agents\/|^\w+: /.test(d.message) ? "agent" : "app");
      }
      if (d?.type === "architect:error") {
        const issue = planIssues?.find((i) => i.id === d.issueId);
        if (issue) addLog("error", `${issue.title}  at ${issue.file}:${issue.line}`, "app");
      }
      // Shortcuts pressed while focus is inside the app.
      if (d?.type === "architect:key" && typeof d.key === "string") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: d.key, metaKey: !!d.meta, bubbles: true }));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onRoute, frameKey, selecting, setSelecting, setTarget, addLog, planIssues]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "architect:ping" }, window.location.origin);
  }, [frameKey]);

  useEffect(() => {
    if (!ws.previewPage) return;
    frame.current?.contentWindow?.postMessage({ type: "architect:navigate", page: ws.previewPage }, window.location.origin);
  }, [ws.previewPage]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "architect:select-mode", on: selecting }, window.location.origin);
  }, [selecting]);

  useEffect(() => {
    if (!target) frame.current?.contentWindow?.postMessage({ type: "architect:deselect" }, window.location.origin);
  }, [target]);

  if (building) return <BuildingSkeleton ws={ws} />;

  if (!source || (!ws.currentVersionId && !ws.build)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          className="w-full max-w-lg bg-background/70"
          icon={<Hammer />}
          title={ws.plan ? "Ready when you are" : "Your app appears here"}
          description={
            ws.plan
              ? "The plan is ready. Build it and the preview switches on as soon as the first screen exists."
              : "Answer a few questions in the chat and Architect drafts a plan. The preview switches on once the first screen is built."
          }
          action={
            ws.plan && ws.project.stage === "plan" ? (
              <Button onClick={() => void ws.runBuild()} className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Hammer />
                Build this
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const params = new URLSearchParams({ embed: "1" });
  if (source === "draft") params.set("draft", "1");
  else params.set("v", source);
  if (pinned.page) params.set("page", pinned.page);
  const oldVersion = !!ws.previewVersionId && ws.previewVersionId !== ws.currentVersionId;
  // The page you're looking at comes first; other broken pages are counted in "and N more".
  const issue = !oldVersion && !ws.build ? ws.issues.find((i) => i.pageId === shownPage) ?? ws.issues[0] : undefined;

  function sendDraft(d: EditDraft | null) {
    setDraft(d);
    post({ type: "architect:draft-edit", draft: d });
  }

  function closePanel() {
    if (draft) sendDraft(null);
    setTarget(null);
  }

  return (
    <div className="flex h-full flex-col">
      {oldVersion && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning">
          <span className="flex items-center gap-2">
            <History className="size-4" />
            Previewing v{ws.versions.find((v) => v.id === ws.previewVersionId)?.number}. This isn&apos;t the current version.
          </span>
          <span className="flex gap-2">
            <Button size="xs" variant="outline" onClick={() => ws.setPreviewVersionId(null)}>
              Back to current
            </Button>
            <Button size="xs" onClick={() => void ws.restore(ws.previewVersionId!)}>
              Restore this version
            </Button>
          </span>
        </div>
      )}
      {issue && <IssueBanner ws={ws} issue={issue} isPro={isPro} currentPage={shownPage ?? ws.plan?.pages[0]?.id ?? null} more={ws.issues.length - 1} />}
      {selecting && (
        <div className="flex items-center justify-between gap-3 border-b border-brand/25 bg-brand-soft px-4 py-1.5 text-xs text-brand-text">
          <span className="flex min-w-0 items-center gap-2">
            <MousePointerClick className="size-3.5 shrink-0" />
            <span className="truncate">{target ? "Change it in the panel, then Apply." : "Point at something in the app, then click it to edit it."}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden font-mono text-[10.5px] opacity-70 sm:inline">Esc to finish</span>
            <Button size="xs" variant="outline" className="h-6 border-brand/30 bg-transparent text-brand-text hover:bg-brand/10" onClick={() => setSelecting(false)}>
              Done
            </Button>
          </span>
        </div>
      )}
      <div className={cn("relative flex min-h-0 flex-1 justify-center", device !== "desktop" && "py-5")}>
        <div
          className={cn(
            "relative h-full w-full overflow-hidden bg-background transition-[max-width] duration-300",
            device === "tablet" && "max-w-[768px] rounded-xl border border-border-strong shadow-float",
            device === "mobile" && "max-w-[390px] rounded-[28px] border-[6px] border-foreground/85 shadow-float",
            selecting && device === "desktop" && "ring-2 ring-brand/40 ring-inset",
          )}
        >
          {!loaded && <div className="absolute inset-0 animate-pulse bg-muted/60" />}
          <iframe
            key={frameKey}
            ref={frame}
            title="App preview"
            src={`/p/${ws.project.id}/preview?${params}`}
            onLoad={() => frame.current?.contentWindow?.postMessage({ type: "architect:ping" }, window.location.origin)}
            className="h-full w-full bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
        {target && ws.plan && (
          <VisualEditPanel
            key={`${frameKey}-${target.editId}`}
            target={target}
            plan={ws.plan}
            onDraft={sendDraft}
            onCancel={closePanel}
            onApply={async (change) => {
              const ok = await ws.visualEdit(target, change);
              if (ok) {
                setDraft(null);
                setTarget(null);
              }
              return ok;
            }}
          />
        )}
      </div>
    </div>
  );
}

/** A broken page, in each mode's language: a plain sentence in Simple, the stack trace in Pro. */
function IssueBanner({ ws, issue, isPro, currentPage, more }: { ws: Workspace; issue: Issue; isPro: boolean; currentPage: string | null; more: number }) {
  const [open, setOpen] = useState(false);
  const page = ws.plan?.pages.find((p) => p.id === issue.pageId);
  const elsewhere = currentPage !== null && currentPage !== issue.pageId;
  const fix = (
    <Button size="xs" onClick={() => void ws.fixIssue(issue.id)} disabled={!!ws.thinking} className="shrink-0">
      <Wrench />
      Fix it
    </Button>
  );
  const show = elsewhere && page && (
    <button type="button" onClick={() => ws.setPreviewPage(issue.pageId)} className="shrink-0 text-xs underline-offset-2 hover:underline">
      Show me
    </button>
  );

  if (!isPro) {
    return (
      <div role="alert" className="flex items-center gap-3 border-b border-warning/25 bg-warning-soft px-4 py-2 text-sm text-warning">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-pretty">
          {issue.plain}
          {more > 0 && <span className="opacity-75"> And {more} more.</span>}
        </span>
        {show}
        {fix}
      </div>
    );
  }

  return (
    <div role="alert" className="border-b border-destructive/25 bg-danger-soft text-sm">
      <div className="flex items-center gap-3 px-4 py-2">
        <CircleX className="size-4 shrink-0 text-destructive" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-destructive" title={issue.title}>
          {issue.title}
        </span>
        <button
          type="button"
          onClick={() => ws.openCode(issue.file, issue.line)}
          className="hidden shrink-0 font-mono text-[11.5px] text-foreground/80 underline decoration-border-strong underline-offset-2 hover:text-foreground sm:inline"
        >
          {issue.file}:{issue.line}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Stack
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {show}
        {fix}
      </div>
      {open && (
        <pre className="overflow-x-auto border-t border-destructive/15 px-4 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          <span className="text-destructive">{issue.title}</span>
          {issue.stack.map((l, i) => (
            <span key={i}>
              {"\n    "}
              {i === 0 ? (
                <button type="button" onClick={() => ws.openCode(issue.file, issue.line)} className="text-foreground underline decoration-border-strong underline-offset-2">
                  {l}
                </button>
              ) : (
                l
              )}
            </span>
          ))}
          {more > 0 && `\n\n${more} more ${more === 1 ? "problem" : "problems"} in the Problems tab (⌘J).`}
        </pre>
      )}
    </div>
  );
}

function BuildingSkeleton({ ws }: { ws: Workspace }) {
  const b = ws.build!;
  const total = Object.keys(b.files).length;
  const written = b.order.filter((p) => (b.streamed[p] ?? 0) >= 1).length;
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-float">
          <div className="flex h-full">
            <div className="hidden w-44 space-y-2 border-r border-border bg-muted/40 p-4 sm:block">
              <div className="mb-4 h-5 w-24 animate-pulse rounded bg-border-strong/70" />
              {[70, 55, 80, 60].map((w, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-border" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <div className="flex-1 space-y-4 p-5">
              <div className="h-6 w-40 animate-pulse rounded bg-border-strong/70" />
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/50" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded bg-muted/70" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="annotation mt-4 text-center">
          {b.steps.ui.status === "active" ? `Building the UI · ${written} of ${total} files` : "The preview switches on with the first screen"}
        </p>
      </div>
    </div>
  );
}
