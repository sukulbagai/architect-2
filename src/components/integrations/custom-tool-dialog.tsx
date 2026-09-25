"use client";

import { useState } from "react";
import { Check, Loader2, Wrench } from "lucide-react";
import { addHttpTool, addMcpServer } from "@/lib/actions/connections";
import { mcpNameFromUrl, type ConnectionView } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Kind = "mcp" | "http";
type Phase = "form" | "discovering" | "done";

const COPY: Record<Kind, { title: string; body: string; url: string; busy: string; cta: string }> = {
  mcp: {
    title: "Add an MCP server",
    body: "Connect any Model Context Protocol server by URL. Architect lists its tools, and your agents can switch them on.",
    url: "https://mcp.deepwiki.com/mcp",
    busy: "Discovering tools…",
    cta: "Connect",
  },
  http: {
    title: "Add an HTTP tool",
    body: "Let agents call a REST API of yours. Architect adds the headers on the server, so they never reach the browser.",
    url: "https://api.example.com/v1",
    busy: "Checking the endpoint…",
    cta: "Add tool",
  },
};

/** MCP servers and HTTP tools: a URL, an optional auth header, then the tools it exposes. */
export function CustomToolDialog({
  kind,
  open,
  onOpenChange,
  onConnected,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (c: ConnectionView) => void;
}) {
  const copy = COPY[kind];
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [header, setHeader] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [result, setResult] = useState<ConnectionView | null>(null);

  function reset() {
    setName("");
    setUrl("");
    setHeader("");
    setError(null);
    setPhase("form");
    setResult(null);
  }

  function close(next: boolean) {
    if (phase === "discovering") return;
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  function validate() {
    const u = url.trim();
    if (!u) return "Enter the server's URL.";
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "https:") return "The URL must start with https://";
    } catch {
      return `Enter a full URL, like ${copy.url}`;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    setPhase("discovering");
    const started = Date.now();
    try {
      const input = { name: name.trim() || undefined, url: url.trim(), header: header || undefined };
      const res = kind === "mcp" ? await addMcpServer(input) : await addHttpTool(input);
      await new Promise((r) => setTimeout(r, Math.max(0, 1300 - (Date.now() - started))));
      if (!res.ok) {
        setError(res.error);
        setPhase("form");
        return;
      }
      setResult(res.connection);
      setPhase("done");
      onConnected(res.connection);
    } catch {
      setError("Couldn't add it. Check the URL and try again.");
      setPhase("form");
    }
  }

  const suggested = kind === "mcp" && url ? mcpNameFromUrl(url) : "";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== "discovering"}>
        <DialogHeader>
          <DialogTitle>{phase === "done" && result ? `${result.label} is connected` : copy.title}</DialogTitle>
          <DialogDescription>{phase === "done" ? (kind === "mcp" ? `It exposes ${result?.tools.length} tools. Switch them on per agent in the Agents tab.` : "Agents can now call it. Switch it on per agent in the Agents tab.") : copy.body}</DialogDescription>
        </DialogHeader>

        {phase === "done" && result ? (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {result.tools.map((t) => (
                <li key={t} className="flex items-center gap-2.5 px-3 py-2 font-mono text-xs">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span className="flex-1">{t}</span>
                  <Check className="size-3.5 text-success" />
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-url`}>URL</Label>
              <Input
                id={`${kind}-url`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={copy.url}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!error}
                disabled={phase === "discovering"}
                className="font-mono text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-name`}>
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id={`${kind}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder={suggested || (kind === "mcp" ? "DeepWiki" : "Billing API")} maxLength={40} disabled={phase === "discovering"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${kind}-header`}>
                Auth header <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${kind}-header`}
                type="password"
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder="Bearer …"
                autoComplete="off"
                disabled={phase === "discovering"}
                className="font-mono text-[13px]"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                For this demo, only a masked hint is kept (like <span className="font-mono">Bearer ••••a91f</span>) and nothing is sent to the server.
              </p>
            </div>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => close(false)} disabled={phase === "discovering"}>
                Cancel
              </Button>
              <Button type="submit" disabled={phase === "discovering"} className="min-w-32">
                {phase === "discovering" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {copy.busy}
                  </>
                ) : (
                  copy.cta
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
