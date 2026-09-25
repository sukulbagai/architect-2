import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Bot,
  Gauge,
  GitPullRequest,
  History,
  KeyRound,
  MousePointerClick,
  PackageOpen,
  Rocket,
} from "lucide-react";
import { WORKSPACE_COOKIE } from "@/lib/session";
import { FRAMEWORKS } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { HeroComposer } from "@/components/landing/hero-composer";
import { WorkspaceMock } from "@/components/landing/workspace-mock";
import { TwoDepths } from "@/components/landing/two-depths";
import { HowItWorks } from "@/components/landing/how-it-works";

const FEATURES = [
  { icon: Bot, title: "Agents in any framework", body: "Lyzr, LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK and more, chosen per agent." },
  { icon: PackageOpen, title: "Import what you have", body: "Bring a GitHub repo and keep building. Architect reads it and tells you what it found." },
  { icon: GitPullRequest, title: "GitHub, both ways", body: "Auto-commit for builders, reviewed commits and pull requests for developers." },
  { icon: History, title: "Every turn is a version", body: "Each change is saved. Restore any version in one click, from a thumbnail or a diff." },
  { icon: MousePointerClick, title: "Click to edit", body: "Point at anything in the preview and say what to change, or tweak its style directly." },
  { icon: Rocket, title: "Deploy with a checklist", body: "Build, secrets and agent checks run first. Every deploy keeps its logs and can be rolled back." },
  { icon: KeyRound, title: "Secrets stay secret", body: "Keys live in environment variables on the server, never in the generated app's browser code." },
  { icon: Gauge, title: "Know what it costs", body: "An estimate before each build, and a breakdown by step afterwards. No surprise bills." },
];

export default async function LandingPage() {
  const signedIn = (await cookies()).has(WORKSPACE_COOKIE);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-5 md:px-8">
          <Link href="/" aria-label="Architect home" className="rounded-md">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#depths" className="transition-colors hover:text-foreground">
              Simple &amp; Pro
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Button asChild>
                <Link href="/home">
                  Open Architect
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/login">Start building</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative">
          <div className="bg-grid-major mask-fade-radial pointer-events-none absolute inset-x-0 -top-16 h-[760px]" />
          <div className="relative mx-auto max-w-[1200px] px-5 pt-16 pb-10 text-center md:px-8 md:pt-24">
            <p className="annotation animate-rise">Architect 2.0 · for builders and developers</p>
            <h1 className="animate-rise mx-auto mt-5 max-w-4xl text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] text-balance [animation-delay:60ms] sm:text-6xl md:text-[76px]">
              Build agentic apps by{" "}
              <span className="font-display font-normal tracking-[-0.02em] text-brand-text italic">describing</span> them.
            </h1>
            <p className="animate-rise mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground [animation-delay:120ms] md:text-lg">
              Architect plans with you, builds the agents, UI and code, and ships a live URL. Stay in plain English, or
              open the files, diffs and terminal whenever you want.
            </p>
            <div className="animate-rise mx-auto mt-9 max-w-[720px] text-left [animation-delay:180ms]">
              <HeroComposer />
            </div>
          </div>

          <div className="relative mx-auto max-w-[1080px] px-5 pt-6 pb-24 md:px-8">
            <div className="absolute -top-2 right-8 left-8 hidden items-center gap-3 md:flex" aria-hidden="true">
              <span className="h-3 w-px bg-border-strong" />
              <span className="h-px flex-1 bg-border-strong" />
              <span className="annotation">Workspace · live</span>
              <span className="h-px flex-1 bg-border-strong" />
              <span className="h-3 w-px bg-border-strong" />
            </div>
            <div className="mt-6">
              <WorkspaceMock />
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 border-t border-border bg-sunken/60">
          <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
            <div className="max-w-2xl">
              <p className="annotation">How it works</p>
              <h2 className="mt-3 text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance md:text-[40px]">
                Think first, then build, then ship.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-pretty text-muted-foreground">
                Nothing gets built until you&apos;ve seen the plan, and you can always see which step it&apos;s on.
              </p>
            </div>
            <div className="mt-12">
              <HowItWorks />
            </div>
          </div>
        </section>

        <section id="depths" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
            <TwoDepths />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-t border-border bg-sunken/60">
          <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8">
            <div className="max-w-2xl">
              <p className="annotation">Everything to go from idea to production</p>
              <h2 className="mt-3 text-3xl leading-[1.1] font-semibold tracking-[-0.03em] text-balance md:text-[40px]">
                The whole path, not just the first prompt.
              </h2>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-card p-6">
                  <Icon className="size-5 text-brand-text" />
                  <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 flex flex-col items-start gap-4 md:flex-row md:items-center">
              <p className="annotation shrink-0">Agents in the framework you already use</p>
              <div className="flex flex-wrap gap-2">
                {FRAMEWORKS.map((f) => (
                  <span key={f} className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-border">
          <div className="bg-grid mask-fade-radial pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-[1200px] px-5 py-28 text-center md:px-8">
            <h2 className="mx-auto max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance md:text-[56px]">
              What will you <span className="font-display font-normal italic">build</span> first?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-pretty text-muted-foreground">
              Start from a sentence, a template or a GitHub repo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-11 bg-brand px-6 text-brand-foreground hover:bg-brand/90">
                <Link href={signedIn ? "/home?new=1" : "/login"}>
                  Start building
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 bg-card px-6">
                <Link href={signedIn ? "/explore" : "/login?next=/explore"}>Browse templates</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="space-y-2">
            <Logo />
            <p className="text-xs text-muted-foreground">A concept build of Architect 2.0.</p>
          </div>
          <ThemeSwitcher size="md" />
        </div>
      </footer>
    </div>
  );
}
