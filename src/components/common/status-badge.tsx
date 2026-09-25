import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/db/schema";

const STYLES: Record<ProjectStatus, { label: string; dot: string; text: string }> = {
  draft: { label: "Draft", dot: "bg-subtle-foreground", text: "text-muted-foreground" },
  building: { label: "Building", dot: "bg-warning animate-pulse", text: "text-warning" },
  live: { label: "Live", dot: "bg-success", text: "text-success" },
  error: { label: "Needs a fix", dot: "bg-destructive", text: "text-destructive" },
};

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = STYLES[status] ?? STYLES.draft;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.text, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: ProjectStatus; className?: string }) {
  const s = STYLES[status] ?? STYLES.draft;
  return <span className={cn("size-1.5 shrink-0 rounded-full", s.dot, className)} aria-label={s.label} />;
}
