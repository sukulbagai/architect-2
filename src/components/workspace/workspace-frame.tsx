"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AppWindow,
  Bot,
  Code2,
  Database,
  FileText,
  History,
  Monitor,
  Settings2,
  Share2,
  Smartphone,
  Tablet,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { renameProject } from "@/lib/actions/projects";
import { LogoMark } from "@/components/brand/logo";
import { StatusBadge } from "@/components/common/status-badge";
import { useModeSwitch } from "@/components/shell/app-shell";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Mode, ProjectSettings, ProjectStage, ProjectStatus } from "@/db/schema";

type FrameProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  stage: ProjectStage;
  stack: string;
  settings: ProjectSettings;
};

type FrameMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  kind: string;
  content: string;
  data: unknown;
  createdAt: Date;
};

const TABS = [
  { id: "preview", label: "Preview", icon: AppWindow, pro: false },
  { id: "plan", label: "Plan", icon: FileText, pro: false },
  { id: "agents", label: "Agents", icon: Bot, pro: false },
  { id: "data", label: "Data", icon: Database, pro: false },
  { id: "code", label: "Code", icon: Code2, pro: true },
  { id: "versions", label: "Versions", icon: History, pro: false },
  { id: "settings", label: "Settings", icon: Settings2, pro: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WorkspaceFrame({
  project,
  messages,
  mode: initialMode,
}: {
  project: FrameProject;
  messages: FrameMessage[];
  mode: Mode;
}) {
  const { mode, change } = useModeSwitch(initialMode);
  const [tab, setTab] = useState<TabId>("preview");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const isPro = mode === "pro";
  const visibleTabs = TABS.filter((t) => !t.pro || isPro);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : "preview";

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link href="/projects" className="rounded-md" aria-label="Back to projects">
          <LogoMark className="size-6" />
        </Link>
        <span className="text-border-strong">/</span>
        <ProjectName id={project.id} name={project.name} />
        <StatusBadge status={project.status} className="hidden sm:inline-flex" />

        <div className="ml-auto flex items-center gap-1.5">
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
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="GitHub"
                onClick={() => toast("GitHub sync arrives in the GitHub milestone")}
              >
                <GithubGlyph className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Connect GitHub</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={() => toast("Sharing arrives in a later milestone")}>
            <Share2 />
            Share
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" disabled className="bg-brand text-brand-foreground">
                  <Rocket />
                  Deploy
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Build the app first</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-full max-w-[420px] min-w-[320px] flex-col border-r border-border">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-8 rounded-2xl rounded-tr-md bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div key={m.id} className="text-sm leading-relaxed">
                  {m.content}
                </div>
              ),
            )}
            <div className="rounded-xl border border-dashed border-border-strong bg-sunken p-4">
              <p className="annotation">Next: Plan</p>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">
                {project.settings.planFirst === false
                  ? "You asked to skip planning. The build timeline lands here in milestone 2."
                  : "Architect will ask a few questions here and draft a plan you can edit. That arrives in milestone 2."}
              </p>
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-subtle-foreground shadow-card">
              Ask for a change…
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
            <div role="tablist" className="flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-thin">
              {visibleTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    activeTab === id && "bg-muted font-medium text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {activeTab === "preview" && (
              <div className="hidden items-center gap-0.5 md:flex" role="radiogroup" aria-label="Device size">
                {(
                  [
                    { id: "desktop", icon: Monitor },
                    { id: "tablet", icon: Tablet },
                    { id: "mobile", icon: Smartphone },
                  ] as const
                ).map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={device === id}
                    aria-label={id}
                    onClick={() => setDevice(id)}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground",
                      device === id && "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative min-h-0 flex-1 bg-sunken">
            <div className="bg-grid-major absolute inset-0" />
            <div className="relative flex h-full items-center justify-center p-6">
              <div
                className={cn(
                  "flex h-full max-h-[640px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-background/60 text-center transition-[max-width] duration-300",
                  device === "desktop" && "max-w-[960px]",
                  device === "tablet" && "max-w-[600px]",
                  device === "mobile" && "max-w-[380px]",
                )}
              >
                <p className="annotation">{TABS.find((t) => t.id === activeTab)?.label}</p>
                <p className="mt-2 max-w-xs text-sm text-pretty text-muted-foreground">
                  {activeTab === "preview"
                    ? "Your app appears here as soon as the first screen is built."
                    : "This panel fills in once the plan and build land."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectName({ id, name }: { id: string; name: string }) {
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
        className="h-7 w-56 rounded-md border border-ring bg-card px-2 text-sm font-medium outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="h-7 max-w-64 truncate rounded-md px-2 text-sm font-medium transition-colors hover:bg-muted"
      title="Rename"
    >
      {value}
    </button>
  );
}
