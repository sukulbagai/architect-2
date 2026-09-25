"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Hammer, Lightbulb, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Workspace } from "./use-workspace";

export function ChatComposer({
  ws,
  mode,
  setMode,
  onSend,
}: {
  ws: Workspace;
  mode: "plan" | "build";
  setMode: (m: "plan" | "build") => void;
  onSend: (text: string, mode: "plan" | "build") => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const stage = ws.project.stage;
  const building = !!ws.build;
  const busy = !!ws.thinking;
  const effective: "plan" | "build" = stage === "plan" ? "plan" : mode;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  function submit() {
    const t = text.trim();
    if (!t || busy || building) return;
    onSend(t, effective);
    setText("");
  }

  const placeholder = building
    ? "Building… you can type while you wait"
    : stage === "plan"
      ? "Answer, or tell me what to change in the plan…"
      : effective === "plan"
        ? "Think a change through without touching the code…"
        : "Ask for a change…";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-card transition-colors focus-within:border-foreground/25",
        effective === "plan" && stage === "ready" ? "border-info/40" : "border-border-strong",
      )}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message Architect
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="block max-h-44 min-h-[52px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm leading-relaxed outline-none"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        {stage === "ready" ? (
          <div role="radiogroup" aria-label="Mode" className="flex items-center rounded-lg bg-muted/70 p-0.5">
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
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-info-soft px-2 text-xs font-medium text-info">
                <Lightbulb className="size-3" />
                {building ? "Building" : "Planning"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">
              {building ? "Watch the steps above. You can stop at any time." : "Messages change the plan. Nothing is built until you click Build this."}
            </TooltipContent>
          </Tooltip>
        )}
        {building ? (
          <Button size="icon-sm" variant="outline" onClick={() => void ws.stop()} aria-label="Stop building" className="rounded-full">
            <Square className="size-3 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            onClick={submit}
            disabled={!text.trim() || busy}
            aria-label="Send"
            className={cn("rounded-full", text.trim() && !busy ? "bg-brand text-brand-foreground hover:bg-brand/90" : "")}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        )}
      </div>
    </div>
  );
}
