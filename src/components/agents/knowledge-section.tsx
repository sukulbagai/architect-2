"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { chunksFor } from "@/lib/sim/agents";
import type { KnowledgeFile } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.xlsx";
const OK = /\.(pdf|docx|txt|md|csv|xlsx)$/i;
const INDEX_MS = 1500;

/**
 * Files an agent can read. Only names and sizes are kept; the contents never leave the browser.
 * New files "index" for 1.5 s, then show their chunk count (one per 2 KB).
 */
export function KnowledgeSection({
  files,
  onChange,
  isPro,
  readOnly,
}: {
  files: KnowledgeFile[];
  onChange: (files: KnowledgeFile[]) => void;
  isPro: boolean;
  readOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [indexing, setIndexing] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function add(list: FileList | null) {
    if (!list || readOnly) return;
    const all = Array.from(list);
    const good = all.filter((f) => OK.test(f.name) && !files.some((k) => k.name === f.name));
    setRejected(all.filter((f) => !OK.test(f.name)).map((f) => f.name));
    if (!good.length) return;
    onChange([...files, ...good.map((f) => ({ name: f.name, size: f.size, chunks: chunksFor(f.size) }))]);
    const names = good.map((f) => f.name);
    setIndexing((cur) => [...cur, ...names]);
    timers.current.push(setTimeout(() => setIndexing((cur) => cur.filter((n) => !names.includes(n))), INDEX_MS));
  }

  const total = files.reduce((s, f) => s + f.chunks, 0);

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed border-border-strong bg-card/50 transition-colors",
          dragging && "border-brand bg-brand-soft/40",
        )}
      >
        {files.length > 0 && (
          <ul className="divide-y divide-border border-b border-dashed border-border-strong">
            {files.map((f) => {
              const busy = indexing.includes(f.name);
              const Icon = /\.(csv|xlsx)$/i.test(f.name) ? FileSpreadsheet : FileText;
              return (
                <li key={f.name} className="flex items-center gap-3 px-3.5 py-2.5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{f.name}</p>
                    {busy ? (
                      <div className="mt-1.5 flex items-center gap-2" role="status">
                        <span className="h-1 w-28 overflow-hidden rounded-full bg-muted">
                          <span className="animate-fill block h-full rounded-full bg-brand" style={{ ["--fill-ms" as string]: `${INDEX_MS}ms` }} />
                        </span>
                        <span className="text-[11px] text-muted-foreground">Indexing…</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {formatBytes(f.size)} · <span className="text-success">Ready</span> · {f.chunks} {f.chunks === 1 ? "chunk" : "chunks"}
                      </p>
                    )}
                  </div>
                  {!readOnly && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Remove ${f.name}`} className="text-muted-foreground" onClick={() => onChange(files.filter((k) => k.name !== f.name))}>
                      <X />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-col items-center gap-2 px-4 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Upload className="size-3.5 shrink-0" />
            {isPro ? `Knowledge base · ${total} ${total === 1 ? "chunk" : "chunks"} · embeddings: simulated` : "Drop files here: PDF, Word, text, Markdown, CSV or Excel."}
          </p>
          {!readOnly && (
            <Button size="xs" variant="outline" onClick={() => input.current?.click()}>
              Add files
            </Button>
          )}
        </div>
      </div>
      {rejected.length > 0 && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {rejected.join(", ")} {rejected.length === 1 ? "isn't" : "aren't"} a supported type. Use PDF, DOCX, TXT, MD, CSV or XLSX.
        </p>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
