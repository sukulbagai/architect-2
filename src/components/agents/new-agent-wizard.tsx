"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MODELS } from "@/lib/constants";
import { INTEGRATIONS } from "@/lib/integrations";
import { BUILTIN_TOOLS, WIZARD_EXAMPLES, draftAgent } from "@/lib/sim/agents";
import { FRAMEWORK_LIST, frameworkOf } from "@/lib/sim/frameworks";
import { createAgent } from "@/lib/actions/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentAvatar, LanguageChip } from "./agent-bits";

type Step = "describe" | "drafting" | "review" | "framework";

const STEPS: { id: Step; label: string }[] = [
  { id: "describe", label: "Describe" },
  { id: "review", label: "Review" },
  { id: "framework", label: "Framework" },
];

const DRAFTING = ["Reading your description", "Choosing tools", "Writing instructions"];

const TOOL_CHOICES = [...BUILTIN_TOOLS.map((t) => t.name), ...INTEGRATIONS.filter((i) => i.category !== "Custom" && i.category !== "Code & deploy").map((i) => i.name), "GitHub"];

export function NewAgentWizard({ isPro }: { isPro: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("describe");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [framework, setFramework] = useState("lyzr");
  const [model, setModel] = useState("claude-opus-5");
  const [showFrameworks, setShowFrameworks] = useState(isPro);
  const [label, setLabel] = useState(0);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === "describe") textarea.current?.focus();
  }, [step]);

  function draft() {
    const text = prompt.trim();
    if (text.length < 3) return;
    setStep("drafting");
    setLabel(0);
    const d = draftAgent(text);
    const timers = [400, 800].map((ms, i) => setTimeout(() => setLabel(i + 1), ms));
    setTimeout(() => {
      timers.forEach(clearTimeout);
      setName(d.name);
      setRole(d.role);
      setInstructions(d.instructions);
      setTools(d.tools);
      setStep("review");
    }, 1200);
  }

  function create() {
    startTransition(async () => {
      try {
        const { id } = await createAgent({ prompt: prompt.trim(), name: name.trim(), role: role.trim(), instructions: instructions.trim(), tools, framework, model: model as "claude-opus-5" | "claude-sonnet-5" });
        router.push(`/agents/${id}`);
      } catch (err) {
        toast.error("Couldn't create the agent", { description: err instanceof Error ? err.message : "Please try again." });
      }
    });
  }

  const index = step === "drafting" ? 1 : STEPS.findIndex((s) => s.id === step);
  const f = frameworkOf(framework);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Agents
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">New agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">An agent on its own, with no app around it. Call it from your code or put it on your site as a chat widget.</p>

      <ol className="mt-6 flex items-center gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 text-xs", i < index ? "text-muted-foreground" : i === index ? "font-medium" : "text-subtle-foreground")} aria-current={i === index ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full font-mono text-[9px]",
                  i < index ? "bg-foreground text-background" : i === index ? "bg-brand text-brand-foreground" : "border border-border-strong",
                )}
              >
                {i < index ? <Check className="size-2.5" /> : i + 1}
              </span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card md:p-6">
        {step === "describe" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              draft();
            }}
          >
            <Label htmlFor="agent-prompt" className="text-base font-semibold">
              What should this agent do?
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">One or two sentences. Say what it reads, what it produces and where its answers come from.</p>
            <textarea
              id="agent-prompt"
              ref={textarea}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  draft();
                }
              }}
              rows={3}
              maxLength={2000}
              placeholder="Answer questions about our pricing from our docs"
              className="mt-4 block w-full resize-none rounded-xl border border-border-strong bg-background px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-foreground/25 focus:ring-3 focus:ring-ring/20"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {WIZARD_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={prompt.trim().length < 3} className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Sparkles />
                Draft the agent
              </Button>
            </div>
          </form>
        )}

        {step === "drafting" && (
          <div className="flex flex-col items-center py-12 text-center" role="status">
            <Loader2 className="size-5 animate-spin text-brand-text" />
            <p className="mt-3 text-sm font-medium">{DRAFTING[label]}…</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">“{prompt.trim()}”</p>
          </div>
        )}

        {step === "review" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setStep("framework");
            }}
            className="space-y-5"
          >
            <div className="flex items-center gap-3">
              <AgentAvatar id={name || "agent"} name={name || "Agent"} className="size-10 rounded-xl" />
              <p className="text-sm text-muted-foreground">Here&apos;s a first draft. Change anything before you create it.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Name</Label>
                <Input id="agent-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!name.trim()} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-role">Role</Label>
                <Input id="agent-role" value={role} maxLength={300} onChange={(e) => setRole(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-instructions">{isPro ? "Instructions (system prompt)" : "What it does"}</Label>
              <textarea
                id="agent-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                className={cn("block w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/30", isPro && "font-mono text-[12.5px]")}
              />
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Tools</legend>
              <p className="mt-0.5 text-xs text-muted-foreground">Suggested from your description. Connect the services afterwards from the agent&apos;s page.</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {TOOL_CHOICES.map((t) => {
                  const on = tools.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTools(on ? tools.filter((x) => x !== t) : [...tools, t])}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                        on ? "border-foreground/30 bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      {on && <Check className="size-3" />}
                      {t}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setStep("describe")}>
                <ArrowLeft />
                Back
              </Button>
              <Button type="submit" disabled={!name.trim()} className="bg-brand text-brand-foreground hover:bg-brand/90">
                Next: framework
                <ArrowRight />
              </Button>
            </div>
          </form>
        )}

        {step === "framework" && (
          <div className="space-y-6">
            <section aria-labelledby="wizard-framework">
              <h2 id="wizard-framework" className="text-sm font-semibold">
                Framework
              </h2>
              {!showFrameworks ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-3">
                  <span className="text-sm">
                    Runs on <span className="font-medium">{f.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Hosted for you, nothing to set up.</span>
                  <button type="button" onClick={() => setShowFrameworks(true)} className="ml-auto text-xs font-medium text-brand-text underline-offset-4 hover:underline">
                    Change
                  </button>
                </div>
              ) : (
                <div role="radiogroup" aria-labelledby="wizard-framework" className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {FRAMEWORK_LIST.map((fw) => {
                    const on = framework === fw.id;
                    return (
                      <button
                        key={fw.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setFramework(fw.id)}
                        className={cn("flex items-start gap-3 rounded-xl border bg-background px-3.5 py-2.5 text-left transition-colors", on ? "border-foreground/40 ring-1 ring-foreground/15" : "border-border hover:border-border-strong")}
                      >
                        <span className={cn("mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground" : "border-border-strong")}>
                          {on && <span className="size-2 rounded-full bg-foreground" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{fw.label}</span>
                            <LanguageChip language={fw.language} />
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{fw.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            <section aria-labelledby="wizard-model">
              <h2 id="wizard-model" className="text-sm font-semibold">
                Model
              </h2>
              <div role="radiogroup" aria-labelledby="wizard-model" className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {MODELS.map((m) => {
                  const on = model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setModel(m.id)}
                      className={cn("flex items-start gap-3 rounded-xl border bg-background px-3.5 py-3 text-left transition-colors", on ? "border-foreground/40 ring-1 ring-foreground/15" : "border-border hover:border-border-strong")}
                    >
                      <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-foreground" : "border-border-strong")}>
                        {on && <span className="size-2 rounded-full bg-foreground" />}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{m.label}</span>
                        <span className="block text-xs text-muted-foreground">{m.note}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("review")} disabled={pending}>
                <ArrowLeft />
                Back
              </Button>
              <Button onClick={create} disabled={pending} className="bg-brand text-brand-foreground hover:bg-brand/90">
                {pending ? <Loader2 className="animate-spin" /> : <Check />}
                Create {name.trim() || "agent"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
