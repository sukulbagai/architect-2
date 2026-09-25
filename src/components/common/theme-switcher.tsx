"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Segmented light / dark / system control. */
export function ThemeSwitcher({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? theme : undefined;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground",
              size === "sm" ? "h-6 flex-1 px-2" : "h-8 flex-1 px-3 text-sm",
              active && "bg-card text-foreground shadow-card dark:bg-accent",
            )}
          >
            <Icon className="size-3.5" />
            {size === "md" && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
