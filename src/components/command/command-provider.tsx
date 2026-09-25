"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Mode } from "@/db/schema";
import { CommandPalette } from "./command-palette";
import { ShortcutsDialog } from "./shortcuts-dialog";

export type CommandItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Replaces the icon, e.g. a project's status dot. */
  leading?: React.ReactNode;
  /** Keys shown on the right, e.g. ["⌘", "J"]. */
  shortcut?: string[];
  /** Muted text on the right, when there's no shortcut. */
  hint?: string;
  keywords?: string[];
  run?: () => void;
  /** Opens a nested list instead of running, e.g. "Open file…". */
  children?: { placeholder: string; items: CommandItem[] };
};

/**
 * Groups other parts of the app can register while they're mounted. Registering "suggestions" or
 * "preferences" replaces the palette's defaults for that group.
 */
export type CommandGroupId = "suggestions" | "workspace" | "preferences";

type Registry = Partial<Record<CommandGroupId, CommandItem[]>>;

/** A tiny external store, so registering commands re-renders the palette and nothing else. */
function createRegistry() {
  let state: Registry = {};
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(group: CommandGroupId, items: CommandItem[] | undefined) {
      state = { ...state, [group]: items };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

type Ctx = {
  registry: ReturnType<typeof createRegistry>;
  open: () => void;
  openShortcuts: () => void;
};

const CommandContext = createContext<Ctx | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandContext);
  return { open: ctx?.open ?? (() => {}), openShortcuts: ctx?.openShortcuts ?? (() => {}) };
}

/** Registers commands for as long as the calling component is mounted. Pass memoised items. */
export function useRegisterCommands(group: CommandGroupId, items: CommandItem[]) {
  const ctx = useContext(CommandContext);
  const registry = ctx?.registry;
  useEffect(() => {
    registry?.set(group, items);
  }, [registry, group, items]);
  useEffect(() => () => registry?.set(group, undefined), [registry, group]);
}

export function useRegisteredCommands(registry: Ctx["registry"]) {
  return useSyncExternalStore(registry.subscribe, registry.get, registry.get);
}

function isTyping(el: Element | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest(".cm-editor"));
}

/** ⌘K everywhere signed in, and ? for the keyboard shortcuts. */
export function CommandProvider({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const [registry] = useState(createRegistry);
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      const question = e.key === "?" || (e.key === "/" && e.shiftKey);
      if (question && !e.metaKey && !e.ctrlKey && !isTyping(document.activeElement) && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        setShortcuts(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);
  const openShortcuts = useCallback(() => {
    setOpen(false);
    setShortcuts(true);
  }, []);
  const value = useMemo(() => ({ registry, open: openPalette, openShortcuts }), [registry, openPalette, openShortcuts]);

  return (
    <CommandContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} registry={registry} mode={mode} onShortcuts={openShortcuts} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </CommandContext.Provider>
  );
}
