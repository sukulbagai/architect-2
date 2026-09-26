"use client";

import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { connectGithub } from "@/lib/actions/github";
import { GITHUB_SCOPES, githubLoginFor } from "@/lib/sim/github";
import type { ConnectionView } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Phase = "consent" | "connecting" | "connected";

export type GithubConnected = { login: string; connection: ConnectionView; repos: number };

/**
 * The simulated GitHub authorization, used from onboarding, Integrations, the Workspace, the
 * import page and the agent editor. Authorize saves a login and a connection; there's no token.
 */
export function ConnectGithubDialog({
  open,
  onOpenChange,
  name,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The workspace's name: the simulated login is derived from it. Without it the dialog says "your account". */
  name?: string;
  onConnected: (c: GithubConnected) => void;
}) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [login, setLogin] = useState<string | null>(null);
  const shown = login ?? (name ? githubLoginFor(name) : null);

  function close(next: boolean) {
    if (phase === "connecting") return;
    onOpenChange(next);
    if (!next) setTimeout(() => setPhase("consent"), 200);
  }

  async function authorize() {
    setPhase("connecting");
    const started = Date.now();
    try {
      const res = await connectGithub();
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      setLogin(res.login);
      setPhase("connected");
      setTimeout(() => {
        onConnected(res);
        close(false);
      }, 900);
    } catch {
      setPhase("consent");
      toast.error("Couldn't connect GitHub", { description: "Please try again." });
    }
  }

  const busy = phase === "connecting";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]" showCloseButton={!busy}>
        <div className="border-b border-border bg-sunken px-6 pt-7 pb-6">
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <LogoMark className="size-10" />
            <span className="flex items-center gap-1 text-border-strong">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`size-1 rounded-full bg-current ${busy ? "animate-pulse" : ""}`} style={busy ? { animationDelay: `${i * 120}ms` } : undefined} />
              ))}
            </span>
            <span className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
              <GithubGlyph className="size-5" />
            </span>
          </div>
          <DialogTitle className="mt-5 text-center text-base leading-snug font-semibold">Authorize Architect</DialogTitle>
          <DialogDescription className="mt-1.5 text-center text-xs">
            {shown ? (
              <>
                On your GitHub account <span className="font-mono font-medium text-foreground">@{shown}</span>
              </>
            ) : (
              "On your GitHub account"
            )}
          </DialogDescription>
        </div>

        <div className="px-6 py-5">
          {phase === "connected" ? (
            <div className="flex flex-col items-center py-4 text-center" role="status">
              <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">Connected as @{login}</p>
              <p className="mt-1 text-xs text-muted-foreground">Your repositories are ready to import, and projects can sync to GitHub.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">Architect will be able to:</p>
              <ul className="mt-2.5 space-y-2">
                {GITHUB_SCOPES.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0" />
                This is a demo connection: nothing is sent to GitHub, and no password or token is stored. The repositories you&apos;ll see are samples.
              </p>
            </>
          )}
        </div>

        {phase !== "connected" && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
            <Button variant="outline" disabled={busy} onClick={() => close(false)}>
              Cancel
            </Button>
            <Button onClick={() => void authorize()} disabled={busy} className="min-w-28">
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Connecting…
                </>
              ) : (
                "Authorize"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
