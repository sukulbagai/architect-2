import { seededRandom } from "../seeded";
import { DEFAULT_GUARDRAILS, DEFAULT_MEMORY } from "./agents";
import { estimate, pluralize } from "./plan";
import type { RepoProfile, ResolvedImport } from "./github";
import type { FieldType, Plan, PlanAgent, PlanCollection, PlanField, PlanPage, Row } from "./types";

/**
 * Turning a scanned repository into a plan, so an imported project flows through the same preview,
 * edits and versions as one Architect built. Pure and deterministic.
 */

const PEOPLE = ["Maya Chen", "Omar Haddad", "Lena Fischer", "Sam Okafor", "Priya Nair", "Diego Alvarez"];
const ORGS = ["Acme Studio", "Northwind", "Brightline", "Kestrel & Co", "Orbital Labs", "Harbor Goods"];
const DOMAINS = ["acme.io", "northwind.io", "brightline.co", "kestrel.co", "orbital.dev", "harbor.co"];

type ModelSpec = {
  fields: PlanField[];
  title: string;
  status?: string;
  row: (i: number, rnd: () => number) => Row;
};

const pick = <T,>(xs: readonly T[], rnd: () => number) => xs[Math.floor(rnd() * xs.length)];
const day = (rnd: () => number, month = "09") => `2026-${month}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
const f = (key: string, label: string, type: FieldType): PlanField => ({ key, label, type });

/** Fields and sample rows for the data models the scans find. Unknown models get a generic shape. */
const MODELS: Record<string, ModelSpec> = {
  Ticket: {
    fields: [f("subject", "Subject", "text"), f("customer", "Customer", "person"), f("priority", "Priority", "tag"), f("status", "Status", "status"), f("opened", "Opened", "date")],
    title: "subject",
    status: "status",
    row: (i, rnd) => ({
      subject: ["Can't reset my password", "Refund for a double charge", "Export to CSV is empty", "Invite link expired", "Dark mode on mobile", "Invoice shows the wrong VAT"][i % 6],
      customer: PEOPLE[i % 6],
      priority: pick(["Low", "Normal", "High"], rnd),
      status: ["Open", "Pending", "Urgent", "Open", "Solved", "Pending"][i % 6],
      opened: day(rnd),
    }),
  },
  Customer: {
    fields: [f("name", "Name", "text"), f("email", "Email", "email"), f("plan", "Plan", "tag"), f("mrr", "MRR", "money"), f("since", "Customer since", "date")],
    title: "name",
    row: (i, rnd) => ({ name: ORGS[i % 6], email: `ops@${DOMAINS[i % 6]}`, plan: pick(["Starter", "Team", "Business"], rnd), mrr: [49, 299, 99, 1200, 49, 299][i % 6], since: day(rnd, "0" + (1 + (i % 8))) }),
  },
  Message: {
    fields: [f("body", "Message", "longtext"), f("author", "From", "person"), f("channel", "Channel", "tag"), f("sent", "Sent", "date")],
    title: "body",
    row: (i, rnd) => ({ body: ["Thanks, that fixed it!", "Still seeing the error on Safari.", "Can you send the invoice again?", "When does the new plan start?", "Is there an API for this?", "Works now, closing."][i % 6], author: PEOPLE[(i + 2) % 6], channel: pick(["Email", "Chat", "Widget"], rnd), sent: day(rnd) }),
  },
  Post: {
    fields: [f("title", "Title", "text"), f("author", "Author", "person"), f("status", "Status", "status"), f("published", "Published", "date"), f("tag", "Topic", "tag")],
    title: "title",
    status: "status",
    row: (i, rnd) => ({
      title: ["How we cut onboarding time in half", "Pricing that grows with you", "What's new in September", "A guide to agent handoffs", "Customer spotlight: Northwind", "Designing for two audiences"][i % 6],
      author: PEOPLE[i % 6],
      status: ["Published", "Published", "Draft", "Scheduled", "Published", "Draft"][i % 6],
      published: day(rnd),
      tag: pick(["Product", "Guides", "Company"], rnd),
    }),
  },
  Story: {
    fields: [f("company", "Company", "text"), f("quote", "Quote", "longtext"), f("industry", "Industry", "tag"), f("status", "Status", "status")],
    title: "company",
    status: "status",
    row: (i) => ({ company: ORGS[i % 6], quote: ["We ship twice as fast.", "Support tickets dropped by a third.", "Finally one place for everything.", "Setup took an afternoon.", "Our team actually uses it.", "Paid for itself in a month."][i % 6], industry: ["Retail", "Logistics", "SaaS", "Agency", "Fintech", "Health"][i % 6], status: i % 3 === 2 ? "Draft" : "Published" }),
  },
  Lead: {
    fields: [f("name", "Name", "text"), f("email", "Email", "email"), f("company", "Company", "text"), f("source", "Source", "tag"), f("status", "Status", "status"), f("received", "Received", "date")],
    title: "name",
    status: "status",
    row: (i, rnd) => ({ name: PEOPLE[(i + 1) % 6], email: `${PEOPLE[(i + 1) % 6].split(" ")[0].toLowerCase()}@${DOMAINS[i % 6]}`, company: ORGS[i % 6], source: pick(["Contact form", "Pricing page", "Webinar"], rnd), status: ["New", "Contacted", "New", "Qualified", "Contacted", "New"][i % 6], received: day(rnd) }),
  },
  Contact: {
    fields: [f("name", "Name", "text"), f("email", "Email", "email"), f("company", "Company", "text"), f("stage", "Stage", "status"), f("owner", "Owner", "person")],
    title: "name",
    status: "stage",
    row: (i) => ({ name: PEOPLE[(i + 3) % 6], email: `${PEOPLE[(i + 3) % 6].split(" ")[0].toLowerCase()}@${DOMAINS[i % 6]}`, company: ORGS[i % 6], stage: ["Lead", "Customer", "Lead", "Churned", "Customer", "Lead"][i % 6], owner: PEOPLE[i % 3] }),
  },
  Company: {
    fields: [f("name", "Name", "text"), f("domain", "Domain", "text"), f("industry", "Industry", "tag"), f("employees", "Employees", "number"), f("owner", "Owner", "person")],
    title: "name",
    row: (i) => ({ name: ORGS[i % 6], domain: DOMAINS[i % 6], industry: ["Retail", "Logistics", "SaaS", "Agency", "Fintech", "Health"][i % 6], employees: [42, 310, 18, 95, 1200, 64][i % 6], owner: PEOPLE[i % 3] }),
  },
  Deal: {
    fields: [f("title", "Deal", "text"), f("company", "Company", "text"), f("amount", "Amount", "money"), f("stage", "Stage", "status"), f("close", "Close date", "date")],
    title: "title",
    status: "stage",
    row: (i, rnd) => ({ title: `${ORGS[i % 6]} · ${pick(["Team plan", "Annual renewal", "Pilot"], rnd)}`, company: ORGS[i % 6], amount: [4800, 12000, 2400, 36000, 9600, 1800][i % 6], stage: ["Discovery", "Proposal", "Won", "Proposal", "Lost", "Discovery"][i % 6], close: day(rnd, "10") }),
  },
  Invoice: {
    fields: [f("number", "Invoice", "text"), f("client", "Client", "person"), f("amount", "Amount", "money"), f("status", "Status", "status"), f("due", "Due", "date")],
    title: "number",
    status: "status",
    row: (i, rnd) => ({ number: `INV-${1041 + i}`, client: PEOPLE[i % 6], amount: Math.round(200 + rnd() * 4800), status: ["Sent", "Paid", "Overdue", "Draft", "Paid", "Sent"][i % 6], due: day(rnd, "10") }),
  },
  Client: {
    fields: [f("name", "Name", "text"), f("email", "Email", "email"), f("company", "Company", "text"), f("balance", "Balance", "money")],
    title: "name",
    row: (i) => ({ name: PEOPLE[i % 6], email: `billing@${DOMAINS[i % 6]}`, company: ORGS[i % 6], balance: [0, 1200, 480, 0, 3150, 90][i % 6] }),
  },
  Payment: {
    fields: [f("reference", "Reference", "text"), f("invoice", "Invoice", "text"), f("amount", "Amount", "money"), f("method", "Method", "tag"), f("status", "Status", "status"), f("paid", "Paid", "date")],
    title: "reference",
    status: "status",
    row: (i, rnd) => ({ reference: `pi_${(3_900_000 + i * 7919).toString(36)}`, invoice: `INV-${1041 + i}`, amount: Math.round(200 + rnd() * 4800), method: pick(["Card", "Bank transfer", "Card"], rnd), status: ["Succeeded", "Succeeded", "Pending", "Failed", "Succeeded", "Pending"][i % 6], paid: day(rnd) }),
  },
  Doc: {
    fields: [f("title", "Title", "text"), f("section", "Section", "tag"), f("status", "Status", "status"), f("updated", "Updated", "date")],
    title: "title",
    status: "status",
    row: (i, rnd) => ({ title: ["Getting started", "Authentication", "Webhooks", "Rate limits", "Agents API", "Deploying"][i % 6], section: ["Guides", "API", "API", "API", "Guides", "Guides"][i % 6], status: i === 4 ? "Draft" : "Published", updated: day(rnd) }),
  },
  Release: {
    fields: [f("version", "Version", "text"), f("title", "Highlights", "longtext"), f("status", "Status", "status"), f("date", "Date", "date")],
    title: "version",
    status: "status",
    row: (i, rnd) => ({ version: `v2.${6 - i}.0`, title: ["Agent handoffs", "Faster builds", "Dark mode", "Team roles", "CSV export", "Webhooks"][i % 6], status: i === 0 ? "Planned" : "Released", date: day(rnd) }),
  },
  Habit: {
    fields: [f("name", "Habit", "text"), f("streak", "Streak", "number"), f("frequency", "Frequency", "tag"), f("status", "Status", "status"), f("started", "Started", "date")],
    title: "name",
    status: "status",
    row: (i, rnd) => ({ name: ["Morning run", "Read 20 pages", "No phone after 10", "Drink water", "Stretch", "Journal"][i % 6], streak: [12, 34, 3, 58, 7, 21][i % 6], frequency: pick(["Daily", "Weekdays", "3× a week"], rnd), status: i === 2 ? "Paused" : "Active", started: day(rnd, "0" + (3 + (i % 6))) }),
  },
  Run: {
    fields: [f("input", "Input", "text"), f("agent", "Agent", "tag"), f("status", "Status", "status"), f("tokens", "Tokens", "number"), f("started", "Started", "date")],
    title: "input",
    status: "status",
    row: (i, rnd) => ({ input: ["Brief on the EU AI Act", "Compare three CRMs", "Summarise this week's news", "Draft a launch post", "Research Kestrel & Co", "Outline a webinar"][i % 6], agent: i % 2 ? "Writer" : "Researcher", status: ["Succeeded", "Succeeded", "Failed", "Succeeded", "Running", "Succeeded"][i % 6], tokens: Math.round(1800 + rnd() * 6000), started: day(rnd) }),
  },
};

function genericModel(model: string): ModelSpec {
  return {
    fields: [f("name", model, "text"), f("owner", "Owner", "person"), f("status", "Status", "status"), f("updated", "Updated", "date")],
    title: "name",
    status: "status",
    row: (i, rnd) => ({ name: `${model} ${i + 1} · ${ORGS[i % 6]}`, owner: PEOPLE[(i * 3) % 6], status: pick(["New", "Active", "On hold", "Done"], rnd), updated: day(rnd) }),
  };
}

function collectionFor(model: string, seed: string): PlanCollection {
  const spec = MODELS[model] ?? genericModel(model);
  const rnd = seededRandom(`${seed}:${model}`);
  const name = pluralize(model);
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    singular: model,
    fields: spec.fields,
    rows: Array.from({ length: 6 }, (_, i) => spec.row(i, rnd)),
    titleField: spec.title,
    statusField: spec.status,
  };
}

// ---------------------------------------------------------------------------------------------
// Routes → pages
// ---------------------------------------------------------------------------------------------

/** Route words that name a model differently: /blog lists posts, /inbox lists tickets. */
const ALIASES: Record<string, string> = { blog: "post", inbox: "ticket", contact: "lead", pricing: "lead", docs: "doc", changelog: "release", customers: "story", agents: "run" };

const title = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function kindFor(seg: string): PlanPage["kind"] {
  if (/^(chat|assistant|ask)$/.test(seg)) return "chat";
  if (/^(settings|account|profile|preferences)$/.test(seg)) return "settings";
  if (/(dashboard|analytics|reports?|insights|stats)/.test(seg)) return "dashboard";
  if (/^(inbox|queue|review)$/.test(seg)) return "workbench";
  if (/^(agents|playground|generate)$/.test(seg)) return "run";
  return "list";
}

const ICON: Record<PlanPage["kind"], string> = {
  dashboard: "layout-dashboard",
  list: "list",
  workbench: "inbox",
  chat: "message-square",
  run: "sparkles",
  settings: "settings",
};

function pagesFromRoutes(routes: string[], collections: PlanCollection[], agents: PlanAgent[]): PlanPage[] {
  const pages: PlanPage[] = [];
  const main = collections[0];
  const named = (word: string) => collections.find((c) => c.singular.toLowerCase() === word || c.id === word || c.name.toLowerCase() === word);
  const matchCollection = (seg: string) => named(seg.toLowerCase()) ?? (ALIASES[seg] ? named(ALIASES[seg]) : undefined) ?? main;
  for (const route of routes) {
    const segs = route.split("/").filter((s) => s && !/^[[{:(]/.test(s));
    if (route.startsWith("/api") || segs.includes("health")) continue;
    // Dynamic routes (/tickets/[id]) are detail views: the list page's drawer covers them.
    if (/[[{:]/.test(route)) continue;
    const seg = segs[segs.length - 1];
    let page: PlanPage;
    if (!seg) {
      page = { id: "overview", name: "Overview", kind: "dashboard", purpose: `Everything at a glance: ${main?.name.toLowerCase() ?? "your data"} and what changed.`, icon: ICON.dashboard, collection: main?.id, agent: agents[0]?.id };
    } else {
      const kind = kindFor(seg);
      const c = matchCollection(seg);
      const name = title(seg);
      page = {
        id: seg.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name,
        kind,
        purpose:
          kind === "chat"
            ? "Ask the assistant about anything in the app."
            : kind === "settings"
              ? "Connections, notifications and who has access."
              : kind === "run"
                ? "Give the agents a task and watch each step."
                : `${name}, from your ${c?.name.toLowerCase() ?? "data"}.`,
        icon: ICON[kind],
        ...(kind === "settings" || kind === "run" || kind === "chat" ? {} : { collection: c?.id }),
        ...(kind === "settings" ? {} : { agent: agents[0]?.id }),
        ...(kind === "run" ? { input: { label: "What should the agents work on?", placeholder: "Research Kestrel & Co and draft a one-page brief", cta: "Run" } } : {}),
      };
    }
    if (!pages.some((p) => p.id === page.id)) pages.push(page);
  }
  if (!pages.some((p) => p.kind === "chat") && agents.length) {
    pages.push({ id: "assistant", name: "Assistant", kind: "chat", purpose: "Ask the assistant about anything in the app.", icon: ICON.chat, agent: agents[0].id });
  }
  // Settings always comes last, the way the generated apps lay it out.
  const settings = pages.filter((p) => p.kind === "settings");
  const rest = pages.filter((p) => p.kind !== "settings");
  return [...rest, ...(settings.length ? settings : [{ id: "settings", name: "Settings", kind: "settings" as const, purpose: "Connections, notifications and who has access.", icon: ICON.settings }])];
}

// ---------------------------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------------------------

function agentFromRepo(a: RepoProfile["agents"][number], main: PlanCollection | undefined): PlanAgent {
  const id = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-agent$/, "") || "agent";
  const first = main?.rows[0];
  const label = first ? String(first[main!.titleField]) : "the first item";
  return {
    id,
    name: a.name,
    role: /research/i.test(a.name)
      ? "Researches a topic on the web and returns sourced notes."
      : /writ/i.test(a.name)
        ? "Turns research notes into a clear, well-structured draft."
        : `Handles ${main?.name.toLowerCase() ?? "requests"}: answers questions and drafts replies.`,
    framework: a.framework,
    model: "claude-opus-5",
    tools: /research/i.test(a.name) ? ["Web search"] : ["Knowledge base"],
    memory: DEFAULT_MEMORY,
    guardrails: DEFAULT_GUARDRAILS,
    handoffs: [],
    instructions: `You are the ${a.name}. Imported from ${a.path} (${a.library}). Be concise, cite where facts come from, and say when you're unsure.`,
    samples: /research/i.test(a.name)
      ? ["Here's what I found, with sources: three recent articles agree on the main points, and one disagrees on timing. I've listed each claim with its link so the Writer can quote them."]
      : /writ/i.test(a.name)
        ? ["Here's a first draft in four short sections: the problem, what changed, what it means for you, and what to do next. I kept it under 400 words."]
        : [`I looked at ${label}. It's ${String(first?.[main?.statusField ?? ""] ?? "open").toLowerCase()} and the last reply was two days ago. Here's a draft reply you can send as is or edit.`],
    trace: /research/i.test(a.name) ? "Searched the web · read 4 pages" : `Read ${main?.rows.length ?? 0} ${main?.name.toLowerCase() ?? "items"}`,
  };
}

function assistantFor(main: PlanCollection | undefined): PlanAgent {
  const first = main?.rows[0];
  const label = first ? String(first[main!.titleField]) : "the first item";
  return {
    id: "assistant",
    name: "Assistant",
    role: `Answers questions about your ${main?.name.toLowerCase() ?? "data"} and drafts updates.`,
    framework: "lyzr",
    model: "claude-opus-5",
    tools: [],
    memory: DEFAULT_MEMORY,
    guardrails: DEFAULT_GUARDRAILS,
    handoffs: [],
    instructions: `You are the assistant for this app. Answer questions about ${main?.name.toLowerCase() ?? "the data"} using what's in the app, draft updates when asked, and say when you're unsure.`,
    samples: [
      `${label} is ${String(first?.[main?.statusField ?? ""] ?? "in the list").toLowerCase()}. Want me to draft a short update about it?`,
      `There are ${main?.rows.length ?? 0} ${main?.name.toLowerCase() ?? "items"} in the app. I'd start with the ones that changed most recently.`,
    ],
    trace: `Read ${main?.rows.length ?? 0} ${main?.name.toLowerCase() ?? "items"}`,
  };
}

// ---------------------------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------------------------

const ACRONYMS = new Set(["api", "crm", "ui", "ai", "sdk", "cms", "cli", "css", "seo", "sql", "erp", "hr"]);

/** "invoice-api" → "Invoice API", "crm-lovable-export" → "CRM Lovable Export". */
export function appNameFor(name: string) {
  const words = title(name.replace(/\.git$/, "").replace(/^(the)-/, ""))
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w));
  return words.join(" ").trim() || "Imported app";
}

/** Three changes the edit engine can really make, offered as chips in the first message. */
function suggestionsFor(plan: Pick<Plan, "data" | "pages" | "ui">) {
  const main = plan.data[0];
  const out: string[] = [];
  const field = ["Priority", "Owner", "Due date", "Notes"].find((l) => !main?.fields.some((x) => x.label.toLowerCase() === l.toLowerCase() || x.key === l.toLowerCase()));
  if (main && field) out.push(`Add ${/^[aeiou]/i.test(field) ? "an" : "a"} ${field.toLowerCase()} field to ${main.name.toLowerCase()}`);
  if (!plan.pages.some((p) => p.id === "reports")) out.push("Add a Reports page");
  out.push(plan.ui.theme === "midnight" ? "Use the Paper theme" : "Use the Midnight theme");
  return out.slice(0, 3);
}

export function planFromRepo(profile: RepoProfile, name: string, fullName: string): Plan {
  const seed = fullName;
  const models = profile.models.length ? profile.models : ["Item"];
  const data = models.map((m) => collectionFor(m, seed));
  const agents = profile.agents.length ? profile.agents.map((a) => agentFromRepo(a, data[0])) : [assistantFor(data[0])];
  const pages = pagesFromRoutes(profile.routes.length ? profile.routes : ["/", `/${data[0].id}`, "/settings"], data, agents);
  const appName = appNameFor(name);
  const plan: Plan = {
    blueprintId: "import",
    appName,
    tagline: `Imported from ${fullName}.`,
    overview: `A ${profile.framework} app imported from ${fullName}: ${pages.length} pages, ${data.length} ${data.length === 1 ? "table" : "tables"} and ${agents.length} ${agents.length === 1 ? "agent" : "agents"}. Architect keeps your files and adds what it needs to preview and edit the app.`,
    audience: "You and your team",
    pages,
    agents,
    data,
    integrations: [],
    notes: [...profile.notes],
    ui: { theme: "studio", search: true },
    model: "claude-opus-5",
    suggestions: [],
    estimate: { credits: 0, seconds: 0 },
  };
  plan.suggestions = suggestionsFor(plan);
  plan.estimate = estimate(plan);
  return plan;
}

/** "Here's how it's organised": the top folders of the repo and what's in each. */
export function organisation(profile: RepoProfile, files: Record<string, string>): { path: string; about: string }[] {
  const top = new Map<string, number>();
  for (const p of Object.keys(files)) {
    const head = p.includes("/") ? `${p.split("/")[0]}/` : null;
    if (head) top.set(head, (top.get(head) ?? 0) + 1);
  }
  const ABOUT: Record<string, string> = {
    "app/": "Pages and API routes (App Router)",
    "src/": "The app's source: pages, components and helpers",
    "lib/": "Shared code: data access, the agent and helpers",
    "components/": "Reusable UI pieces",
    "prisma/": `The database schema${profile.models.length ? ` (${profile.models.join(", ")})` : ""}`,
    "agents/": "Agent definitions, one per agent in its framework",
    "backend/": "The Python API",
    "frontend/": "The React front end Architect added",
    "content/": "Markdown and MDX content",
    "supabase/": "Supabase migrations and types",
    "alembic/": "Database migrations",
    "tests/": "Tests",
  };
  return [...top.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path]) => ({ path, about: ABOUT[path] ?? "Project files" }));
}

export type ImportSummary = {
  repo: string;
  branch: string | null;
  source: "github" | "url" | "zip";
  framework: string;
  language: string;
  files: number;
  routes: number;
  models: string[];
  agents: string[];
  previewable: boolean;
  reason?: string;
  envVars: { key: string; set: boolean }[];
  organisation: { path: string; about: string }[];
  suggestions: string[];
};

export function importIntro(r: ResolvedImport, s: ImportSummary) {
  const models = s.models.length === 0 ? "no data models" : `${s.models.length} data ${s.models.length === 1 ? "model" : "models"}`;
  return `I've read ${r.fullName}. It's a ${s.framework} app with ${s.routes} ${s.routes === 1 ? "route" : "routes"} and ${models}.`;
}
