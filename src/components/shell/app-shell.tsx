"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import {
  Blocks,
  Bot,
  ChevronsUpDown,
  Compass,
  FolderKanban,
  Gauge,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "@/components/brand/logo";
import { WorkspaceAvatar } from "@/components/brand/avatar";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { StatusDot } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { setMode } from "@/lib/actions/workspace";
import { signOut } from "@/lib/actions/auth";
import type { Mode, ProjectStatus } from "@/db/schema";
import { RAIL_COOKIE } from "@/lib/constants";

export type ShellWorkspace = {
  name: string;
  email: string | null;
  mode: Mode;
  avatarHue: number;
};

export type ShellProject = { id: string; name: string; status: ProjectStatus };

const NAV = [
  { href: "/home", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/usage", label: "Usage", icon: Gauge },
] as const;

export function AppShell({
  workspace,
  recent,
  initialCollapsed,
  children,
}: {
  workspace: ShellWorkspace;
  recent: ShellProject[];
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${RAIL_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-[60px]" : "w-[248px]",
        )}
      >
        <Rail workspace={workspace} recent={recent} collapsed={collapsed} onToggle={toggle} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
          <Link href="/home" aria-label="Home">
            <Logo />
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}>
                <Rail workspace={workspace} recent={recent} collapsed={false} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function Rail({
  workspace,
  recent,
  collapsed,
  onToggle,
}: {
  workspace: ShellWorkspace;
  recent: ShellProject[];
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        {collapsed ? (
          <RailTooltip label="Expand sidebar" show>
            <button
              type="button"
              onClick={onToggle}
              className="group relative rounded-lg"
              aria-label="Expand sidebar"
            >
              <LogoMark className="transition-opacity group-hover:opacity-0" />
              <PanelLeftOpen className="absolute inset-0 m-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </RailTooltip>
        ) : (
          <>
            <Link href="/home" className="rounded-md" aria-label="Architect home">
              <Logo />
            </Link>
            {onToggle && (
              <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Collapse sidebar" className="text-muted-foreground">
                <PanelLeftClose />
              </Button>
            )}
          </>
        )}
      </div>

      <div className={cn("shrink-0 pb-2", collapsed ? "px-2.5" : "px-3")}>
        <RailTooltip label="New project" show={collapsed}>
          <Button
            asChild
            variant="outline"
            className={cn("w-full bg-card shadow-card", collapsed ? "size-9 px-0" : "h-9 justify-start")}
          >
            <Link href="/home?new=1" aria-label="New project">
              <Plus />
              {!collapsed && <span>New project</span>}
            </Link>
          </Button>
        </RailTooltip>
      </div>

      <nav aria-label="Main" className={cn("shrink-0 space-y-0.5 py-2", collapsed ? "px-2.5" : "px-3")}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <RailTooltip key={href} label={label} show={collapsed}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  collapsed ? "w-9 justify-center" : "px-2.5",
                  active && "bg-sidebar-accent font-medium text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            </RailTooltip>
          );
        })}
      </nav>

      {!collapsed && recent.length > 0 && (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 scrollbar-thin">
          <p className="annotation px-2.5 pb-1.5">Recent</p>
          <ul className="space-y-0.5">
            {recent.map((p) => {
              const active = pathname === `/p/${p.id}`;
              return (
                <li key={p.id}>
                  <Link
                    href={`/p/${p.id}`}
                    className={cn(
                      "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      active && "bg-sidebar-accent text-sidebar-foreground",
                    )}
                  >
                    <StatusDot status={p.status} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {(collapsed || recent.length === 0) && <div className="flex-1" />}

      <div className={cn("shrink-0 space-y-2 border-t border-sidebar-border py-3", collapsed ? "px-2.5" : "px-3")}>
        <RailTooltip label="Settings" show={collapsed}>
          <Link
            href="/settings"
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-lg text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "w-9 justify-center" : "px-2.5",
              pathname.startsWith("/settings") && "bg-sidebar-accent font-medium text-sidebar-foreground",
            )}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
        </RailTooltip>
        {!collapsed && <ThemeSwitcher className="flex w-full" />}
        <UserMenu workspace={workspace} collapsed={collapsed} />
      </div>
    </div>
  );
}

function RailTooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function useModeSwitch(initial: Mode) {
  const [mode, setOptimisticMode] = useOptimistic(initial);
  const [pending, startTransition] = useTransition();
  function change(next: Mode) {
    if (next === mode) return;
    startTransition(async () => {
      setOptimisticMode(next);
      await setMode(next);
      toast(next === "pro" ? "Pro mode is on" : "Simple mode is on", {
        description:
          next === "pro"
            ? "Projects now show files, diffs, logs and the terminal."
            : "Projects show the app and plain-language progress. Code is one click away.",
      });
    });
  }
  return { mode, change, pending };
}

function UserMenu({ workspace, collapsed }: { workspace: ShellWorkspace; collapsed: boolean }) {
  const { mode, change } = useModeSwitch(workspace.mode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-sidebar-accent",
            collapsed ? "size-9 justify-center" : "px-2 py-1.5",
          )}
          aria-label="Account menu"
        >
          <WorkspaceAvatar name={workspace.name} hue={workspace.avatarHue} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{workspace.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {mode === "pro" ? "Pro mode" : "Simple mode"}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{workspace.name}</span>
          {workspace.email && <span className="block truncate text-xs text-muted-foreground">{workspace.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="annotation py-1">Mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => change(v as Mode)}>
          <DropdownMenuRadioItem value="simple" className="items-start">
            <span>
              <span className="block">Simple</span>
              <span className="block text-xs text-muted-foreground">The app and plain-language progress</span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pro" className="items-start">
            <span>
              <span className="block">Pro</span>
              <span className="block text-xs text-muted-foreground">Adds files, diffs, logs and terminal</span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {collapsed && (
          <>
            <DropdownMenuSeparator />
            <div className="px-1.5 py-1">
              <ThemeSwitcher className="flex w-full" />
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
