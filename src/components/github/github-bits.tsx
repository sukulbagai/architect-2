"use client";

import { Copy, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { commitSha, LANGUAGE_COLOR } from "@/lib/sim/github";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LanguageDot({ language, className }: { language: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/10" style={{ background: LANGUAGE_COLOR[language] ?? "#8b8a83" }} aria-hidden="true" />
      {language}
    </span>
  );
}

export function Visibility({ isPrivate, className }: { isPrivate: boolean; className?: string }) {
  const Icon = isPrivate ? Lock : Globe;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10.5px] text-muted-foreground", className)}>
      <Icon className="size-2.5" />
      {isPrivate ? "Private" : "Public"}
    </span>
  );
}

/** A version's commit sha, in a small mono chip. */
export function ShaChip({ versionId, className }: { versionId: string; className?: string }) {
  return <span className={cn("rounded bg-muted px-1 py-px font-mono text-[10.5px] text-muted-foreground", className)}>{commitSha(versionId)}</span>;
}

/**
 * A GitHub address shown as copyable text rather than a link: nothing is really there, because
 * GitHub is simulated in this demo.
 */
export function SimulatedLink({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(`https://${text}`).then(() => toast.success("Copied", { description: "It's a demo address: GitHub is simulated here." }))}
          className={cn("inline-flex min-w-0 items-center gap-1 rounded font-mono text-[11px] text-muted-foreground hover:text-foreground", className)}
        >
          <span className="truncate">{text}</span>
          <Copy className="size-3 shrink-0 opacity-70" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Simulated in this demo</TooltipContent>
    </Tooltip>
  );
}
