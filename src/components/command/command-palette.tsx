"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Blocks,
  Bot,
  ChevronRight,
  Compass,
  FolderInput,
  FolderKanban,
  Gauge,
  House,
  Keyboard,
  LayoutTemplate,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  ToggleLeft,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { listProjects } from "@/lib/actions/projects";
import type { Mode, ProjectStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/common/status-badge";
import { useModeSwitch } from "@/components/shell/app-shell";
import { defaultFilter } from "cmdk";
import { Command, CommandGroup, CommandInput, CommandItem as Item, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useRegisteredCommands, type CommandItem } from "./command-provider";

type ProjectRow = { id: string; name: string; status: ProjectStatus; stage: string };

const NAV = [
  { href: "/home", label: "Home", icon: House },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/integrations", label: "Integrations", icon: Blocks },
  { href: "/usage", label: "Usage", icon: Gauge },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span data-slot="command-shortcut" className="ml-auto flex items-center gap-0.5">
      {keys.map((k) => (
        <Kbd key={k} className="h-[18px] min-w-[18px] bg-muted px-1 font-mono text-[10.5px]">
          {k}
        </Kbd>
      ))}
    </span>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  registry,
  mode: initialMode,
  onShortcuts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registry: Parameters<typeof useRegisteredCommands>[0];
  mode: Mode;
  onShortcuts: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const { mode, change } = useModeSwitch(initialMode);
  const registered = useRegisteredCommands(registry);
  const [search, setSearch] = useState("");
  const [stack, setStack] = useState<CommandItem[]>([]);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listProjects()
      .then((rows) => !cancelled && setProjects(rows))
      .catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  function setOpen(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setSearch("");
      setStack([]);
    }
  }

  function run(item: CommandItem) {
    if (item.children) {
      setStack((s) => [...s, item]);
      setSearch("");
      return;
    }
    setOpen(false);
    // Let the dialog close first, so focus lands where the command sends it.
    setTimeout(() => item.run?.(), 0);
  }

  const go = (href: string) => () => startTransition(() => router.push(href));

  const groups = useMemo(() => {
    const out: { id: string; heading: string; items: CommandItem[] }[] = [];
    out.push({
      id: "suggestions",
      heading: "Suggestions",
      items: registered.suggestions ?? [{ id: "new-project", label: "New project", icon: Plus, run: go("/home?new=1"), keywords: ["create", "start", "build"] }],
    });
    out.push({
      id: "navigate",
      heading: "Navigate",
      items: NAV.map((n) => ({ id: `nav-${n.href}`, label: n.label, icon: n.icon, run: go(n.href), hint: pathname === n.href ? "You're here" : undefined, keywords: ["go to"] })),
    });
    if (projects?.length) {
      const list = search ? projects : projects.slice(0, 8);
      out.push({
        id: "projects",
        heading: "Projects",
        items: list.map((p) => ({
          id: `project-${p.id}`,
          label: p.name,
          leading: (
            <span className="flex size-4 items-center justify-center">
              <StatusDot status={p.status} />
            </span>
          ),
          hint: pathname === `/p/${p.id}` ? "Open now" : p.stage === "plan" ? "Planning" : p.status === "live" ? "Live" : "Draft",
          run: go(`/p/${p.id}`),
          keywords: ["project", "open"],
        })),
      });
    }
    out.push({
      id: "create",
      heading: "Create",
      items: [
        { id: "create-project", label: "New project", icon: Plus, run: go("/home?new=1"), keywords: ["create", "start"] },
        { id: "create-template", label: "Start from a template", icon: LayoutTemplate, run: go("/explore"), keywords: ["template", "gallery"] },
        { id: "create-import", label: "Import a repository", icon: FolderInput, run: go("/import"), keywords: ["github", "git", "zip", "url", "repo", "existing"] },
        { id: "create-consultant", label: "Ask the Consultant", icon: Sparkles, run: go("/home?consultant=1"), keywords: ["ideas", "help", "what to build"] },
      ],
    });
    if (registered.workspace?.length) out.push({ id: "workspace", heading: "This project", items: registered.workspace });
    out.push({
      id: "preferences",
      heading: "Preferences",
      items: [
        ...(registered.preferences ?? [
          {
            id: "mode",
            label: mode === "pro" ? "Switch to Simple" : "Switch to Pro",
            icon: ToggleLeft,
            hint: mode === "pro" ? "Hide code, diffs and the terminal" : "Show files, diffs and the terminal",
            run: () => change(mode === "pro" ? "simple" : "pro"),
            keywords: ["mode", "simple", "pro", "developer"],
          },
        ]),
        { id: "theme-light", label: "Theme: Light", icon: Sun, run: () => setTheme("light"), keywords: ["appearance"] },
        { id: "theme-dark", label: "Theme: Dark", icon: Moon, run: () => setTheme("dark"), keywords: ["appearance", "night"] },
        { id: "theme-system", label: "Theme: System", icon: Monitor, run: () => setTheme("system"), keywords: ["appearance", "auto"] },
      ],
    });
    out.push({
      id: "account",
      heading: "Account",
      items: [
        { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: ["?"], run: onShortcuts, keywords: ["help", "keys"] },
        { id: "sign-out", label: "Sign out", icon: LogOut, run: () => void signOut(), keywords: ["log out"] },
      ],
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is recreated each render but only closes over the router
  }, [registered, projects, search, pathname, mode, change, setTheme, onShortcuts]);

  const page = stack[stack.length - 1];

  // We rank results ourselves (cmdk's matcher, our order): the best match's group comes first and
  // its best item is selected, so typing a few letters and pressing Enter does the obvious thing.
  const shown = useMemo(() => {
    const list = page ? [{ id: "page", heading: "", items: page.children!.items }] : groups;
    const q = search.trim();
    if (!q) return list;
    return list
      .map((g) => {
        const scored = g.items
          .map((item) => ({ item, score: defaultFilter(item.label, q, item.keywords ?? []) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);
        return { ...g, items: scored.map((x) => x.item), best: scored[0]?.score ?? 0 };
      })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => b.best - a.best);
  }, [page, groups, search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden rounded-xl! p-0 sm:max-w-[560px]" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search for a page, project or action.</DialogDescription>
        <Command
          className="rounded-none! bg-popover p-0"
          shouldFilter={false}
          loop
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !search && stack.length) {
              e.preventDefault();
              setStack((s) => s.slice(0, -1));
            }
          }}
        >
          <div className="flex items-center gap-1.5 border-b border-border px-2 pt-2 pb-2">
            {page && (
              <button
                type="button"
                onClick={() => setStack((s) => s.slice(0, -1))}
                className="ml-1 inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-muted px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={`Back from ${page.label}`}
              >
                {page.label.replace(/…$/, "")}
                <ChevronRight className="size-3" />
              </button>
            )}
            <div className="min-w-0 flex-1 [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent">
              <CommandInput value={search} onValueChange={setSearch} placeholder={page?.children?.placeholder ?? "Type a command or search…"} className="h-9" />
            </div>
          </div>
          <CommandList className="max-h-[min(420px,60dvh)] scroll-py-2 p-1.5 scrollbar-thin">
            {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nothing matches “{search}”.</p>}
            {shown.map((g, i) =>
              g.items.length ? (
                <Fragment key={g.id}>
                  {i > 0 && <CommandSeparator className="my-1" />}
                  <CommandGroup heading={g.heading || undefined}>
                    {g.items.map((item) => (
                      <Row key={`${g.id}-${item.id}`} item={item} onRun={run} />
                    ))}
                  </CommandGroup>
                </Fragment>
              ) : null,
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd className="h-4 min-w-4 text-[10px]">↑</Kbd>
              <Kbd className="h-4 min-w-4 text-[10px]">↓</Kbd>
              to move
            </span>
            <span className="flex items-center gap-1">
              <Kbd className="h-4 min-w-4 text-[10px]">↵</Kbd>
              to run
            </span>
            {page && (
              <span className="flex items-center gap-1">
                <Kbd className="h-4 text-[10px]">⌫</Kbd>
                to go back
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              <Kbd className="h-4 text-[10px]">esc</Kbd>
              to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Row({ item, onRun }: { item: CommandItem; onRun: (item: CommandItem) => void }) {
  const Icon = item.icon;
  return (
    <Item value={item.id} onSelect={() => onRun(item)} className="h-9 gap-2.5 rounded-lg! px-2.5">
      {item.leading ?? (Icon ? <Icon className="size-4 text-muted-foreground" /> : <span className="size-4" />)}
      <span className="truncate">{item.label}</span>
      {item.shortcut ? (
        <Keys keys={item.shortcut} />
      ) : item.children ? (
        <span data-slot="command-shortcut" className="ml-auto">
          <ChevronRight className={cn("size-3.5 text-muted-foreground")} />
        </span>
      ) : item.hint ? (
        <span data-slot="command-shortcut" className="ml-auto shrink-0 truncate pl-3 text-xs tracking-normal text-muted-foreground">
          {item.hint}
        </span>
      ) : null}
    </Item>
  );
}
