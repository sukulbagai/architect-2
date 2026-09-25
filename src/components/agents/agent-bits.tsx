import { cn } from "@/lib/utils";
import { agentHue } from "@/lib/sim/agents";
import { frameworkOf } from "@/lib/sim/frameworks";

/** An agent's monogram on a stable hue, so the same agent looks the same everywhere. */
export function AgentAvatar({ id, name, className }: { id: string; name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("avatar-hue flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tracking-tight", className)}
      style={{ ["--hue" as string]: agentHue(id) }}
    >
      {letters || "A"}
    </span>
  );
}

export function FrameworkChip({ framework, className }: { framework: string; className?: string }) {
  const f = frameworkOf(framework);
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-md border border-border bg-background px-1.5 font-mono text-[10.5px] whitespace-nowrap text-muted-foreground", className)}>
      {f.label}
    </span>
  );
}

export function LanguageChip({ language, className }: { language: string; className?: string }) {
  return <span className={cn("rounded px-1.5 py-px font-mono text-[10px] text-subtle-foreground ring-1 ring-border ring-inset", className)}>{language}</span>;
}
