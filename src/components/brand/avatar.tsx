import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function WorkspaceAvatar({
  name,
  hue,
  className,
}: {
  name: string;
  hue: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "avatar-hue inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        className,
      )}
      style={{ "--hue": hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
