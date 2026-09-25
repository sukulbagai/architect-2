"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  Bot,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  FileText,
  FlaskConical,
  GitCompare,
  Hammer,
  History,
  Lightbulb,
  Monitor,
  MoreHorizontal,
  MousePointerClick,
  PanelBottom,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  Rocket,
  Settings2,
  Share2,
  Smartphone,
  Tablet,
  Undo2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { renameProject } from "@/lib/actions/projects";
import type { ClientMessage, ClientVersion } from "@/lib/actions/build";
import type { Mode } from "@/db/schema";
import type { EditTarget } from "@/lib/sim/visual";
import type { Plan } from "@/lib/sim/types";
import { LogoMark } from "@/components/brand/logo";
import { StatusBadge } from "@/components/common/status-badge";
import { useModeSwitch } from "@/components/shell/app-shell";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { useCommandPalette, useRegisterCommands, type CommandItem } from "@/components/command/command-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type TabId, type WorkspaceProject } from "./use-workspace";
import { ChatMessages } from "./chat-messages";
import { ChatComposer } from "./chat-composer";
import { PreviewPanel, type Device } from "./stage-preview";
import { CodePanel } from "./stage-code";
import { PlanPanel } from "./plan-panel";
import { ReviewPanel } from "./review-panel";
import { AgentsPanel, DataPanel, SettingsPanel, VersionsPanel } from "./stage-panels";
import { BottomDrawer, DRAWER_MAX, DRAWER_MIN, type DrawerTab } from "./bottom-drawer";

const TABS: { id: TabId; label: string; icon: typeof AppWindow; pro?: boolean }[] = [
  { id: "preview", label: "Preview", icon: AppWindow },
  { id: "review", label: "Review", icon: GitCompare, pro: true },
  { id: "plan", label: "Plan", icon: FileText },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "data", label: "Data", icon: Database },
  { id: "code", label: "Code", icon: Code2, pro: true },
  { id: "versions", label: "Versions", icon: History },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const CHAT_KEY = "architect:chat-width";
const DRAWER_KEY = "architect:drawer";

function isTyping(el: Element | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest(".cm-editor"));
}

export function Workspace(props: {
  project: WorkspaceProject;
  plan: Plan | null;
  messages: ClientMessage[];
  versions: ClientVersion[];
  currentVersionId: string | null;
  freshMessageId: string | null;
  autoBuild: boolean;
  mode: Mode;
  user: string;
}) {
  const router = useRouter();
  const { mode, change } = useModeSwitch(props.mode);
  const isPro = mode === "pro";
  const [mobileView, setMobileView] = useState<"chat" | "app">("chat");
  const ws = useWorkspace(props, mode, () => setMobileView("app"));
  const palette = useCommandPalette();
  const [chatMode, setChatMode] = useState<"plan" | "build">("build");
  const [device, setDevice] = useState<Device>("desktop");
  const [nonce, setNonce] = useState(0);
  const [route, setRoute] = useState<string | null>(null);
  const [width, setWidth] = useState(400);
  const [chatHidden, setChatHidden] = useState(false);
  const [showCodeInSimple, setShowCodeInSimple] = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; height: number; tab: DrawerTab }>({ open: false, height: 240, tab: "terminal" });
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [selectOn, setSelectOnState] = useState(false);
  const [selectTarget, setSelectTarget] = useState<EditTarget | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const hasReview = isPro && !!ws.pendingProposal;
  const hasCode = isPro || showCodeInSimple;
  const visibleTabs = TABS.filter((t) => (t.id === "review" ? hasReview : t.id === "code" ? hasCode : true));
  const tab = visibleTabs.some((t) => t.id === ws.tab) ? ws.tab : "preview";
  const previewingOld = !!ws.previewVersionId && ws.previewVersionId !== ws.currentVersionId;
  const canSelect = ws.project.stage === "ready" && !ws.build && !!ws.currentVersionId && !previewingOld;
  const selecting = selectOn && canSelect && tab === "preview";

  const setWsTab = ws.setTab;
  const setSelectOn = useCallback(
    (on: boolean) => {
      setSelectOnState(on);
      if (!on) setSelectTarget(null);
      if (on) {
        setWsTab("preview");
        setMobileView("app");
      }
    },
    [setWsTab],
  );

  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(CHAT_KEY));
      const d = JSON.parse(localStorage.getItem(DRAWER_KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore per-browser preferences
      if (w >= 320 && w <= 560) setWidth(w);
      if (d && typeof d.height === "number") {
        setDrawer({ open: !!d.open, height: Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, d.height)), tab: ["terminal", "logs", "problems"].includes(d.tab) ? d.tab : "terminal" });
        if (d.open) setDrawerMounted(true);
      }
    } catch {}
  }, []);

  const saveDrawer = useCallback((next: { open: boolean; height: number; tab: DrawerTab }) => {
    setDrawer(next);
    if (next.open) setDrawerMounted(true);
    try {
      localStorage.setItem(DRAWER_KEY, JSON.stringify(next));
    } catch {}
  }, []);
  const toggleDrawer = useCallback(
    (tabId?: DrawerTab) => saveDrawer({ ...drawer, open: tabId ? true : !drawer.open, tab: tabId ?? drawer.tab }),
    [drawer, saveDrawer],
  );

  // Keep the conversation pinned to the latest message.
  const building = !!ws.build;
  const uiStep = ws.build?.steps.ui.status;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [ws.messages.length, ws.thinking, building, uiStep, ws.hiddenId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "\\") {
        e.preventDefault();
        setChatHidden((h) => !h);
      } else if (meta && e.key.toLowerCase() === "j" && isPro) {
        e.preventDefault();
        toggleDrawer();
      } else if (!meta && !e.altKey && e.key.toLowerCase() === "v" && tab === "preview" && canSelect && !isTyping(document.activeElement) && !document.querySelector("[role=dialog]:not([aria-label='Edit element'])")) {
        e.preventDefault();
        setSelectOn(!selectOn);
      } else if (e.key === "Escape" && selectOn && !document.querySelector("[role=dialog]:not([aria-label='Edit element'])")) {
        setSelectOn(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPro, tab, canSelect, selectOn, setSelectOn, toggleDrawer]);

  const onRoute = useCallback((page: string) => setRoute(page), []);

  function startDrag(e: React.PointerEvent) {
    const startX = e.clientX;
    const startW = width;
    let latest = startW;
    const move = (ev: PointerEvent) => {
      latest = Math.min(560, Math.max(320, startW + ev.clientX - startX));
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      try {
        localStorage.setItem(CHAT_KEY, String(latest));
      } catch {}
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const send = (text: string, m: "plan" | "build") => {
    setMobileView("chat");
    void ws.send(text, m);
  };

  // ---------------------------------------------------------------------------------------------
  // ⌘K: what this project adds to the command palette

  const { issues, pendingProposal, project, plan, previousVersion, versions, currentVersionId, currentVersion, settings } = ws;
  const { fixIssue, runBuild, setTab, undo, restore, openCode, runTests, updateSettings } = ws;
  const buildNow = project.stage === "plan" && !!plan && !ws.build;
  const suggestions = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = [];
    if (pendingProposal && isPro) out.push({ id: "review", label: "Review the proposed change", icon: GitCompare, run: () => setTab("review") });
    if (issues[0]) out.push({ id: "fix", label: `Fix it: ${issues[0].plain}`, icon: Wrench, run: () => void fixIssue(issues[0].id) });
    if (buildNow) out.push({ id: "build", label: "Build this", icon: Hammer, run: () => void runBuild() });
    if (out.length === 0) out.push({ id: "new", label: "New project", icon: Plus, run: () => router.push("/home?new=1") });
    return out;
  }, [pendingProposal, isPro, issues, buildNow, setTab, fixIssue, runBuild, router]);
  useRegisterCommands("suggestions", suggestions);

  // Memoised by the React Compiler; registering re-renders only the palette.
  const ready = project.stage === "ready";
  const others = versions.filter((v) => v.id !== currentVersionId).sort((a, b) => b.number - a.number);
  const paths = Object.keys(currentVersion?.files ?? {}).sort();
  const commands: CommandItem[] = [
    ...visibleTabs.map((t) => ({
      id: `tab-${t.id}`,
      label: `Go to ${t.label}`,
      icon: t.icon,
      keywords: ["tab", "stage", "open"],
      run: () => {
        setTab(t.id);
        setMobileView("app");
      },
    })),
    { id: "chat", label: chatHidden ? "Show the chat" : "Hide the chat", icon: chatHidden ? PanelLeftOpen : PanelLeftClose, shortcut: ["⌘", "\\"], run: () => setChatHidden((h) => !h) },
    ...(isPro ? [{ id: "drawer", label: drawer.open ? "Hide the drawer" : "Show terminal, logs and problems", icon: PanelBottom, shortcut: ["⌘", "J"], run: () => toggleDrawer() }] : []),
    ...(canSelect ? [{ id: "select", label: "Select an element to edit", icon: MousePointerClick, shortcut: ["V"], run: () => setSelectOn(true) }] : []),
    ...(previousVersion ? [{ id: "undo", label: "Undo last change", icon: Undo2, hint: `Back to v${previousVersion.number}`, run: () => void undo() }] : []),
    ...(others.length
      ? [
          {
            id: "restore",
            label: "Restore a version…",
            icon: History,
            children: {
              placeholder: "Pick a version to restore…",
              items: others.map((v) => ({ id: `v-${v.id}`, label: `v${v.number} · ${v.summary}`, hint: timeAgo(v.createdAt), run: () => void restore(v.id) })),
            },
          },
        ]
      : []),
    ...(isPro && paths.length
      ? [
          {
            id: "open-file",
            label: "Open file…",
            icon: FileCode2,
            children: { placeholder: "Search files…", items: paths.map((p) => ({ id: `file-${p}`, label: p, run: () => openCode(p) })) },
          },
        ]
      : []),
    ...(ready
      ? [
          {
            id: "chat-mode",
            label: chatMode === "build" ? "Switch the chat to Plan mode" : "Switch the chat to Build mode",
            icon: chatMode === "build" ? Lightbulb : Hammer,
            run: () => setChatMode((m) => (m === "build" ? "plan" : "build")),
          },
          { id: "test", label: "Run the testing agent", icon: FlaskConical, run: () => void runTests() },
        ]
      : []),
    ...(ready && isPro
      ? [
          {
            id: "review-setting",
            label: settings.reviewChanges ? "Turn off diff review" : "Turn on diff review",
            icon: GitCompare,
            run: () => void updateSettings({ reviewChanges: !settings.reviewChanges }),
          },
        ]
      : []),
  ];
  useRegisterCommands("workspace", commands);

  const pages = ws.plan?.pages ?? [];
  const currentRoute = pages.find((p) => p.id === route) ?? pages[0];
  const deployable = ws.project.stage === "ready" && !ws.build;
  const showPreviewTools = tab === "preview" && pages.length > 0 && (ws.currentVersionId || ws.build?.previewReady);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 sm:gap-3 sm:px-3">
        <Link href="/projects" className="rounded-md" aria-label="Back to projects">
          <LogoMark className="size-6" />
        </Link>
        <span className="text-border-strong">/</span>
        <ProjectName id={ws.project.id} name={ws.project.name} onRenamed={(name) => ws.setProject((p) => ({ ...p, name }))} />
        <StatusBadge status={ws.build ? "building" : ws.project.status} className="hidden md:inline-flex" />

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <div role="radiogroup" aria-label="Mode" className="hidden items-center rounded-lg border border-border bg-muted/60 p-0.5 sm:flex">
            {(["simple", "pro"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => change(m)}
                className={cn(
                  "h-6 rounded-md px-2.5 text-xs font-medium text-muted-foreground capitalize transition-colors hover:text-foreground",
                  mode === m && "bg-card text-foreground shadow-card dark:bg-accent",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={palette.open}
                aria-label="Search and commands"
                aria-keyshortcuts="Meta+K"
                className="hidden h-7 items-center rounded-md border border-border bg-card px-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:inline-flex"
              >
                ⌘K
              </button>
            </TooltipTrigger>
            <TooltipContent>Search and commands</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="GitHub" onClick={() => toast("GitHub sync arrives in the GitHub milestone")}>
                <GithubGlyph className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect GitHub</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => toast("Sharing arrives in a later milestone")}>
            <Share2 />
            Share
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  disabled={!deployable}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                  onClick={() => toast("Deploying arrives in the Ship milestone", { description: "The deploy sheet with pre-flight checks, logs and a live URL comes next." })}
                >
                  <Rocket />
                  Deploy
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{deployable ? "Put this version on a live URL" : ws.build ? "Wait for the build to finish" : "Build the app first"}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex h-10 shrink-0 items-center border-b border-border p-1 md:hidden" role="tablist" aria-label="View">
        {(["chat", "app"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={mobileView === v}
            onClick={() => setMobileView(v)}
            className={cn("relative h-8 flex-1 rounded-md text-sm text-muted-foreground capitalize", mobileView === v && "bg-muted font-medium text-foreground")}
          >
            {v === "chat" ? "Chat" : "App"}
            {v === "app" && ws.issues.length > 0 && <span className="absolute top-2 ml-1 size-1.5 rounded-full bg-destructive" aria-label="The app has a problem" />}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "min-h-0 flex-col border-border md:flex md:border-r",
            mobileView === "chat" ? "flex w-full md:w-auto" : "hidden",
            chatHidden && "md:hidden",
          )}
          style={{ ["--chat-w" as string]: `${width}px` }}
        >
          <div className="flex min-h-0 w-full flex-1 flex-col md:w-[var(--chat-w)]">
            <StageStepper stage={ws.build ? "build" : ws.project.stage} />
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 scrollbar-thin">
              <ChatMessages ws={ws} isPro={isPro} onSend={send} />
            </div>
            <div className="p-3 pt-0">
              <ChatComposer ws={ws} isPro={isPro} mode={chatMode} setMode={setChatMode} onSend={send} onOpenDrawer={() => toggleDrawer("terminal")} />
            </div>
          </div>
        </aside>
        {!chatHidden && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat"
            onPointerDown={startDrag}
            className="relative -ml-px hidden w-1 shrink-0 cursor-col-resize transition-colors hover:bg-brand/40 md:block"
          />
        )}

        <section className={cn("min-w-0 flex-1 flex-col md:flex", mobileView === "app" ? "flex" : "hidden")}>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="hidden text-muted-foreground md:inline-flex" aria-label={chatHidden ? "Show chat" : "Hide chat"} onClick={() => setChatHidden((h) => !h)}>
                  {chatHidden ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {chatHidden ? "Show chat" : "Hide chat"} <span className="opacity-60">⌘\</span>
              </TooltipContent>
            </Tooltip>
            <div role="tablist" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-thin">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => ws.setTab(id)}
                  className={cn(
                    "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    tab === id && "bg-muted font-medium text-foreground",
                    id === "review" && tab !== id && "text-brand-text",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                  {id === "review" && ws.pendingProposal && (
                    <span className="min-w-4 rounded-full bg-brand px-1 text-center font-mono text-[10px] leading-4 text-brand-foreground" aria-label={`${ws.pendingProposal.data.files.length} files`}>
                      {ws.pendingProposal.data.files.length}
                    </span>
                  )}
                  {id === "plan" && ws.planDirty && <span className="size-1.5 rounded-full bg-warning" aria-label="Unapplied changes" />}
                  {id === "code" && ws.build && <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-label="Writing files" />}
                </button>
              ))}
              {!isPro && !showCodeInSimple && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="More" className="text-muted-foreground">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onSelect={() => {
                        setShowCodeInSimple(true);
                        ws.setTab("code");
                      }}
                    >
                      <Code2 />
                      View code
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {showPreviewTools && (
              <div className="flex shrink-0 items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="hidden h-7 max-w-52 items-center gap-1.5 truncate rounded-md border border-border bg-card px-2 text-xs text-muted-foreground hover:text-foreground lg:inline-flex" aria-label="Go to page">
                      <span className="font-mono">/{currentRoute === pages[0] ? "" : currentRoute?.id}</span>
                      <span className="truncate text-foreground">{currentRoute?.name}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="annotation py-1">Pages</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={currentRoute?.id} onValueChange={(v) => ws.setPreviewPage(v)}>
                      {pages.map((p, i) => (
                        <DropdownMenuRadioItem key={p.id} value={p.id}>
                          <span className="flex-1">{p.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">/{i === 0 ? "" : p.id}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="hidden items-center md:flex" role="radiogroup" aria-label="Device size">
                  {(
                    [
                      { id: "desktop", icon: Monitor, label: "Desktop" },
                      { id: "tablet", icon: Tablet, label: "Tablet" },
                      { id: "mobile", icon: Smartphone, label: "Phone" },
                    ] as const
                  ).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={device === id}
                      aria-label={label}
                      title={label}
                      onClick={() => setDevice(id)}
                      className={cn("inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground", device === id && "bg-muted text-foreground")}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  ))}
                </div>
                {canSelect && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Select an element to edit"
                        aria-pressed={selecting}
                        aria-keyshortcuts="V"
                        onClick={() => setSelectOn(!selectOn)}
                        className={cn("text-muted-foreground", selecting && "bg-brand-soft text-brand-text hover:bg-brand-soft hover:text-brand-text")}
                      >
                        <MousePointerClick />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {selecting ? "Stop selecting" : "Select an element to edit it"} <span className="opacity-60">V</span>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button variant="ghost" size="icon-sm" aria-label="Reload preview" title="Reload" className="text-muted-foreground" onClick={() => setNonce((n) => n + 1)}>
                  <RotateCw />
                </Button>
                <Button asChild variant="ghost" size="icon-sm" aria-label="Open in a new tab" title="Open in a new tab" className="text-muted-foreground">
                  <a href={`/p/${ws.project.id}/preview${ws.currentVersionId ? `?v=${ws.currentVersionId}` : "?draft=1"}`} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </div>
            )}
            {isPro && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Terminal, logs and problems"
                    aria-pressed={drawer.open}
                    aria-keyshortcuts="Meta+J"
                    onClick={() => toggleDrawer()}
                    className={cn("relative shrink-0 text-muted-foreground", drawer.open && "bg-muted text-foreground")}
                  >
                    <PanelBottom />
                    {!drawer.open && ws.issues.length > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Terminal, logs and problems <span className="opacity-60">⌘J</span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className={cn("relative min-h-0 flex-1", tab === "preview" ? "bg-sunken" : "bg-background", tab !== "code" && tab !== "review" && "overflow-y-auto scrollbar-thin")}>
            {tab === "preview" && <div className="bg-grid-major pointer-events-none absolute inset-0" />}
            <div className="relative h-full">
              {tab === "preview" && (
                <PreviewPanel
                  ws={ws}
                  device={device}
                  nonce={nonce}
                  route={route}
                  onRoute={onRoute}
                  isPro={isPro}
                  select={{ on: selecting, setOn: setSelectOn, target: selectTarget, setTarget: setSelectTarget }}
                />
              )}
              {tab === "review" && <ReviewPanel ws={ws} />}
              {tab === "plan" && <PlanPanel ws={ws} isPro={isPro} />}
              {tab === "agents" && <AgentsPanel ws={ws} isPro={isPro} />}
              {tab === "data" && <DataPanel ws={ws} isPro={isPro} />}
              {tab === "code" && <CodePanel ws={ws} isPro={isPro} />}
              {tab === "versions" && <VersionsPanel ws={ws} isPro={isPro} />}
              {tab === "settings" && <SettingsPanel ws={ws} isPro={isPro} />}
            </div>
          </div>
          {isPro && drawerMounted && (
            <BottomDrawer
              ws={ws}
              user={props.user}
              open={drawer.open}
              height={drawer.height}
              onResize={(h) => setDrawer((d) => ({ ...d, height: h }))}
              onResizeEnd={(h) => saveDrawer({ ...drawer, height: h })}
              tab={drawer.tab}
              onTab={(t) => saveDrawer({ ...drawer, tab: t })}
              onClose={() => saveDrawer({ ...drawer, open: false })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function StageStepper({ stage }: { stage: "plan" | "build" | "ready" }) {
  const steps = [
    { id: "plan", label: "Plan" },
    { id: "build", label: "Build" },
    { id: "ship", label: "Ship" },
  ];
  const index = stage === "plan" ? 0 : stage === "build" ? 1 : 2;
  return (
    <ol className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              i < index && "text-muted-foreground",
              i === index && "font-medium text-foreground",
              i > index && "text-subtle-foreground",
            )}
            aria-current={i === index ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full font-mono text-[9px]",
                i < index && "bg-foreground text-background",
                i === index && "bg-brand text-brand-foreground",
                i > index && "border border-border-strong",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function ProjectName({ id, name, onRenamed }: { id: string; name: string; onRenamed: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    const next = value.trim();
    if (!next || next === name) {
      setValue(name);
      return;
    }
    startTransition(async () => {
      try {
        await renameProject(id, next);
        onRenamed(next);
      } catch {
        setValue(name);
        toast.error("Couldn't rename the project");
      }
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        maxLength={80}
        aria-label="Project name"
        className="h-7 w-40 rounded-md border border-ring bg-card px-2 text-sm font-medium outline-none sm:w-56"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="h-7 max-w-40 truncate rounded-md px-2 text-sm font-medium transition-colors hover:bg-muted sm:max-w-64" title="Rename">
      {name}
    </button>
  );
}
