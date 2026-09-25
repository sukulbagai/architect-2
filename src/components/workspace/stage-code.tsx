"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, Copy, File, FileCode2, FileJson, FileText, Folder, Loader2, Lock, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import type { Workspace } from "./use-workspace";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/40" />,
});

type Node = { name: string; path: string; children?: Node[] };

function buildTree(paths: string[]): Node[] {
  const root: Node = { name: "", path: "", children: [] };
  for (const p of paths) {
    const parts = p.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const leaf = i === parts.length - 1;
      let next = cur.children!.find((c) => c.name === part && !!c.children === !leaf);
      if (!next) {
        next = leaf ? { name: part, path } : { name: part, path, children: [] };
        cur.children!.push(next);
      }
      cur = next;
    });
  }
  const sort = (nodes: Node[]): Node[] =>
    nodes
      .sort((a, b) => (a.children ? 0 : 1) - (b.children ? 0 : 1) || a.name.localeCompare(b.name))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

function FileIcon({ path }: { path: string }) {
  if (/\.(tsx?|jsx?|py)$/.test(path)) return <FileCode2 className="size-3.5 shrink-0 text-code-function" />;
  if (/\.json$/.test(path)) return <FileJson className="size-3.5 shrink-0 text-code-type" />;
  if (/\.(md|ya?ml|txt)$/.test(path)) return <FileText className="size-3.5 shrink-0 text-muted-foreground" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground" />;
}

export function CodePanel({ ws, isPro }: { ws: Workspace; isPro: boolean }) {
  const building = !!ws.build;
  const files = useMemo(() => {
    if (ws.build) {
      const out: Record<string, string> = {};
      for (const p of ws.build.order) {
        const full = ws.build.files[p] ?? "";
        out[p] = full.slice(0, Math.round(full.length * (ws.build.streamed[p] ?? 0)));
      }
      return out;
    }
    return ws.currentVersion?.files ?? {};
  }, [ws.build, ws.currentVersion]);
  const paths = useMemo(() => Object.keys(files).sort(), [files]);
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const preferred = paths.find((p) => /App\.tsx$|app\/page\.tsx$/.test(p)) ?? paths.find((p) => p.endsWith(".tsx")) ?? paths[0] ?? null;
  const active = building && follow ? ws.build?.writing ?? ws.build?.order[ws.build.order.length - 1] ?? null : selected && files[selected] !== undefined ? selected : preferred;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- each new build starts by following the file being written
    if (building) setFollow(true);
  }, [building]);

  const content = active ? drafts[active] ?? files[active] ?? "" : "";
  const dirty = active ? drafts[active] !== undefined && drafts[active] !== files[active] : false;
  const editable = isPro && !building && !!ws.currentVersion;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty && active) {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function save() {
    if (!active || !dirty) return;
    setSaving(true);
    try {
      await ws.saveCode(active, drafts[active]);
      setDrafts((d) => {
        const n = { ...d };
        delete n[active];
        return n;
      });
    } catch {
      toast.error("Couldn't save the file");
    } finally {
      setSaving(false);
    }
  }

  if (paths.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState className="w-full max-w-lg bg-background/70" icon={<FileCode2 />} title="No code yet" description="Files appear here as they're written during the build, and every version keeps its own copy." />
      </div>
    );
  }

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    if (n.children) {
      const closed = collapsed[n.path];
      return (
        <li key={n.path}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => ({ ...c, [n.path]: !closed }))}
            className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
            style={{ paddingLeft: 6 + depth * 12 }}
          >
            <ChevronRight className={cn("size-3 shrink-0 transition-transform", !closed && "rotate-90")} />
            <Folder className="size-3.5 shrink-0" />
            <span className="truncate">{n.name}</span>
          </button>
          {!closed && <ul>{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
        </li>
      );
    }
    const isActive = n.path === active;
    const writing = ws.build?.writing === n.path;
    return (
      <li key={n.path}>
        <button
          type="button"
          onClick={() => {
            setSelected(n.path);
            setFollow(false);
          }}
          className={cn(
            "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[12.5px] hover:bg-muted",
            isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
          )}
          style={{ paddingLeft: 20 + depth * 12 }}
        >
          <FileIcon path={n.path} />
          <span className="truncate">{n.name}</span>
          {writing && <Loader2 className="ml-auto size-3 shrink-0 animate-spin text-brand-text" />}
          {drafts[n.path] !== undefined && drafts[n.path] !== files[n.path] && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-brand" />}
        </button>
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar sm:flex">
        <div className="flex h-9 items-center justify-between border-b border-border px-3">
          <span className="annotation">Files</span>
          <span className="font-mono text-[11px] text-subtle-foreground">{paths.length}</span>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 scrollbar-thin">{tree.map((n) => renderNode(n, 0))}</ul>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-3">
          <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-muted-foreground">
            {active && <FileIcon path={active} />}
            <span className="truncate">{active}</span>
            {building && ws.build?.writing === active && <span className="shrink-0 text-brand-text">writing…</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {building && !follow && (
              <Button size="xs" variant="ghost" onClick={() => setFollow(true)}>
                Follow the build
              </Button>
            )}
            {!editable && !building && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Switch to Pro to edit code">
                <Lock className="size-3" />
                Read only
              </span>
            )}
            {dirty && (
              <>
                <Button size="xs" variant="ghost" onClick={() => setDrafts((d) => ({ ...d, [active!]: files[active!] }))}>
                  <Undo2 />
                  Discard
                </Button>
                <Button size="xs" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Save as new version
                </Button>
              </>
            )}
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Copy file"
              onClick={() => {
                void navigator.clipboard?.writeText(content).then(() => toast.success("Copied"));
              }}
            >
              <Copy />
            </Button>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {active && (
            <CodeEditor
              key={active}
              path={active}
              value={content}
              readOnly={!editable}
              onChange={(v) => setDrafts((d) => ({ ...d, [active]: v }))}
            />
          )}
        </div>
      </section>
    </div>
  );
}
