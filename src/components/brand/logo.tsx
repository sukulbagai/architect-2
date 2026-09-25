import { cn } from "@/lib/utils";

/**
 * The mark is a drafting compass drawn as an "A": two legs, a pivot, and a vermilion arc
 * for the crossbar (the arc is the one line a compass exists to draw).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M16 8.2 9.6 24.6M16 8.2l6.4 16.4"
        className="stroke-background"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M11.4 19.6c3-1.9 6.2-1.9 9.2 0" stroke="#ff6a38" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="8.2" r="2.1" className="fill-background" />
    </svg>
  );
}

export function Logo({ className, showVersion = true }: { className?: string; showVersion?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">Architect</span>
      {showVersion && (
        <span className="rounded-full border border-border px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground">
          2.0
        </span>
      )}
    </span>
  );
}
