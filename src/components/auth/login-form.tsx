"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { signIn } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GithubGlyph, GoogleGlyph } from "@/components/auth/brand-icons";

type Provider = "google" | "github";
type Step =
  | { kind: "choose" }
  | { kind: "connecting"; provider: Provider }
  | { kind: "account"; provider: Provider; custom: boolean }
  | { kind: "email-sent"; email: string };

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", github: "GitHub" };

const DEMO = {
  google: { name: "Alex Rivera", email: "alex.rivera@gmail.com" },
  github: { name: "Alex Rivera", email: "alex@users.noreply.github.com" },
};

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local.split(/[._-]+/).filter(Boolean).slice(0, 2);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return name || "New builder";
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [email, setEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function complete(method: "google" | "github" | "email", name: string, mail: string) {
    startTransition(async () => {
      try {
        const res = await signIn({ method, name, email: mail });
        if (!res.ok) {
          toast.error("Sign-in didn't go through", { description: res.reason });
          return;
        }
        router.push(res.next === "/home" && next ? next : res.next);
        router.refresh();
      } catch {
        toast.error("Sign-in didn't go through", { description: "The server didn't respond. Try again in a moment." });
      }
    });
  }

  function connect(provider: Provider) {
    setStep({ kind: "connecting", provider });
    setTimeout(() => setStep({ kind: "account", provider, custom: false }), 750);
  }

  if (step.kind === "account") {
    const demo = DEMO[step.provider];
    const Glyph = step.provider === "google" ? GoogleGlyph : GithubGlyph;
    return (
      <div className="animate-rise space-y-6">
        <BackButton onClick={() => setStep({ kind: "choose" })} />
        <div className="space-y-2">
          <Glyph className="size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">Choose an account</h1>
          <p className="text-sm text-muted-foreground">to continue to Architect with {PROVIDER_LABEL[step.provider]}</p>
        </div>

        {!step.custom ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <button
              type="button"
              disabled={pending}
              onClick={() => complete(step.provider, demo.name, demo.email)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
            >
              <span className="avatar-hue flex size-9 items-center justify-center rounded-full text-sm font-semibold" style={{ "--hue": 210 } as React.CSSProperties}>
                AR
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{demo.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{demo.email}</span>
              </span>
              {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <ArrowRight className="size-4 text-muted-foreground" />}
            </button>
            <button
              type="button"
              onClick={() => setStep({ ...step, custom: true })}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-border-strong text-muted-foreground">
                <UserRound className="size-4" />
              </span>
              Use another account
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              complete(step.provider, customName.trim(), customEmail.trim());
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="custom-name">Your name</Label>
              <Input id="custom-name" value={customName} onChange={(e) => setCustomName(e.target.value)} required autoFocus className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-email">Email</Label>
              <Input id="custom-email" type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} required className="h-10" />
            </div>
            <Button type="submit" className="h-10 w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Continue
            </Button>
          </form>
        )}
        <SimulatedNote />
      </div>
    );
  }

  if (step.kind === "email-sent") {
    return (
      <div className="animate-rise space-y-6">
        <BackButton onClick={() => setStep({ kind: "choose" })} />
        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-card shadow-card">
          <MailCheck className="size-5 text-brand-text" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-pretty text-muted-foreground">
            We sent a sign-in link to <span className="font-medium text-foreground">{step.email}</span>. It works for 10
            minutes, on this device.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-border-strong bg-sunken p-4">
          <p className="annotation mb-2">Demo inbox</p>
          <p className="text-sm">
            <span className="font-medium">Your Architect sign-in link</span>
            <span className="text-muted-foreground"> · just now</span>
          </p>
          <Button
            className="mt-3 h-9 w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={pending}
            onClick={() => complete("email", nameFromEmail(step.email), step.email)}
          >
            {pending && <Loader2 className="animate-spin" />}
            Open sign-in link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Wrong address?{" "}
          <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setStep({ kind: "choose" })}>
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  const connecting = step.kind === "connecting" ? step.provider : null;

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">Sign in to Architect</h1>
        <p className="text-sm text-muted-foreground">New here? Signing in creates your workspace.</p>
      </div>

      <div className="space-y-2.5">
        {(["google", "github"] as const).map((p) => {
          const Glyph = p === "google" ? GoogleGlyph : GithubGlyph;
          return (
            <Button
              key={p}
              type="button"
              variant="outline"
              className="relative h-10 w-full bg-card text-sm shadow-card"
              disabled={!!connecting}
              onClick={() => connect(p)}
            >
              {connecting === p ? <Loader2 className="animate-spin" /> : <Glyph className="size-4" />}
              {connecting === p ? `Connecting to ${PROVIDER_LABEL[p]}…` : `Continue with ${PROVIDER_LABEL[p]}`}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="annotation">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form
        className="space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) setStep({ kind: "email-sent", email: email.trim() });
        }}
      >
        <Label htmlFor="email" className="sr-only">
          Email
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10 bg-card pl-9"
          />
        </div>
        <Button type="submit" className={cn("h-10 w-full")} disabled={!!connecting}>
          Continue with email
        </Button>
      </form>

      <SimulatedNote />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      All sign-in options
    </button>
  );
}

function SimulatedNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-px size-3.5 shrink-0" />
      Sign-in is simulated in this build. Your workspace lives in a secure cookie on this browser; no password or
      provider account is used.
    </p>
  );
}
