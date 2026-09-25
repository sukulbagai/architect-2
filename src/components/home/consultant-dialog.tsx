"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, Clock, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createProject } from "@/lib/actions/projects";
import { TIME_SINKS, TOOLS, defaultSinks, ideasFor, type Idea } from "@/lib/sim/consultant";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Step = "sinks" | "tools" | "thinking" | "ideas";

export function ConsultantDialog({ open, onOpenChange, role }: { open: boolean; onOpenChange: (o: boolean) => void; role: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("sinks");
  const [sinks, setSinks] = useState<string[]>(() => defaultSinks(role));
  const [tools, setTools] = useState<string[]>(["Gmail", "Slack"]);
  const [extra, setExtra] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [thinkingLabel, setThinkingLabel] = useState("Mapping your week");
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function think() {
    setStep("thinking");
    setThinkingLabel("Mapping your week");
    setTimeout(() => setThinkingLabel("Matching agents to your tools"), 800);
    setTimeout(() => {
      setIdeas(ideasFor({ sinks, tools, extra }));
      setStep("ideas");
    }, 1700);
  }

  function build(idea: Idea) {
    setPicked(idea.templateId);
    startTransition(async () => {
      try {
        const { id } = await createProject({ prompt: idea.prompt, templateId: idea.templateId });
        onOpenChange(false);
        router.push(`/p/${id}`);
      } catch {
        toast.error("Couldn't start the project");
        setPicked(null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(() => setStep("sinks"), 200);
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border bg-sunken px-6 py-5">
          <p className="annotation flex items-center gap-1.5">
            <Sparkles className="size-3 text-brand-text" />
            The Consultant
          </p>
          <DialogTitle className="mt-2 text-xl font-semibold tracking-tight">
            {step === "sinks" && "What eats most of your week?"}
            {step === "tools" && "Which tools do you already use?"}
            {step === "thinking" && "Finding the best place to start"}
            {step === "ideas" && "Three apps worth building first"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {step === "sinks" && "Pick the work you'd most like to hand to agents."}
            {step === "tools" && "Ideas that plug into what you use get you further, faster."}
            {step === "thinking" && "This takes a moment."}
            {step === "ideas" && "Ranked by the time they'd give back. Pick one and Architect plans it with you."}
          </DialogDescription>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto px-6 py-5">
          {step === "sinks" && (
            <div className="animate-rise space-y-4">
              <div className="flex flex-wrap gap-2">
                {TIME_SINKS.map((s) => (
                  <Chip key={s.id} on={sinks.includes(s.id)} onClick={() => toggle(sinks, setSinks, s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-medium">Anything else?</span>
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="e.g. chasing late invoices every Friday"
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
            </div>
          )}

          {step === "tools" && (
            <div className="animate-rise flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <Chip key={t} on={tools.includes(t)} onClick={() => toggle(tools, setTools, t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}

          {step === "thinking" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-5 animate-spin text-brand-text" />
              {thinkingLabel}…
            </div>
          )}

          {step === "ideas" && (
            <ol className="space-y-3">
              {ideas.map((idea, i) => (
                <li key={idea.templateId} className="animate-rise rounded-xl border border-border bg-card p-4 shadow-card" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <span className="font-mono text-xs font-normal text-brand-text">0{i + 1}</span>
                        {idea.name}
                      </p>
                      <p className="mt-1 text-sm text-pretty text-muted-foreground">{idea.pitch}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                      <Clock className="size-3" />
                      Saves about {idea.hours} h a week
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1">
                      {idea.agents.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          <Bot className="size-3" />
                          {a}
                        </span>
                      ))}
                    </div>
                    <Button size="sm" onClick={() => build(idea)} disabled={pending} className={i === 0 ? "bg-brand text-brand-foreground hover:bg-brand/90" : undefined} variant={i === 0 ? "default" : "outline"}>
                      {pending && picked === idea.templateId ? <Loader2 className="animate-spin" /> : null}
                      Plan this
                      <ArrowRight />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {step !== "thinking" && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            {step === "sinks" ? (
              <span className="text-xs text-muted-foreground">{sinks.length} selected</span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setStep(step === "ideas" ? "sinks" : "sinks")}>
                <ArrowLeft />
                {step === "ideas" ? "Start over" : "Back"}
              </Button>
            )}
            {step === "sinks" && (
              <Button size="sm" onClick={() => setStep("tools")} disabled={sinks.length === 0 && !extra.trim()}>
                Next
                <ArrowRight />
              </Button>
            )}
            {step === "tools" && (
              <Button size="sm" onClick={think}>
                Show me ideas
                <ArrowRight />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
        on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-border-strong",
      )}
    >
      {on && <Check className="size-3.5" />}
      {children}
    </button>
  );
}
