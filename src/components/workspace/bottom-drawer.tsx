"use client";

import { useState } from "react";
import { ScrollText, SquareTerminal, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogsView } from "./logs-view";
import { ProblemsView } from "./problems-view";
import { TerminalView } from "./terminal-view";
import type { Workspace } from "./use-workspace";

export type DrawerTab = "terminal" | "logs" | "problems";

export const DRAWER_MIN = 160;
export const DRAWER_MAX = 480;

/** Pro only: Terminal, Logs and Problems under the stage. Resizable, remembered per browser. */
export function BottomDrawer({
  ws,
  user,
  open,
  height,
  onResize,
  onResizeEnd,
  tab,
  onTab,
  onClose,
}: {
  ws: Workspace;
  user: string;
  open: boolean;
  height: number;
  onResize: (h: number) => void;
  onResizeEnd: (h: number) => void;
  tab: DrawerTab;
  onTab: (t: DrawerTab) => void;
  onClose: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    let latest = startH;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      latest = Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, startH - (ev.clientY - startY)));
      onResize(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      setDragging(false);
      onResizeEnd(latest);
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const tabs = [
    { id: "terminal" as const, label: "Terminal", icon: SquareTerminal },
    { id: "logs" as const, label: "Logs", icon: ScrollText },
    { id: "problems" as const, label: "Problems", icon: TriangleAlert, count: ws.issues.length },
  ];

  return (
    <section
      className={cn("relative flex shrink-0 flex-col border-t border-border bg-background", !open && "hidden")}
      style={{ height }}
      aria-label="Terminal, logs and problems"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize drawer"
        aria-valuemin={DRAWER_MIN}
        aria-valuemax={DRAWER_MAX}
        aria-valuenow={height}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const h = Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, height + (e.key === "ArrowUp" ? 24 : -24)));
            onResize(h);
            onResizeEnd(h);
          }
        }}
        onPointerDown={startDrag}
        className={cn("absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize transition-colors hover:bg-brand/40 focus-visible:bg-brand/40 focus-visible:outline-none", dragging && "bg-brand/40")}
      />
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2" role="tablist" aria-label="Drawer">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
              tab === id && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {!!count && <span className="min-w-4 rounded-full bg-destructive px-1 text-center font-mono text-[10px] leading-4 text-white">{count}</span>}
          </button>
        ))}
        <span className="ml-auto hidden font-mono text-[10.5px] text-subtle-foreground sm:inline">⌘J</span>
        <Button size="icon-xs" variant="ghost" aria-label="Close drawer" onClick={onClose} className="text-muted-foreground">
          <X />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", tab !== "terminal" && "hidden")}>
          <TerminalView ws={ws} user={user} active={open && tab === "terminal"} />
        </div>
        <div className={cn("absolute inset-0", tab !== "logs" && "hidden")}>
          <LogsView ws={ws} active={open && tab === "logs"} />
        </div>
        <div className={cn("absolute inset-0", tab !== "problems" && "hidden")}>
          <ProblemsView ws={ws} />
        </div>
      </div>
    </section>
  );
}
