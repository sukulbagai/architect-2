import { cn } from "@/lib/utils";

/** Empty states are drawn on the drafting grid: an unbuilt thing, waiting to be drawn. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong px-6 py-16 text-center",
        className,
      )}
    >
      <div className="bg-grid mask-fade-radial pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col items-center">
        {icon && (
          <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-card [&_svg]:size-5">
            {icon}
          </div>
        )}
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
