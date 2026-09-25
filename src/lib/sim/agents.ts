import { hashString, seededRandom } from "../seeded";
import { integrationByName } from "../integrations";
import { frameworkLabel } from "./frameworks";
import type { AgentMemory, AgentTest, PlanAgent } from "./types";

/**
 * Everything about an agent that isn't code: guardrails, tools, the simulated run and its trace,
 * the test-case rule and the wizard's first draft. Pure and deterministic, so a run replays
 * identically on the server, in the console and in the public API.
 */

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------

export const GUARDRAILS = [
  { id: "approve-external", label: "Ask before sending anything outside the app", code: "ask_before_external_send" },
  { id: "cite-sources", label: "Cite sources for facts", code: "cite_sources" },
  { id: "redact-pii", label: "Redact personal data in logs", code: "redact_personal_data" },
  { id: "cost-cap", label: "Stop if a run would cost more than 5 credits", code: "max_credits_per_run: 5" },
  { id: "human-handoff", label: "Hand off to a person when unsure (confidence < 0.6)", code: "handoff_below_confidence: 0.6" },
] as const;

export const DEFAULT_GUARDRAILS = ["approve-external", "cite-sources"];
export const DEFAULT_MEMORY: AgentMemory = { mode: "conversation", window: 20 };

export const MEMORY_OPTIONS: { mode: AgentMemory["mode"]; label: string; note: string }[] = [
  { mode: "off", label: "Off", note: "Starts fresh every run." },
  { mode: "conversation", label: "Remembers this conversation", note: "Keeps the last turns of the current chat." },
  { mode: "long-term", label: "Long-term memory", note: "Remembers people and facts across conversations." },
];

export const BUILTIN_TOOLS = [
  { name: "Web search", id: "web_search", note: "Searches the web and reads pages." },
  { name: "Knowledge base", id: "knowledge_base", note: "Searches the files you add below." },
  { name: "Code interpreter", id: "code_interpreter", note: "Runs Python to calculate, chart and clean data." },
] as const;

const BUILTIN_NAMES = new Set<string>(BUILTIN_TOOLS.map((t) => t.name));

/** The call each integration makes in a trace, and its id in Pro. */
const ACTIONS: Record<string, string> = {
  slack: "post_message",
  gmail: "search_threads",
  teams: "post_message",
  notion: "search_pages",
  gdrive: "search_files",
  gdocs: "create_document",
  gcal: "find_free_slots",
  linear: "create_issue",
  jira: "create_issue",
  hubspot: "upsert_contact",
  apollo: "enrich_company",
  sheets: "append_rows",
  github: "get_pull_request",
  vercel: "list_deployments",
};
const SENDS = new Set(["slack", "gmail", "teams"]);

/** MCP servers ("mcp:DeepWiki") and HTTP tools ("http:Billing API") added on the Integrations page. */
export const isMcpTool = (tool: string) => tool.startsWith("mcp:");
export const isHttpTool = (tool: string) => tool.startsWith("http:");
export const isCustomTool = (tool: string) => isMcpTool(tool) || isHttpTool(tool);
export const isBuiltinTool = (tool: string) => BUILTIN_NAMES.has(tool);

/** "mcp:DeepWiki" → "DeepWiki"; everything else is already a display name. */
export function toolLabel(tool: string) {
  return isMcpTool(tool) ? tool.slice(4) : isHttpTool(tool) ? tool.slice(5) : tool;
}

/** The identifier Pro shows and the generated code uses: web_search, slack, mcp.deepwiki. */
export function toolId(tool: string) {
  const builtin = BUILTIN_TOOLS.find((t) => t.name === tool);
  if (builtin) return builtin.id;
  const snake = toolLabel(tool)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (isMcpTool(tool)) return `mcp.${snake}`;
  if (isHttpTool(tool)) return `http.${snake}`;
  return integrationByName(tool)?.id ?? snake;
}

/** The integration a tool needs connected, if any (built-ins need nothing). */
export function toolIntegration(tool: string) {
  if (isBuiltinTool(tool) || isCustomTool(tool)) return null;
  return integrationByName(tool) ?? null;
}

export function chunksFor(size: number) {
  return Math.max(1, Math.round(size / 2048));
}

export const tokenCount = (text: string) => Math.ceil(text.length / 4);

/** Fills in the fields older plans don't have, so the editor and codegen see one shape. */
export function withAgentDefaults(a: PlanAgent): PlanAgent {
  return {
    ...a,
    memory: a.memory ?? DEFAULT_MEMORY,
    guardrails: a.guardrails ?? DEFAULT_GUARDRAILS,
    handoffs: a.handoffs ?? [],
    knowledge: a.knowledge ?? [],
    tests: a.tests ?? [],
  };
}

// ---------------------------------------------------------------------------------------------
// A simulated run
// ---------------------------------------------------------------------------------------------

export type TraceKind = "input" | "memory" | "tool" | "retrieve" | "generate" | "guardrail" | "handoff" | "redact";

export type TraceStep = {
  kind: TraceKind;
  label: string;
  detail?: string;
  /** How long the step took. */
  ms: number;
  tokens?: { input: number; output: number };
};

export type RunUsage = { latencyMs: number; inputTokens: number; outputTokens: number; credits: number };

export type RunResult = {
  output: string;
  trace: TraceStep[];
  usage: RunUsage;
  handoff?: { to: string | null; name: string; reason: string };
};

const HANDOFF_WORDS = /\b(refunds?|legal|lawyers?|lawsuit|chargebacks?|sue|gdpr|complaint)\b/i;
const PII = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{7,}\d/g;

/** Credits for a run: tokens at list price, where 1 credit is $0.05. Sonnet costs 0.4× Opus. */
export function runCredits(input: number, output: number, model: string) {
  const rate = model === "claude-sonnet-5" ? 0.4 : 1;
  return Math.round(((input * 5 + output * 25) * rate * 20) / 1_000_000 * 100) / 100;
}

function handoffTarget(agent: PlanAgent, agents: PlanAgent[]) {
  const targets = (agent.handoffs ?? []).map((id) => agents.find((a) => a.id === id)).filter((a): a is PlanAgent => !!a);
  return targets.find((a) => /escalat|person|human|lead|legal|review/i.test(`${a.id} ${a.name} ${a.role}`)) ?? targets[0] ?? null;
}

/**
 * Runs an agent on one input, the way the console, the project route and the public API do.
 * Replies cycle through the agent's scripted samples; the trace reflects its real config (tools,
 * knowledge, memory, guardrails and handoffs), with timings drawn from `agentId + turn`.
 */
export function simulateRun(
  agent: PlanAgent,
  input: string,
  turn: number,
  ctx: { agents?: PlanAgent[]; mcp?: Record<string, string[]> } = {},
): RunResult {
  const a = withAgentDefaults(agent);
  const rnd = seededRandom(`${a.id}${turn}`);
  const between = (min: number, max: number) => Math.round(min + rnd() * (max - min));
  const guardrails = a.guardrails ?? [];
  const trace: TraceStep[] = [{ kind: "input", label: "Received input", detail: `${input.length} characters`, ms: 0 }];

  if (guardrails.includes("redact-pii")) {
    const found = input.match(PII)?.length ?? 0;
    if (found) trace.push({ kind: "redact", label: `Redacted ${found} personal ${found === 1 ? "detail" : "details"} from the logs`, ms: between(2, 9) });
  }
  const memoryTurns = a.memory?.mode === "off" ? 0 : Math.min(turn, a.memory?.window ?? 20);
  if (a.memory?.mode === "long-term") trace.push({ kind: "memory", label: "Recalled long-term memory", detail: `${2 + (turn % 3)} facts`, ms: between(20, 60) });
  else if (memoryTurns > 0) trace.push({ kind: "memory", label: `Loaded ${memoryTurns} earlier ${memoryTurns === 1 ? "turn" : "turns"}`, ms: between(3, 12) });

  const approve = guardrails.includes("approve-external");
  let passages = 0;
  for (const tool of a.tools) {
    const integration = toolIntegration(tool);
    const id = toolId(tool);
    const call = isMcpTool(tool)
      ? `${id}.${ctx.mcp?.[toolLabel(tool)]?.[turn % (ctx.mcp?.[toolLabel(tool)]?.length || 1)] ?? "call"}`
      : isHttpTool(tool)
        ? `${id}.request`
        : integration
        ? `${id}.${ACTIONS[integration.id] ?? "call"}`
        : id === "knowledge_base"
          ? "knowledge_base.search"
          : id === "code_interpreter"
            ? "code_interpreter.run"
            : id;
    const held = approve && integration && SENDS.has(integration.id);
    trace.push({ kind: "tool", label: `Tool call: ${call}`, detail: held ? "held for your approval" : undefined, ms: between(180, 640) });
    if (id === "knowledge_base") {
      passages = 3 + Math.floor(rnd() * 3);
      const files = a.knowledge?.length ?? 0;
      trace.push({
        kind: "retrieve",
        label: `Retrieved ${passages} passages`,
        detail: files ? `from ${files} ${files === 1 ? "file" : "files"} · top score 0.${80 + Math.floor(rnd() * 17)}` : `top score 0.${80 + Math.floor(rnd() * 17)}`,
        ms: between(40, 120),
      });
    }
  }

  const trigger = input.match(HANDOFF_WORDS)?.[0]?.toLowerCase();
  const target = trigger ? handoffTarget(a, ctx.agents ?? []) : null;
  const toPerson = !!trigger && !target && guardrails.includes("human-handoff");
  const handoff = target
    ? { to: target.id, name: target.name, reason: `mentions “${trigger}”` }
    : toPerson
      ? { to: null, name: "a person", reason: `mentions “${trigger}”` }
      : undefined;

  const output = handoff
    ? `This mentions ${/^[aeiou]/.test(trigger!) ? "an" : "a"} ${trigger}, so I've handed it to ${handoff.name} with a short summary of what's been said so far. ${handoff.to ? `${handoff.name} will pick it up from here.` : "Someone on the team will reply."}`
    : a.samples.length
      ? pickSample(a.samples, input, turn)
      : `Done. I read your request (“${input.slice(0, 60)}”) and handled it.`;

  const inputTokens = 900 + tokenCount(a.instructions) + tokenCount(input) + a.tools.length * 320 + passages * 280 + memoryTurns * 140;
  const outputTokens = tokenCount(output) + 24;
  trace.push({
    kind: "generate",
    label: "Generated answer",
    detail: frameworkLabel(a.framework),
    ms: between(700, 1600),
    tokens: { input: inputTokens, output: outputTokens },
  });

  if (handoff) {
    trace.push({ kind: "handoff", label: `Handed off to ${handoff.name}`, detail: `input ${handoff.reason}`, ms: between(30, 90) });
  } else {
    const n = guardrails.length;
    trace.push({ kind: "guardrail", label: n ? "Guardrails passed" : "No guardrails set", detail: n ? `${n} ${n === 1 ? "check" : "checks"}` : undefined, ms: n ? between(8, 30) : 0 });
  }

  const latencyMs = trace.reduce((s, t) => s + t.ms, 0);
  return {
    output,
    trace,
    handoff,
    usage: { latencyMs, inputTokens, outputTokens, credits: runCredits(inputTokens, outputTokens, a.model) },
  };
}

/**
 * The scripted reply that best fits the input: the sample sharing the most words with it, or the
 * next one in turn when nothing matches. Deterministic, so the same question gets the same answer.
 */
function pickSample(samples: string[], input: string, turn: number) {
  const asked = new Set(words(input).filter((w) => w.length >= 4 && !STOP.has(w)).map(stem));
  let best = -1;
  let score = 0;
  samples.forEach((sample, i) => {
    const n = new Set(words(sample).map(stem).filter((w) => asked.has(w))).size;
    if (n > score) {
      score = n;
      best = i;
    }
  });
  return best >= 0 ? samples[best] : samples[turn % samples.length];
}

/** What a typical run costs, for the model picker. */
export function typicalCredits(agent: PlanAgent) {
  return simulateRun(agent, "A typical request", 0).usage.credits;
}

// ---------------------------------------------------------------------------------------------
// Test cases: one rule, deterministic and explainable
// ---------------------------------------------------------------------------------------------

const STOP = new Set(
  "the and with your you for that this from have will been each into when what they them their about would could should there here then than just also only very more most some any all are was were has had not but can our out its let know agent sure unsure concise cite sources say best thanks please like need want make made sorry anything else help i've i'll you're don't it's".split(" "),
);

const words = (text: string) => text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
const stem = (w: string) => w.slice(0, Math.min(w.length, 5));

/** True when every word of `phrase` appears (by its first five letters) in `text`. */
function mentions(text: string, phrase: string) {
  const have = new Set(words(text).map(stem));
  const want = words(phrase).filter((w) => !STOP.has(w));
  return want.length > 0 && want.every((w) => have.has(stem(w)));
}

/**
 * The phrase a new test case expects: a word from the reply that the instructions also cover, so
 * the test keeps passing until someone edits that topic out of the instructions.
 */
export function defaultExpect(reply: string, agent: PlanAgent) {
  const covered = words(reply).find((w) => w.length >= 4 && !STOP.has(w) && mentions(agent.instructions, w));
  if (covered) return covered;
  const fromRole = words(agent.role)
    .filter((w) => w.length >= 5 && !STOP.has(w) && mentions(agent.instructions, w))
    .sort((a, b) => b.length - a.length)[0];
  return fromRole ?? words(agent.instructions).find((w) => w.length >= 5 && !STOP.has(w)) ?? agent.name.toLowerCase();
}

export type TestResult = { pass: boolean; detail: string };

/** A test passes while the agent's instructions still cover the phrase it expects. */
export function evaluateTest(agent: PlanAgent, test: AgentTest): TestResult {
  return mentions(agent.instructions, test.expect)
    ? { pass: true, detail: `The reply mentions “${test.expect}”` }
    : { pass: false, detail: `The instructions no longer mention “${test.expect}”, so the reply leaves it out` };
}

// ---------------------------------------------------------------------------------------------
// Describing an edit
// ---------------------------------------------------------------------------------------------

const MODEL_LABEL: Record<string, string> = { "claude-opus-5": "Claude Opus 5", "claude-sonnet-5": "Claude Sonnet 5" };

/** Plain sentences for the edit card: "Turned on Web search for Triage". */
export function describeAgentChanges(before: PlanAgent, after: PlanAgent, agents: PlanAgent[] = []): string[] {
  const b = withAgentDefaults(before);
  const a = withAgentDefaults(after);
  const name = a.name;
  const out: string[] = [];
  const nameOf = (id: string) => agents.find((x) => x.id === id)?.name ?? id;
  if (b.name !== a.name) out.push(`Renamed ${b.name} to ${a.name}`);
  if (b.role !== a.role) out.push(`Updated ${name}'s role`);
  if (b.instructions !== a.instructions) out.push(`Rewrote ${name}'s instructions`);
  if (b.model !== a.model) out.push(`Switched ${name} to ${MODEL_LABEL[a.model] ?? a.model}`);
  if (frameworkLabel(b.framework) !== frameworkLabel(a.framework)) out.push(`Moved ${name} to ${frameworkLabel(a.framework)}`);
  for (const t of a.tools.filter((t) => !b.tools.includes(t))) out.push(`Turned on ${toolLabel(t)} for ${name}`);
  for (const t of b.tools.filter((t) => !a.tools.includes(t))) out.push(`Turned off ${toolLabel(t)} for ${name}`);
  const kb = (list: PlanAgent["knowledge"]) => new Set((list ?? []).map((k) => k.name));
  const added = [...kb(a.knowledge)].filter((n) => !kb(b.knowledge).has(n));
  const removed = [...kb(b.knowledge)].filter((n) => !kb(a.knowledge).has(n));
  if (added.length) out.push(`Added ${added.length === 1 ? added[0] : `${added.length} files`} to ${name}'s knowledge`);
  if (removed.length) out.push(`Removed ${removed.length === 1 ? removed[0] : `${removed.length} files`} from ${name}'s knowledge`);
  if (b.memory?.mode !== a.memory?.mode || b.memory?.window !== a.memory?.window) {
    out.push(
      a.memory?.mode === "off"
        ? `Turned off ${name}'s memory`
        : a.memory?.mode === "long-term"
          ? `Gave ${name} long-term memory`
          : `${name} now remembers the last ${a.memory?.window ?? 20} turns`,
    );
  }
  for (const g of GUARDRAILS) {
    const was = b.guardrails?.includes(g.id);
    const is = a.guardrails?.includes(g.id);
    if (was !== is) out.push(`${is ? "Turned on" : "Turned off"} the guardrail “${g.label}”`);
  }
  for (const id of (a.handoffs ?? []).filter((h) => !b.handoffs?.includes(h))) out.push(`${name} now hands off to ${nameOf(id)}`);
  for (const id of (b.handoffs ?? []).filter((h) => !a.handoffs?.includes(h))) out.push(`${name} no longer hands off to ${nameOf(id)}`);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The New agent wizard's first draft
// ---------------------------------------------------------------------------------------------

type Draft = Pick<PlanAgent, "name" | "role" | "instructions" | "tools" | "samples" | "trace">;

const SHAPES: { test: RegExp; name: string; role: string; samples: string[]; trace: string; tools: string[] }[] = [
  {
    test: /\b(pricing|price|prices|plans?|billing|cost)\b/i,
    name: "Pricing FAQ",
    role: "Answers questions about pricing and plans from your docs.",
    tools: ["Knowledge base"],
    samples: [
      "The Team plan is $20 per seat a month, billed yearly, and includes unlimited projects and SSO (Pricing, §2). Monthly billing is $24 per seat.",
      "Yes, you can switch plans at any time. Upgrades apply straight away and we prorate the difference; downgrades apply at the next renewal (Billing FAQ, §4).",
      "Nonprofits get 50% off any paid plan. Send us your registration number and we'll apply it within a day (Pricing, §6).",
    ],
    trace: "Searched pricing docs · 3 matches",
  },
  {
    test: /\b(issues?|bugs?|triage|label)\b/i,
    name: "Issue triager",
    role: "Reads new GitHub issues, labels them and suggests an owner.",
    tools: ["GitHub"],
    samples: [
      "Labelled #412 as bug · P1 · area:auth. It matches #388 (same stack trace in session.ts), so I've linked them and suggested @maya as owner.",
      "#415 is a feature request, not a bug. Labelled enhancement · area:export and added it to the Q4 board.",
    ],
    trace: "Read issue #412 · compared with 38 open issues",
  },
  {
    test: /\b(support|tickets?|customers?|helpdesk)\b/i,
    name: "Support agent",
    role: "Answers customer questions from your help docs and escalates the tricky ones.",
    tools: ["Knowledge base"],
    samples: [
      "Hi Sam, CSV export is on every paid plan. If the button's greyed out, check that your role is Editor or above (Help center, Exports §1).",
      "Reset links expire after 30 minutes. I've sent a new one that's valid for 24 hours (Account security §4).",
    ],
    trace: "Searched help docs · 2 matches",
  },
  {
    test: /\b(leads?|prospects?|outreach|sales)\b/i,
    name: "Lead researcher",
    role: "Researches a company and drafts a short first email.",
    tools: ["Web search", "HubSpot"],
    samples: ["Northwind raised a $40M Series B last week and is hiring 12 support roles. Draft: “Congrats on the round, Priya. Teams scaling support that fast usually…”"],
    trace: "Read 5 sources · saved a draft to HubSpot",
  },
  {
    test: /\b(meetings?|notes|transcripts?|minutes)\b/i,
    name: "Meeting summarizer",
    role: "Turns meeting notes into a summary and action items.",
    tools: ["Slack"],
    samples: ["Summary: launch moves to 14 Oct. Actions: Maya updates the pricing page by Fri; Omar books the press briefing; Lena reviews the onboarding emails."],
    trace: "Read 4,120 words · found 3 actions",
  },
  {
    test: /\b(research|market|competitors?|trends?)\b/i,
    name: "Research analyst",
    role: "Researches a topic on the web and writes a sourced brief.",
    tools: ["Web search"],
    samples: ["The EU heat-pump market grew 14% last year, led by Poland and Italy [1][2]. Three players hold 48% share; the fastest-growing is a direct-to-consumer brand [3]."],
    trace: "Searched 9 queries · kept 12 sources",
  },
  {
    test: /\b(email|inbox|gmail)\b/i,
    name: "Inbox assistant",
    role: "Sorts your inbox and drafts replies for you to approve.",
    tools: ["Gmail"],
    samples: ["3 emails need you today: the contract from Kestrel (signature), Omar's budget question and the venue change. I've drafted replies to the last two."],
    trace: "Read 42 threads · drafted 2 replies",
  },
  {
    test: /\b(schedule|calendar|book|booking)\b/i,
    name: "Scheduler",
    role: "Finds a time that works and sends the invite.",
    tools: ["Google Calendar"],
    samples: ["Tuesday 2–2:30pm works for all four of you. I've held the slot and drafted the invite; say “send” and it goes out."],
    trace: "Checked 4 calendars · 3 shared slots",
  },
];

/** Keyword-based tools for the wizard: "from our docs" suggests the knowledge base, and so on. */
function suggestedTools(prompt: string) {
  const t: string[] = [];
  const add = (x: string) => !t.includes(x) && t.push(x);
  if (/\b(docs?|documents?|knowledge|faq|policy|policies|handbook|wiki)\b/i.test(prompt)) add("Knowledge base");
  if (/\b(web|search|internet|news|online|google)\b/i.test(prompt)) add("Web search");
  if (/\b(data|csv|spreadsheet|calculate|chart|numbers)\b/i.test(prompt)) add("Code interpreter");
  for (const [re, tool] of [
    [/\bslack\b/i, "Slack"],
    [/\b(gmail|email)\b/i, "Gmail"],
    [/\bgithub\b/i, "GitHub"],
    [/\bnotion\b/i, "Notion"],
    [/\b(hubspot|crm)\b/i, "HubSpot"],
    [/\bcalendar\b/i, "Google Calendar"],
    [/\bsheets?\b/i, "Google Sheets"],
    [/\blinear\b/i, "Linear"],
    [/\bjira\b/i, "Jira"],
  ] as const) {
    if (re.test(prompt)) add(tool);
  }
  return t;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The wizard's draft: a name, role, instructions and tools, all editable before creating. */
export function draftAgent(prompt: string): Draft {
  const clean = prompt.trim().replace(/\s+/g, " ");
  const shape = SHAPES.find((s) => s.test.test(clean));
  const tools = [...new Set([...(shape?.tools ?? []), ...suggestedTools(clean)])];
  const job = clean.replace(/[.!]+$/, "");
  const name = shape?.name ?? (capitalise(job.split(" ").filter((w) => w.length > 3).slice(0, 2).join(" ").toLowerCase()) || "Assistant");
  const role = shape?.role ?? `${capitalise(job)}.`;
  const toolLine = tools.length ? ` Use ${tools.map(toolLabel).join(tools.length > 2 ? ", " : " and ")} when they help.` : "";
  const instructions = `You are ${name}. ${role}${toolLine} Keep answers short and specific, say which document or source you used, and say plainly when you're not sure.`;
  const rnd = seededRandom(clean);
  return {
    name,
    role,
    instructions,
    tools,
    samples: shape?.samples ?? [
      `Here's what I found for “${job.slice(0, 60)}”: three things stand out, and the first needs a decision from you today. Want the details?`,
      "Done. I've written up the result and noted the one thing I wasn't sure about.",
    ],
    trace: shape?.trace ?? `Ran ${2 + Math.floor(rnd() * 3)} steps`,
  };
}

export const WIZARD_EXAMPLES = [
  "Answer questions about our pricing from our docs",
  "Triage GitHub issues and label them",
  "Summarise meeting notes and post the actions to Slack",
  "Research a company before a sales call",
];

/** A stable hue for an agent's avatar. */
export function agentHue(id: string) {
  return hashString(id) % 360;
}
