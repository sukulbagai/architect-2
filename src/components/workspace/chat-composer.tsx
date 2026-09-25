"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, Cpu, FileCode2, FlaskConical, GitCompare, Hammer, Lightbulb, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MODELS } from "@/lib/constants";
import { THEME_IDS, APP_THEMES } from "@/lib/sim/themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "./use-workspace";

type Slash = { cmd: string; arg?: string; about: string; pro?: boolean; ready?: boolean };

export const SLASH_COMMANDS: Slash[] = [
  { cmd: "plan", about: "Switch the chat to Plan mode", ready: true },
  { cmd: "build", about: "Switch the chat to Build mode", ready: true },
  { cmd: "undo", about: "Restore the previous version", ready: true },
  { cmd: "theme", arg: "name", about: "Change the app's theme", ready: true },
  { cmd: "page", arg: "name", about: "Add a page" },
  { cmd: "agent", arg: "name", about: "Add an agent" },
  { cmd: "field", arg: "name", about: "Add a field to the main table", ready: true },
  { cmd: "fix", about: "Fix the first open problem", ready: true },
  { cmd: "test", about: "Run the testing agent once", ready: true },
  { cmd: "deploy", about: "Put this version on a live URL", ready: true },
  { cmd: "review", about: "Turn diff review on or off", pro: true, ready: true },
  { cmd: "terminal", about: "Open the terminal", pro: true, ready: true },
  { cmd: "help", about: "List every command" },
];

type MenuItem = { id: string; label: string; detail?: string; badge?: string; insert: string; run?: boolean };

/** Loose match: every character of the query, in order. */
function fuzzy(text: string, q: string) {
  let i = 0;
  const t = text.toLowerCase();
  for (const c of q.toLowerCase()) {
    i = t.indexOf(c, i);
    if (i < 0) return false;
    i++;
  }
  return true;
}

export function ChatComposer({
  ws,
  isPro,
  mode,
  setMode,
  onSend,
  onOpenDrawer,
}: {
  ws: Workspace;
  isPro: boolean;
  mode: "plan" | "build";
  setMode: (m: "plan" | "build") => void;
  onSend: (text: string, mode: "plan" | "build") => void;
  onOpenDrawer: () => void;
}) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const stage = ws.project.stage;
  const ready = stage === "ready";
  const building = !!ws.build;
  const busy = !!ws.thinking;
  const effective: "plan" | "build" = stage === "plan" ? "plan" : mode;
  const files = useMemo(() => Object.keys(ws.currentVersion?.files ?? {}).sort(), [ws.currentVersion]);
  const model = MODELS.find((m) => m.id === (ws.settings.model ?? "claude-opus-5")) ?? MODELS[0];
  const currentTheme = ws.plan?.ui.theme;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // After picking from the menu, put the caret right after what was inserted, before the next keystroke.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null || !ref.current) return;
    pendingCaret.current = null;
    ref.current.focus();
    ref.current.setSelectionRange(at, at);
  }, [text]);

  // What the popover above the composer shows: slash commands, theme names, or files to mention.
  const menu = useMemo((): { kind: "slash" | "theme" | "file"; items: MenuItem[]; token: string } | null => {
    if (dismissed === text) return null;
    const slash = text.match(/^\/(\w*)$/);
    if (slash) {
      const items = SLASH_COMMANDS.filter((c) => (!c.ready || ready) && c.cmd.startsWith(slash[1].toLowerCase())).map((c) => ({
        id: c.cmd,
        label: `/${c.cmd}${c.arg ? ` ‹${c.arg}›` : ""}`,
        detail: c.about,
        badge: c.pro ? "Pro" : undefined,
        insert: c.arg ? `/${c.cmd} ` : `/${c.cmd}`,
        run: !c.arg,
      }));
      return items.length ? { kind: "slash", items, token: slash[0] } : null;
    }
    const theme = text.match(/^\/theme\s+(\w*)$/i);
    if (theme) {
      const items = THEME_IDS.filter((id) => id.startsWith(theme[1].toLowerCase())).map((id) => ({
        id,
        label: APP_THEMES[id].label,
        detail: id === currentTheme ? "Current theme" : undefined,
        insert: `/theme ${id}`,
        run: true,
      }));
      return items.length ? { kind: "theme", items, token: theme[0] } : null;
    }
    if (isPro && files.length) {
      const mention = text.slice(0, caret).match(/(?:^|\s)@([\w./[\]-]*)$/);
      if (mention) {
        const items = files
          .filter((f) => fuzzy(f, mention[1]))
          .slice(0, 8)
          .map((f) => ({ id: f, label: f.split("/").pop()!, detail: f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "", insert: `@${f} ` }));
        return items.length ? { kind: "file", items, token: `@${mention[1]}` } : null;
      }
    }
    return null;
  }, [text, caret, dismissed, ready, isPro, files, currentTheme]);
  const activeIndex = menu ? Math.min(active, menu.items.length - 1) : 0;

  function edit(value: string, at = value.length) {
    pendingCaret.current = at;
    setText(value);
    setCaret(at);
    setActive(0);
    setHint(null);
  }

  function pick(item: MenuItem) {
    if (!menu) return;
    if (menu.kind === "file") {
      const start = text.slice(0, caret).lastIndexOf(menu.token);
      const value = text.slice(0, start) + item.insert + text.slice(caret);
      edit(value, start + item.insert.length);
      return;
    }
    if (item.run) {
      setText("");
      runSlash(item.insert);
      return;
    }
    edit(item.insert);
  }

  /** Runs a slash command. Returns false when it needs more input. */
  function runSlash(input: string) {
    const m = input.trim().match(/^\/(\w+)\s*(.*)$/);
    if (!m) return false;
    const [, cmd, arg] = [m[0], m[1].toLowerCase(), m[2].trim()];
    const needsArg = (example: string) => {
      edit(`/${cmd} `);
      setHint(`Add a name, like /${cmd} ${example}`);
      return false;
    };
    const proOnly = () => toast("That's a Pro command", { description: "Switch to Pro in the top bar to use the terminal and diff review." });
    const def = SLASH_COMMANDS.find((c) => c.cmd === cmd);
    if (def?.ready && !ready) {
      toast(`/${cmd} works once the app is built`);
      return true;
    }
    switch (cmd) {
      case "plan":
      case "build":
        setMode(cmd);
        break;
      case "undo":
        void ws.undo();
        break;
      case "theme":
        if (!arg) return needsArg("midnight");
        onSend(`Use the ${arg} theme`, effective);
        break;
      case "page":
        if (!arg) return needsArg("reports");
        onSend(`Add a ${arg} page`, effective);
        break;
      case "agent":
        if (!arg) return needsArg("summarizer");
        onSend(`Add a ${arg} agent`, effective);
        break;
      case "field":
        if (!arg) return needsArg("priority");
        onSend(`Add a ${arg} field`, effective);
        break;
      case "fix": {
        const issue = ws.issues[0];
        if (issue) void ws.fixIssue(issue.id);
        else toast("No problems to fix. Nice.");
        break;
      }
      case "test":
        void ws.runTests();
        break;
      case "deploy":
        toast("Deploying arrives in the Ship milestone", { description: "The Deploy button in the top bar will open the deploy sheet." });
        break;
      case "review":
        if (!isPro) proOnly();
        else {
          const on = !ws.settings.reviewChanges;
          void ws.updateSettings({ reviewChanges: on });
          toast(on ? "Diff review is on" : "Diff review is off", { description: on ? "Each change waits as a diff until you accept it." : "Changes apply straight away, as a new version." });
        }
        break;
      case "terminal":
        if (!isPro) proOnly();
        else onOpenDrawer();
        break;
      case "help":
        ws.addLocalMessage({ role: "assistant", kind: "chat", content: "Here's what you can type in the chat:", data: { help: true } });
        break;
      default:
        toast.error(`There's no /${cmd} command`, { description: "Type / to see them all." });
        return false;
    }
    setText("");
    setHint(null);
    return true;
  }

  function submit() {
    const t = text.trim();
    if (!t || busy || building) return;
    if (t.startsWith("/")) {
      runSlash(t);
      return;
    }
    onSend(t, effective);
    setText("");
    setHint(null);
  }

  const placeholder = building
    ? "Building… you can type while you wait"
    : stage === "plan"
      ? "Answer, or tell me what to change in the plan…"
      : effective === "plan"
        ? "Think a change through without touching the code…"
        : isPro
          ? "Ask for a change. / for commands, @ for files"
          : "Ask for a change, or type / for commands";

  return (
    <div className="relative">
      {menu && (
        <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-border bg-popover shadow-float" role="listbox" aria-label={menu.kind === "file" ? "Files" : "Commands"}>
          <p className="annotation border-b border-border px-3 py-1.5">{menu.kind === "file" ? "Mention a file" : menu.kind === "theme" ? "Themes" : "Commands"}</p>
          <ul className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
            {menu.items.map((item, i) => {
              const disabled = item.badge === "Pro" && !isPro;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm",
                      i === activeIndex && "bg-muted",
                      disabled && "opacity-60",
                    )}
                  >
                    {menu.kind === "file" && <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className={cn("shrink-0", menu.kind !== "theme" && "font-mono text-[12.5px]")}>{item.label}</span>
                    {item.detail && <span className="min-w-0 truncate text-xs text-muted-foreground">{item.detail}</span>}
                    {item.badge && <span className="ml-auto shrink-0 rounded-full bg-info-soft px-1.5 py-px text-[10px] font-medium text-info">{item.badge}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div
        className={cn(
          "rounded-xl border bg-card shadow-card transition-colors focus-within:border-foreground/25",
          effective === "plan" && stage === "ready" ? "border-info/40" : "border-border-strong",
        )}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message Architect
        </label>
        {hint && <p className="px-3.5 pt-2.5 text-xs text-muted-foreground">{hint}</p>}
        <textarea
          id="chat-input"
          ref={ref}
          rows={2}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setActive(0);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (menu && !e.nativeEvent.isComposing) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const n = menu.items.length;
                setActive((a) => (Math.min(a, n - 1) + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                const item = menu.items[activeIndex];
                // Enter on a fully typed command runs it; otherwise it picks from the menu.
                if (!(e.key === "Enter" && menu.kind === "slash" && text === item.insert && !item.run)) {
                  e.preventDefault();
                  pick(item);
                  return;
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDismissed(text);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-autocomplete="list"
          className="block max-h-44 min-h-[52px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm leading-relaxed outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            {ready ? (
              <div role="radiogroup" aria-label="Mode" className="flex shrink-0 items-center rounded-lg bg-muted/70 p-0.5">
                {(
                  [
                    { id: "plan", label: "Plan", icon: Lightbulb, tip: "Think it through first. Nothing in the app changes." },
                    { id: "build", label: "Build", icon: Hammer, tip: "Make the change. Every change is saved as a version you can undo." },
                  ] as const
                ).map((o) => (
                  <Tooltip key={o.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={mode === o.id}
                        onClick={() => setMode(o.id)}
                        className={cn(
                          "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                          mode === o.id && "bg-card text-foreground shadow-card dark:bg-accent",
                          mode === o.id && o.id === "plan" && "text-info",
                        )}
                      >
                        <o.icon className="size-3" />
                        {o.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56">{o.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-info-soft px-2 text-xs font-medium text-info">
                    <Lightbulb className="size-3" />
                    {building ? "Building" : "Planning"}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">
                  {building ? "Watch the steps above. You can stop at any time." : "Messages change the plan. Nothing is built until you click Build this."}
                </TooltipContent>
              </Tooltip>
            )}
            {ready && isPro && (
              <Toggle
                on={!!ws.settings.reviewChanges}
                label="Review changes"
                tip="Review each change as a diff before it's applied"
                tone="info"
                onClick={() => void ws.updateSettings({ reviewChanges: !ws.settings.reviewChanges })}
              >
                <GitCompare />
              </Toggle>
            )}
            {ready && (
              <Toggle
                on={ws.testAfterChanges}
                label="Test after each change"
                tip="Test after each change: a testing agent checks the app in a browser and fixes what it finds. Adds a few seconds."
                tone="success"
                onClick={() => void ws.updateSettings({ testAfterChanges: !ws.testAfterChanges })}
              >
                <FlaskConical />
              </Toggle>
            )}
            {isPro && !building && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Model: ${model.label}`}
                      >
                        <Cpu className="size-3 shrink-0" />
                        <span className="truncate">{model.label.replace(/^Claude /, "")}</span>
                        <ChevronDown className="size-3 shrink-0 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>The model Architect builds with</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel className="annotation py-1">Build with</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={model.id} onValueChange={(v) => void ws.updateSettings({ model: v })}>
                    {MODELS.map((m) => (
                      <DropdownMenuRadioItem key={m.id} value={m.id} className="items-start">
                        <span>
                          <span className="block">{m.label}</span>
                          <span className="block text-xs text-muted-foreground">{m.note}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {building ? (
            <Button size="icon-sm" variant="outline" onClick={() => void ws.stop()} aria-label="Stop building" className="shrink-0 rounded-full">
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              onClick={submit}
              disabled={!text.trim() || busy}
              aria-label="Send"
              className={cn("shrink-0 rounded-full", text.trim() && !busy ? "bg-brand text-brand-foreground hover:bg-brand/90" : "")}
            >
              {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  on,
  label,
  tip,
  tone,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  tip: string;
  tone: "info" | "success";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={onClick}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5",
            on && tone === "info" && "bg-info-soft text-info hover:bg-info-soft hover:text-info",
            on && tone === "success" && "bg-success-soft text-success hover:bg-success-soft hover:text-success",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        {tip}
        <span className="mt-0.5 block opacity-70">{on ? "On" : "Off"}</span>
      </TooltipContent>
    </Tooltip>
  );
}
