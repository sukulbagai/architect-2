"use client";

import { useState } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { connectIntegration } from "@/lib/actions/connections";
import type { ConnectionView, Integration } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Phase = "consent" | "connecting" | "connected" | "denied";

export function IntegrationTile({ integration, className = "size-9" }: { integration: Pick<Integration, "mono" | "tint">; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold text-white ${className}`}
      style={{ background: integration.tint }}
      aria-hidden="true"
    >
      {integration.mono}
    </span>
  );
}

/**
 * A simulated OAuth consent screen. Allow saves a connection row after a short "Connecting…";
 * Deny cancels inline. Nothing is sent to the service and no token exists.
 */
export function ConnectDialog({
  integration,
  account,
  open,
  onOpenChange,
  onConnected,
}: {
  integration: Integration | null;
  account: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (c: ConnectionView) => void;
}) {
  const [phase, setPhase] = useState<Phase>("consent");

  function close(next: boolean) {
    if (phase === "connecting") return;
    onOpenChange(next);
    if (!next) setTimeout(() => setPhase("consent"), 200);
  }

  async function allow() {
    if (!integration) return;
    setPhase("connecting");
    const started = Date.now();
    try {
      const c = await connectIntegration(integration.id);
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      setPhase("connected");
      onConnected(c);
      setTimeout(() => close(false), 900);
    } catch {
      setPhase("consent");
      toast.error(`Couldn't connect ${integration.name}`, { description: "Please try again." });
    }
  }

  if (!integration) return null;
  const busy = phase === "connecting";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[420px]" showCloseButton={!busy}>
        <div className="border-b border-border bg-sunken px-6 pt-7 pb-6">
          <div className="flex items-center justify-center gap-3" aria-hidden="true">
            <LogoMark className="size-10" />
            <span className="flex items-center gap-1 text-border-strong">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`size-1 rounded-full bg-current ${busy ? "animate-pulse" : ""}`}
                  style={busy ? { animationDelay: `${i * 120}ms` } : undefined}
                />
              ))}
            </span>
            <IntegrationTile integration={integration} className="size-10 text-sm" />
          </div>
          <DialogTitle className="mt-5 text-center text-base leading-snug font-semibold text-balance">
            Architect wants to access your {integration.name} account
          </DialogTitle>
          <DialogDescription className="mt-1.5 text-center text-xs">
            Signed in as <span className="font-medium text-foreground">{account}</span>
          </DialogDescription>
        </div>

        <div className="px-6 py-5">
          {phase === "connected" ? (
            <div className="flex flex-col items-center py-4 text-center" role="status">
              <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium">Connected</p>
              <p className="mt-1 text-xs text-muted-foreground">Every agent in this workspace can now use {integration.name}.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted-foreground">This will let Architect:</p>
              <ul className="mt-2.5 space-y-2">
                {integration.scopes.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                    {s}
                  </li>
                ))}
              </ul>
              {phase === "denied" && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs" role="alert">
                  <X className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">Connection cancelled.</span> Nothing was shared with {integration.name}.
                  </span>
                </p>
              )}
              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0" />
                This is a demo connection: nothing is sent to {integration.name}, and no password or token is stored.
              </p>
            </>
          )}
        </div>

        {phase !== "connected" && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
            {phase === "denied" ? (
              <>
                <Button variant="ghost" onClick={() => close(false)}>
                  Close
                </Button>
                <Button onClick={() => setPhase("consent")}>Try again</Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setPhase("denied")}>
                  Deny
                </Button>
                <Button onClick={() => void allow()} disabled={busy} className="min-w-28">
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    "Allow"
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
