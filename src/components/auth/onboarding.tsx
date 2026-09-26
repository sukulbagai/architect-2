"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowRight, Check, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { firstName } from "@/lib/format";
import { ROLES } from "@/lib/constants";
import { completeOnboarding } from "@/lib/actions/auth";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { ConnectGithubDialog } from "@/components/github/connect-github-dialog";
import type { Mode } from "@/db/schema";

const TOTAL = 3;

export function Onboarding({
  initialName,
  initialRole,
  initialMode,
  githubLogin,
}: {
  initialName: string;
  initialRole: string | null;
  initialMode: Mode;
  githubLogin: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState<string | null>(initialRole);
  const [mode, setMode] = useState<Mode | null>(initialRole ? initialMode : null);
  const [pending, startTransition] = useTransition();
  const [login, setLogin] = useState(githubLogin);
  const [connecting, setConnecting] = useState(false);

  function finish(overrides?: Partial<{ role: string; mode: Mode }>) {
    startTransition(async () => {
      try {
        const res = await completeOnboarding({
          name: name.trim() || initialName,
          role: overrides?.role ?? role ?? "other",
          mode: overrides?.mode ?? mode ?? "simple",
        });
        router.push(res.next);
        router.refresh();
      } catch {
        toast.error("Couldn't save your answers", { description: "Please try again." });
      }
    });
  }

  const canContinue = step === 1 ? !!role && name.trim().length > 0 : step === 2 ? !!mode : true;

  return (
    <div className="w-full max-w-[560px]">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i < step ? "bg-foreground" : "bg-border")}
            />
          ))}
        </div>
        <span className="annotation tabular-nums">
          Step {step} of {TOTAL}
        </span>
      </div>

      <div key={step} className="animate-rise">
        {step === 1 && (
          <section className="space-y-7">
            <Heading
              title={`Welcome, ${firstName(name || initialName)}. What do you do?`}
              body="Architect uses this to suggest templates and ideas that fit your work."
            />
            <div className="space-y-1.5">
              <Label htmlFor="ob-name">What should we call you?</Label>
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 max-w-sm bg-card" maxLength={80} />
            </div>
            <div role="radiogroup" aria-label="Your role" className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={role === r.id}
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-[border-color,background-color,color]",
                    role === r.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:border-border-strong",
                  )}
                >
                  {role === r.id && <Check className="size-3.5" />}
                  {r.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-7">
            <Heading
              title="Do you write code?"
              body="This sets how much of the machinery you see. Both modes build the same app, and you can switch any time."
            />
            <div role="radiogroup" aria-label="Mode" className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                selected={mode === "simple"}
                onSelect={() => setMode("simple")}
                title="Not really"
                subtitle="Show me the app, not the code"
                label="Simple mode"
              >
                <div className="space-y-1.5">
                  {["Built the ticket queue", "Added a reply editor", "Connected your help docs"].map((t) => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex size-3.5 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                      {t}
                    </div>
                  ))}
                </div>
              </ModeCard>
              <ModeCard
                selected={mode === "pro"}
                onSelect={() => setMode("pro")}
                title="Yes, I do"
                subtitle="Give me files, diffs and a terminal"
                label="Pro mode"
              >
                <div className="space-y-0.5 font-mono text-[10.5px] leading-4 whitespace-nowrap">
                  <div className="truncate text-muted-foreground">src/Queue.tsx</div>
                  <div className="truncate rounded-sm bg-danger-soft px-1 text-destructive">− return tickets</div>
                  <div className="truncate rounded-sm bg-success-soft px-1 text-success">+ return tickets.sort(byUrgency)</div>
                  <div className="truncate text-subtle-foreground">$ npm test · 12 passed</div>
                </div>
              </ModeCard>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-7">
            <Heading title="Make it yours" body="Pick how Architect looks. You can connect GitHub now or when you need it." />
            <ThemePicker />
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                <GithubGlyph className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{login ? "GitHub connected" : "Connect GitHub"}</p>
                <p className="text-xs text-muted-foreground">
                  {login ? (
                    <>
                      Connected as <span className="font-mono text-foreground">@{login}</span>. Import repos and sync projects any time.
                    </>
                  ) : (
                    "Import repos and keep your code in sync. Optional."
                  )}
                </p>
              </div>
              {login ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                  <Check className="size-3.5" />
                  Connected
                </span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConnecting(true)}>
                  Connect
                </Button>
              )}
            </div>
            <ConnectGithubDialog open={connecting} onOpenChange={setConnecting} name={initialName} onConnected={(c) => setLogin(c.login)} />
          </section>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            <ArrowLeft />
            Back
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => finish({ role: role ?? "other", mode: "simple" })}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            disabled={pending}
          >
            Skip for now
          </button>
        )}
        {step < TOTAL ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue} className="h-10 px-5">
            Continue
            <ArrowRight />
          </Button>
        ) : (
          <Button onClick={() => finish()} disabled={pending} className="h-10 bg-brand px-5 text-brand-foreground hover:bg-brand/90">
            {pending && <Loader2 className="animate-spin" />}
            Go to Home
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance">{title}</h1>
      <p className="max-w-md text-sm text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  title,
  subtitle,
  label,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-card transition-[border-color,box-shadow]",
        selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
      )}
    >
      <div className="bg-dots h-[104px] overflow-hidden border-b border-border px-4 py-3.5">
        <div className="rounded-lg border border-border bg-card p-2.5 shadow-card">{children}</div>
      </div>
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
          <span className="annotation mt-2 block">{label}</span>
        </span>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-foreground bg-foreground text-background" : "border-border-strong",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "Match system", icon: Monitor },
  ] as const;

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
      {options.map(({ id, label, icon: Icon }) => {
        const selected = mounted && theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(id)}
            className={cn(
              "overflow-hidden rounded-xl border bg-card text-left shadow-card transition-[border-color,box-shadow]",
              selected ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
            )}
          >
            <ThemePreview kind={id} />
            <span className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <Icon className="size-3.5 text-muted-foreground" />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type PaneColors = { bg: string; card: string; line: string; ink: string };
const LIGHT_PANE: PaneColors = { bg: "#fafaf8", card: "#ffffff", line: "#e6e4dd", ink: "#17160f" };
const DARK_PANE: PaneColors = { bg: "#111110", card: "#1c1c19", line: "#2a2a26", ink: "#edece6" };

function Pane({ c }: { c: PaneColors }) {
  return (
    <div className="h-full flex-1 p-2" style={{ background: c.bg }}>
      <div className="mb-1.5 h-1.5 w-8 rounded-full" style={{ background: c.ink, opacity: 0.8 }} />
      <div className="h-7 rounded-md border" style={{ background: c.card, borderColor: c.line }} />
      <div className="mt-1.5 flex gap-1">
        <div className="h-1.5 w-6 rounded-full" style={{ background: "#cf4318" }} />
        <div className="h-1.5 w-4 rounded-full" style={{ background: c.line }} />
      </div>
    </div>
  );
}

function ThemePreview({ kind }: { kind: "light" | "dark" | "system" }) {
  return (
    <div className="flex h-[72px] border-b border-border">
      {kind !== "dark" && <Pane c={LIGHT_PANE} />}
      {kind !== "light" && <Pane c={DARK_PANE} />}
    </div>
  );
}
