"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, KeyRound, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { describeAgentChanges } from "@/lib/sim/agents";
import {
  createApiKey,
  deleteAgent,
  revokeApiKey,
  saveStandaloneAgent,
  saveStandaloneTests,
  saveWidget,
  setAgentPublished,
  testStandaloneAgent,
} from "@/lib/actions/agents";
import type { AgentWidget } from "@/db/schema";
import type { ConnectionView } from "@/lib/integrations";
import type { AgentTest, PlanAgent } from "@/lib/sim/types";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AgentAvatar, FrameworkChip } from "./agent-bits";
import { AgentEditor } from "./agent-editor";
import { SaveBar } from "./save-bar";
import { TestConsole } from "./test-console";
import { WidgetChat } from "./widget-chat";

type TabId = "configure" | "test" | "deploy" | "usage";
const TABS: { id: TabId; label: string }[] = [
  { id: "configure", label: "Configure" },
  { id: "test", label: "Test" },
  { id: "deploy", label: "Deploy" },
  { id: "usage", label: "Usage" },
];

type Usage = { days: { date: string; runs: number }[]; latencyMs: number; tokens: number };

export type StandaloneAgentProps = {
  id: string;
  agent: PlanAgent;
  published: boolean;
  apiKey: { prefix: string; createdAt: Date } | null;
  widget: AgentWidget;
  usage: Usage;
  realRuns: number;
  connections: ConnectionView[];
  account: string;
  isPro: boolean;
  origin: string;
  initialTab: TabId;
};

export function StandaloneAgent(props: StandaloneAgentProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(props.initialTab);
  const [saved, setSaved] = useState(props.agent);
  const [draft, setDraft] = useState(props.agent);
  const [connections, setConnections] = useState(props.connections);
  const [published, setPublished] = useState(props.published);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const dirty = describeAgentChanges(saved, draft).length > 0;

  async function save() {
    setSaving(true);
    try {
      const res = await saveStandaloneAgent(props.id, draft);
      setSaved(res.agent);
      setDraft(res.agent);
      toast.success(`Saved ${res.agent.name}`);
      router.refresh();
    } catch {
      toast.error("Couldn't save the agent", { description: "Check the name isn't empty, then try again." });
    }
    setSaving(false);
  }

  async function saveTests(tests: AgentTest[]) {
    await saveStandaloneTests(props.id, tests);
    setSaved((a) => ({ ...a, tests }));
    setDraft((a) => ({ ...a, tests }));
  }

  function togglePublished(on: boolean) {
    setPublished(on);
    startTransition(async () => {
      try {
        await setAgentPublished(props.id, on);
        toast.success(on ? `${saved.name} is published` : `${saved.name} is unpublished`, { description: on ? "The API and the widget answer now." : "The API and the widget stopped answering." });
      } catch {
        setPublished(!on);
        toast.error("Couldn't change that");
      }
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[1120px] px-5 pt-8 md:px-10 md:pt-10">
        <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Agents
        </Link>
        <header className="mt-4 flex flex-wrap items-center gap-3">
          <AgentAvatar id={saved.id} name={saved.name} className="size-11 rounded-xl text-sm" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{saved.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{saved.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <FrameworkChip framework={saved.framework} />
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", published ? "text-success" : "text-muted-foreground")}>
              <span className={cn("size-1.5 rounded-full", published ? "bg-success" : "bg-subtle-foreground")} />
              {published ? "Published" : "Draft"}
            </span>
          </div>
        </header>
        <div role="tablist" aria-label="Agent" className="mt-6 flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative -mb-px h-10 shrink-0 border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                tab === t.id && "border-foreground font-medium text-foreground",
              )}
            >
              {t.label}
              {t.id === "configure" && dirty && <span className="ml-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-warning" aria-label="Unsaved changes" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {tab === "configure" && (
          <div className="relative">
            <AgentEditor
              agent={draft}
              onChange={setDraft}
              others={[]}
              connections={connections}
              onConnected={(c) => setConnections((list) => [c, ...list.filter((x) => x.id !== c.id)])}
              account={props.account}
              isPro={props.isPro}
              codeContext={{ appName: draft.name, agents: [draft] }}
              onTest={() => setTab("test")}
            />
            <div className="mx-auto max-w-3xl px-4 pb-12 md:px-8">
              <DeleteAgent id={props.id} name={saved.name} />
            </div>
            <SaveBar show={dirty} saving={saving} onSave={() => void save()} onDiscard={() => setDraft(saved)} />
          </div>
        )}

        {tab === "test" && (
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
            <div className="h-[min(640px,calc(100dvh-240px))] min-h-[420px] overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <TestConsole
                className="h-full"
                agent={draft}
                isPro={props.isPro}
                run={(input, turn) => testStandaloneAgent(props.id, draft, input, turn)}
                tests={saved.tests ?? []}
                onSaveTests={saveTests}
                dirty={dirty}
              />
            </div>
          </div>
        )}

        {tab === "deploy" && <DeployTab {...props} name={saved.name} published={published} onPublished={togglePublished} />}

        {tab === "usage" && <UsageTab usage={props.usage} realRuns={props.realRuns} published={published} onDeploy={() => setTab("deploy")} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function DeleteAgent({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-xl border border-destructive/30 bg-card p-5 shadow-card">
      <h3 className="text-sm font-semibold">Delete this agent</h3>
      <p className="mt-1 text-sm text-muted-foreground">Removes its config, test cases and API key. The endpoint and the widget stop working straight away.</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-4" disabled={pending}>
            <Trash2 />
            Delete agent
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone. Apps that call its API will get a 404.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  await deleteAgent(id);
                  router.push("/agents");
                })
              }
            >
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="xs"
      variant="ghost"
      aria-label={label}
      className="shrink-0 text-muted-foreground"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        })
      }
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function Card({ title, description, children, aside }: { title: string; description?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const SNIPPETS = ["curl", "JavaScript", "Python"] as const;

function snippet(kind: (typeof SNIPPETS)[number], url: string, key: string) {
  if (kind === "curl")
    return `curl -X POST ${url} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "What does the Team plan cost?"}'`;
  if (kind === "JavaScript")
    return `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.ARCHITECT_API_KEY ?? "${key}"}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ input: "What does the Team plan cost?" }),
});
const { output, usage } = await res.json();`;
  return `import os
import requests

res = requests.post(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ.get('ARCHITECT_API_KEY', '${key}')}"},
    json={"input": "What does the Team plan cost?"},
    timeout=30,
)
print(res.json()["output"])`;
}

function DeployTab(props: StandaloneAgentProps & { name: string; onPublished: (on: boolean) => void }) {
  const mounted = useMounted();
  const [key, setKey] = useState<{ key?: string; prefix: string; createdAt: Date } | null>(props.apiKey);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<(typeof SNIPPETS)[number]>("curl");
  const [widget, setWidget] = useState(props.widget);
  const [savedWidget, setSavedWidget] = useState(props.widget);
  const [savingWidget, setSavingWidget] = useState(false);
  const endpoint = `${props.origin}/api/v1/agents/${props.id}/run`;
  const embedUrl = `${props.origin}/embed/agent/${props.id}`;
  const side = widget.position === "bottom-left" ? "left" : "right";
  const embed = `<iframe
  src="${embedUrl}"
  title="${props.name.replace(/"/g, "&quot;")}"
  style="position:fixed;bottom:24px;${side}:24px;width:380px;height:560px;border:0;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.18);z-index:50"
></iframe>`;
  const widgetDirty = JSON.stringify(widget) !== JSON.stringify(savedWidget);

  async function newKey() {
    setBusy(true);
    try {
      const res = await createApiKey(props.id);
      setKey(res);
    } catch {
      toast.error("Couldn't create a key");
    }
    setBusy(false);
  }

  async function revoke() {
    setBusy(true);
    try {
      await revokeApiKey(props.id);
      setKey(null);
      toast.success("Key revoked", { description: "Calls using it now get a 401." });
    } catch {
      toast.error("Couldn't revoke the key");
    }
    setBusy(false);
  }

  async function storeWidget() {
    setSavingWidget(true);
    try {
      const res = await saveWidget(props.id, widget);
      setSavedWidget(res.widget);
      toast.success("Widget saved", { description: "Sites that embed it pick up the change on their next load." });
    } catch {
      toast.error("Couldn't save the widget", { description: "Check the greeting isn't empty." });
    }
    setSavingWidget(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-8">
      <section className="flex items-start gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-card">
        <div className="min-w-0 flex-1">
          <label htmlFor="publish" className="text-sm font-semibold">
            Publish
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {props.published ? "The API and the widget are answering. Turn this off to stop both straight away." : "While it's off, the API returns 404 and the widget shows “not available”."}
          </p>
        </div>
        <Switch id="publish" checked={props.published} onCheckedChange={props.onPublished} className="mt-1" />
      </section>

      <Card title="API" description="Call this agent from your own code. Every call runs it once and returns the answer, a trace and token usage.">
        <Label className="annotation">Endpoint</Label>
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-sunken py-1 pr-1 pl-3">
          <span className="shrink-0 rounded bg-foreground px-1.5 py-px font-mono text-[10px] font-semibold text-background">POST</span>
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{endpoint}</code>
          <CopyButton text={endpoint} label="Copy endpoint" />
        </div>
        {!props.published && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <TriangleAlert className="size-3.5" />
            It answers once the agent is published.
          </p>
        )}

        <div className="mt-5">
          <Label className="annotation">API key</Label>
          {key?.key ? (
            <div className="mt-1.5 rounded-lg border border-warning/40 bg-warning-soft p-3" role="status">
              <p className="text-xs font-medium text-warning">Copy this key now. For your security it won&apos;t be shown again.</p>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-card py-1 pr-1 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{key.key}</code>
                <CopyButton text={key.key} label="Copy API key" />
              </div>
              <Button size="xs" variant="ghost" className="mt-2" onClick={() => setKey({ prefix: key.prefix, createdAt: key.createdAt })}>
                I&apos;ve saved it
              </Button>
            </div>
          ) : key ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <KeyRound className="size-4 text-muted-foreground" />
              <code className="font-mono text-xs">{key.prefix}••••••••••••••••</code>
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                {mounted ? `Created ${timeAgo(key.createdAt)}` : "Created"}
              </span>
              <span className="ml-auto flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => void newKey()} disabled={busy}>
                  Replace
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="xs" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy}>
                      Revoke
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
                      <AlertDialogDescription>Anything still using it gets a 401 from now on. You can create a new key any time.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void revoke()}>
                        Revoke key
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </span>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => void newKey()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Create API key
              </Button>
              <p className="text-xs text-muted-foreground">Architect keeps only a hash of it, so copy it when it appears.</p>
            </div>
          )}
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5" role="tablist" aria-label="Code sample">
            {SNIPPETS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={lang === s}
                onClick={() => setLang(s)}
                className={cn("h-6 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground", lang === s && "bg-card font-medium text-foreground shadow-card dark:bg-accent")}
              >
                {s}
              </button>
            ))}
            <span className="ml-auto">
              <CopyButton text={snippet(lang, endpoint, key?.key ?? "$ARCHITECT_API_KEY")} label="Copy code sample" />
            </span>
          </div>
          <pre className="overflow-x-auto bg-sunken px-4 py-3 font-mono text-[12px] leading-relaxed scrollbar-thin">{snippet(lang, endpoint, key?.key ?? "$ARCHITECT_API_KEY")}</pre>
        </div>
      </Card>

      <Card
        title="Chat widget"
        description="Put the agent on any site. Paste the snippet before the closing body tag."
        aside={
          <Button asChild size="xs" variant="ghost" className="shrink-0 text-muted-foreground">
            <a href={embedUrl} target="_blank" rel="noreferrer">
              Open
              <ExternalLink />
            </a>
          </Button>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="widget-color">Colour</Label>
              <div className="flex items-center gap-2">
                {["#cf4318", "#2563eb", "#17804a", "#7c3aed", "#17160f"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use ${c}`}
                    aria-pressed={widget.color.toLowerCase() === c}
                    onClick={() => setWidget({ ...widget, color: c })}
                    className={cn("size-7 rounded-full ring-offset-2 ring-offset-card transition-shadow", widget.color.toLowerCase() === c && "ring-2 ring-foreground")}
                    style={{ background: c }}
                  />
                ))}
                <input
                  id="widget-color"
                  type="color"
                  value={widget.color}
                  onChange={(e) => setWidget({ ...widget, color: e.target.value })}
                  className="size-7 cursor-pointer rounded-full border border-border bg-transparent p-0"
                  aria-label="Custom colour"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="widget-greeting">Greeting</Label>
              <Input id="widget-greeting" value={widget.greeting} maxLength={200} onChange={(e) => setWidget({ ...widget, greeting: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label id="widget-position">Position</Label>
              <div role="radiogroup" aria-labelledby="widget-position" className="flex rounded-lg bg-muted/60 p-0.5">
                {(["bottom-left", "bottom-right"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={widget.position === p}
                    onClick={() => setWidget({ ...widget, position: p })}
                    className={cn("h-7 flex-1 rounded-md text-xs text-muted-foreground", widget.position === p && "bg-card font-medium text-foreground shadow-card dark:bg-accent")}
                  >
                    {p === "bottom-left" ? "Bottom left" : "Bottom right"}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={!widgetDirty || savingWidget || !widget.greeting.trim()} onClick={() => void storeWidget()}>
              {savingWidget && <Loader2 className="animate-spin" />}
              {widgetDirty ? "Save widget" : "Widget saved"}
            </Button>
          </div>

          <div aria-label="Widget preview" className="overflow-hidden rounded-xl border border-border bg-sunken">
            <div className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 rounded-full bg-border-strong" />
              ))}
              <span className="ml-2 truncate rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">yoursite.com</span>
            </div>
            <div className="relative h-[380px] p-4">
              <div className="space-y-2 opacity-60" aria-hidden="true">
                <div className="h-3 w-1/3 rounded bg-border-strong" />
                <div className="h-2 w-3/4 rounded bg-border" />
                <div className="h-2 w-2/3 rounded bg-border" />
                <div className="mt-4 h-16 w-full rounded-lg bg-border/70" />
              </div>
              <div className={cn("absolute bottom-3 h-[300px] w-[230px] overflow-hidden rounded-xl shadow-float ring-1 ring-black/5", widget.position === "bottom-left" ? "left-3" : "right-3")}>
                <WidgetChat name={props.name} greeting={widget.greeting || "Hi! How can I help?"} color={widget.color} preview />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <Label className="annotation">Embed snippet</Label>
            <CopyButton text={embed} label="Copy embed snippet" />
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-sunken px-4 py-3 font-mono text-[12px] leading-relaxed scrollbar-thin">{embed}</pre>
        </div>
      </Card>
    </div>
  );
}

function UsageTab({ usage, realRuns, published, onDeploy }: { usage: Usage; realRuns: number; published: boolean; onDeploy: () => void }) {
  const total = usage.days.reduce((s, d) => s + d.runs, 0);
  const max = Math.max(1, ...usage.days.map((d) => d.runs));
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Runs · 14 days", value: total.toLocaleString("en-US") },
          { label: "Average latency", value: `${(usage.latencyMs / 1000).toFixed(2)} s` },
          { label: "Average tokens a run", value: usage.tokens.toLocaleString("en-US") },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-card">
            <p className="annotation">{t.label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card px-5 py-4 shadow-card" aria-labelledby="runs-heading">
        <h3 id="runs-heading" className="text-sm font-semibold">
          Runs per day
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Earlier days are simulated history. Today counts real calls through the API and the widget ({realRuns.toLocaleString("en-US")} so far).
        </p>
        {total === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
            <p className="text-sm font-medium">No runs yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{published ? "Runs appear here once something calls the API or someone uses the widget." : "Publish the agent, then call its API or embed the widget."}</p>
            {!published && (
              <Button size="xs" variant="outline" className="mt-3" onClick={onDeploy}>
                Go to Deploy
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-5 flex h-40 items-end gap-[2px] border-b border-border" aria-hidden="true">
              {usage.days.map((d, i) => (
                <div key={d.date} className="group relative flex h-full min-w-0 flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-[4px] bg-foreground/75 transition-colors group-hover:bg-foreground", i === usage.days.length - 1 && "bg-foreground")}
                    style={{ height: d.runs ? `${Math.max(3, (d.runs / max) * 100)}%` : 0 }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow-float ring-1 ring-border group-hover:block">
                    <span className="font-medium tabular-nums">{d.runs.toLocaleString("en-US")}</span> <span className="text-muted-foreground">{d.runs === 1 ? "run" : "runs"} · {i === usage.days.length - 1 ? "today" : label(d.date)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground" aria-hidden="true">
              <span>{label(usage.days[0].date)}</span>
              <span>Today</span>
            </div>
            <table className="sr-only">
              <caption>Runs per day, last 14 days</caption>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Runs</th>
                </tr>
              </thead>
              <tbody>
                {usage.days.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{d.runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
