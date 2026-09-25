"use client";

import { useEffect, useRef, useState } from "react";
import { Hammer, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import type { Workspace } from "./use-workspace";

export type Device = "desktop" | "tablet" | "mobile";

export function PreviewPanel({ ws, device, nonce, onRoute }: { ws: Workspace; device: Device; nonce: number; onRoute: (page: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const building = ws.build && !ws.build.previewReady;
  const versionId = ws.previewVersionId ?? ws.currentVersionId;
  const source = ws.build ? "draft" : versionId ?? (ws.plan ? "draft" : null);
  const [initialPage] = useState(ws.previewPage);
  const frameKey = `${source}-${nonce}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const loaded = readyKey === frameKey;

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "architect:route" && typeof e.data.page === "string") onRoute(e.data.page);
      if (e.data?.type === "architect:ready") setReadyKey(frameKey);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onRoute, frameKey]);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "architect:ping" }, window.location.origin);
  }, [frameKey]);

  useEffect(() => {
    if (!ws.previewPage) return;
    frame.current?.contentWindow?.postMessage({ type: "architect:navigate", page: ws.previewPage }, window.location.origin);
  }, [ws.previewPage]);

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
  if (initialPage) params.set("page", initialPage);

  return (
    <div className="flex h-full flex-col">
      {ws.previewVersionId && ws.previewVersionId !== ws.currentVersionId && (
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
      <div className={cn("relative flex min-h-0 flex-1 justify-center", device !== "desktop" && "py-5")}>
        <div
          className={cn(
            "relative h-full w-full overflow-hidden bg-background transition-[max-width] duration-300",
            device === "tablet" && "max-w-[768px] rounded-xl border border-border-strong shadow-float",
            device === "mobile" && "max-w-[390px] rounded-[28px] border-[6px] border-foreground/85 shadow-float",
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
      </div>
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
