"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Cpu,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Paintbrush,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { MODELS, STACKS, THEME_PRESETS } from "@/lib/constants";
import { createProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Mode } from "@/db/schema";
import { frameworkLabel } from "@/lib/sim/frameworks";

/** A standalone agent the composer can add to a new project. */
export type ComposerAgent = { id: string; name: string; role: string; framework: string };

export const DRAFT_KEY = "architect:draft";

const EXAMPLES = [
  "A support desk where an agent drafts replies from our help docs",
  "A recruiting app that scores resumes and books interviews",
  "A research tool that writes a sourced brief on any market",
  "An app that turns meeting notes into Slack action items",
  "A study buddy that quizzes me on my lecture notes",
];

type Attachment = { name: string; size: number; kind: "document" | "data" | "image" };

function kindOf(file: File): Attachment["kind"] {
  const n = file.name.toLowerCase();
  if (/\.(csv|xlsx?|tsv|json)$/.test(n)) return "data";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n) || file.type.startsWith("image/")) return "image";
  return "document";
}

const KIND_META = {
  document: { icon: FileText, label: "Knowledge" },
  data: { icon: FileSpreadsheet, label: "Data" },
  image: { icon: ImageIcon, label: "Reference" },
} as const;

export function Composer({
  mode = "simple",
  variant = "app",
  initialPrompt,
  autoFocus = false,
  agents = [],
  className,
}: {
  mode?: Mode;
  /** Standalone agents, offered under + → Add existing agents. */
  agents?: ComposerAgent[];
  /** "app" creates a project. "landing" keeps the prompt as a draft and sends the visitor to sign in. */
  variant?: "app" | "landing";
  initialPrompt?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [themePreset, setThemePreset] = useState<string | null>(null);
  const [stack, setStack] = useState<string>("react-vite");
  const [model, setModel] = useState<string>("claude-opus-5");
  const [planFirst, setPlanFirst] = useState(true);
  const [attached, setAttached] = useState<string[]>([]);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isPro = mode === "pro";

  // Pick up a prompt typed on the landing page before sign-in.
  useEffect(() => {
    if (variant !== "app") return;
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        localStorage.removeItem(DRAFT_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from browser storage
        setPrompt(draft);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    } catch {}
  }, [variant]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const t = setInterval(() => setExampleIndex((i) => (i + 1) % EXAMPLES.length), 3800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [prompt]);

  function addFiles(files: FileList | File[] | null) {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ name: f.name, size: f.size, kind: kindOf(f) }));
    setAttachments((prev) => [...prev, ...next.filter((n) => !prev.some((p) => p.name === n.name))].slice(0, 10));
  }

  function submit() {
    const text = prompt.trim();
    if (text.length < 3 || pending) return;

    if (variant === "landing") {
      try {
        localStorage.setItem(DRAFT_KEY, text);
      } catch {}
      router.push("/home");
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await createProject({
          prompt: text,
          settings: {
            planFirst,
            stack,
            model,
            themePreset: themePreset ?? undefined,
            attachments,
          },
          attachedAgentIds: attached,
        });
        router.push(`/p/${id}`);
      } catch (err) {
        toast.error("Couldn't start the project", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    });
  }

  const theme = THEME_PRESETS.find((t) => t.id === themePreset);
  const picked = agents.filter((a) => attached.includes(a.id));
  const canSend = prompt.trim().length >= 3 && !pending;

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border-strong bg-card shadow-composer transition-[border-color,box-shadow] focus-within:border-foreground/25",
        dragging && "border-brand ring-4 ring-brand/15",
        className,
      )}
      onDragOver={(e) => {
        if (variant !== "app") return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (variant !== "app") return;
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <label htmlFor="composer-input" className="sr-only">
        Describe the app you want to build
      </label>
      <textarea
        id="composer-input"
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder={`${EXAMPLES[exampleIndex]}…`}
        className="block max-h-80 min-h-[88px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-relaxed outline-none placeholder:transition-opacity"
      />

      {(attachments.length > 0 || theme || picked.length > 0 || (isPro && (stack !== "react-vite" || model !== "claude-opus-5"))) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {attachments.map((a) => {
            const Icon = KIND_META[a.kind].icon;
            return (
              <Chip key={a.name} onRemove={() => setAttachments((prev) => prev.filter((p) => p.name !== a.name))}>
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="max-w-40 truncate">{a.name}</span>
                <span className="text-subtle-foreground">
                  {formatBytes(a.size)} · {KIND_META[a.kind].label}
                </span>
              </Chip>
            );
          })}
          {picked.map((a) => (
            <Chip key={a.id} onRemove={() => setAttached((ids) => ids.filter((x) => x !== a.id))}>
              <Bot className="size-3.5 text-muted-foreground" />
              <span className="max-w-40 truncate">{a.name}</span>
              <span className="text-subtle-foreground">Agent</span>
            </Chip>
          ))}
          {theme && (
            <Chip onRemove={() => setThemePreset(null)}>
              <Swatch colors={theme.swatch} />
              {theme.label} theme
            </Chip>
          )}
          {isPro && stack !== "react-vite" && (
            <Chip onRemove={() => setStack("react-vite")}>
              <Layers className="size-3.5 text-muted-foreground" />
              {STACKS.find((s) => s.id === stack)?.label}
            </Chip>
          )}
          {isPro && model !== "claude-opus-5" && (
            <Chip onRemove={() => setModel("claude-opus-5")}>
              <Cpu className="size-3.5 text-muted-foreground" />
              {MODELS.find((m) => m.id === model)?.label}
            </Chip>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <div className="flex items-center gap-1">
          {variant === "app" && (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground" aria-label="Add context">
                      <Plus />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Files, theme{isPro ? ", stack and model" : " and agents"}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
                  <Paperclip />
                  <span className="flex-1">
                    Attach files
                    <span className="block text-xs text-muted-foreground">Docs become knowledge, sheets become data</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Paintbrush />
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuRadioGroup value={themePreset ?? ""} onValueChange={(v) => setThemePreset(v || null)}>
                      {THEME_PRESETS.map((t) => (
                        <DropdownMenuRadioItem key={t.id} value={t.id}>
                          <Swatch colors={t.swatch} />
                          {t.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {agents.length === 0 ? (
                  <DropdownMenuItem onSelect={() => router.push("/agents/new")}>
                    <Bot />
                    <span className="flex-1">
                      Add existing agents
                      <span className="block text-xs text-muted-foreground">None yet. Build one on the Agents page</span>
                    </span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Bot />
                      Add existing agents
                      {attached.length > 0 && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{attached.length}</span>}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                      <DropdownMenuLabel className="annotation py-1">Your standalone agents</DropdownMenuLabel>
                      {agents.map((a) => (
                        <DropdownMenuCheckboxItem
                          key={a.id}
                          checked={attached.includes(a.id)}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(on) => setAttached((ids) => (on ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                          className="items-start"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{a.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {frameworkLabel(a.framework)} · {a.role}
                            </span>
                          </span>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {isPro && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="annotation py-1">Pro</DropdownMenuLabel>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Layers />
                        Stack
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60">
                        <DropdownMenuRadioGroup value={stack} onValueChange={setStack}>
                          {STACKS.map((s) => (
                            <DropdownMenuRadioItem key={s.id} value={s.id} className="items-start">
                              <span>
                                <span className="block">{s.label}</span>
                                <span className="block text-xs text-muted-foreground">{s.note}</span>
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Cpu />
                        Model
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-60">
                        <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                          {MODELS.map((m) => (
                            <DropdownMenuRadioItem key={m.id} value={m.id} className="items-start">
                              <span>
                                <span className="block">{m.label}</span>
                                <span className="block text-xs text-muted-foreground">{m.note}</span>
                              </span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.json,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {variant === "app" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-xs text-muted-foreground select-none hover:text-foreground">
                  <Switch checked={planFirst} onCheckedChange={setPlanFirst} size="sm" aria-label="Plan first" />
                  Plan first
                </label>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">
                {planFirst
                  ? "Architect asks a few questions and drafts a plan you can edit before it builds."
                  : "Architect skips the plan and starts building right away."}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-subtle-foreground sm:inline">
            <kbd className="font-sans">↵</kbd> to send · <kbd className="font-sans">⇧↵</kbd> new line
          </span>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSend}
            size="icon"
            aria-label={variant === "landing" ? "Start building" : "Start project"}
            className={cn(
              "size-9 rounded-full transition-colors",
              canSend ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-muted text-subtle-foreground",
            )}
          >
            {pending ? <Loader2 className="animate-spin" /> : <ArrowUp className="size-[18px]" />}
          </Button>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-card/90 text-sm font-medium text-brand-text">
          Drop files to add them as context
        </div>
      )}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 pr-1 pl-2.5 text-xs">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Remove"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span className="inline-flex overflow-hidden rounded-full border border-border" aria-hidden="true">
      {colors.map((c) => (
        <span key={c} className="size-2.5" style={{ background: c }} />
      ))}
    </span>
  );
}

export function useExamplePrompts() {
  return EXAMPLES;
}
