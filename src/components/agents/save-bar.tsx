"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Sticky "Unsaved changes" bar. Save is the one brand button while it's showing. */
export function SaveBar({
  show,
  saving,
  onSave,
  onDiscard,
  note,
  className,
}: {
  show: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  note?: string;
  className?: string;
}) {
  if (!show) return null;
  return (
    <div className={cn("pointer-events-none sticky bottom-0 z-10 flex justify-center px-4 pt-2 pb-4", className)}>
      <div className="animate-rise pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border border-border-strong bg-popover py-2 pr-2 pl-4 shadow-float" role="region" aria-label="Unsaved changes">
        <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">Unsaved changes</span>
          {note && <span className="hidden text-muted-foreground sm:inline"> · {note}</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="min-w-16 bg-brand text-brand-foreground hover:bg-brand/90">
          {saving ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}
