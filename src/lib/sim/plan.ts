import { BLUEPRINTS, getBlueprint, type Blueprint } from "./catalog";
import { seededRandom } from "../seeded";
import type { AppTheme, Plan, PlanAgent, PlanCollection, PlanPage, PlanQuestion, Row } from "./types";
import type { ProjectSettings } from "@/db/schema";

// ---------------------------------------------------------------------------------------------
// Matching a prompt to a blueprint
// ---------------------------------------------------------------------------------------------

function hits(text: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

export function matchBlueprint(prompt: string, templateId?: string | null, fallbackName?: string): Blueprint {
  if (templateId) {
    const bp = getBlueprint(templateId);
    if (bp) return bp;
  }
  let best: { bp: Blueprint; score: number } | null = null;
  for (const bp of BLUEPRINTS) {
    const score =
      bp.keywords.strong.filter((k) => hits(prompt, k)).length * 2 + bp.keywords.weak.filter((k) => hits(prompt, k)).length;
    if (score >= 2 && (!best || score > best.score)) best = { bp, score };
  }
  return best?.bp ?? genericBlueprint(prompt, fallbackName);
}

// ---------------------------------------------------------------------------------------------
// The generic blueprint: shaped from the prompt when no template fits
// ---------------------------------------------------------------------------------------------

const PEOPLE = ["Maya Chen", "Omar Haddad", "Lena Fischer", "Sam Okafor", "Priya Nair", "Diego Alvarez", "Aisha Bello", "Ben Carter"];
const ORGS = ["Acme Studio", "Northwind", "Brightline", "Kestrel & Co", "Orbital Labs", "Harbor Goods"];
const SUFFIX = /\b(tracker|manager|management|app|tool|dashboard|assistant|planner|portal|system|platform|hub|studio|board|bot|generator|builder|finder|helper|log|logger|organizer|organiser|crm|monitor|copilot|agent)\b/gi;

export function pluralize(word: string) {
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  return word + "s";
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

export function genericBlueprint(prompt: string, appName = "My App"): Blueprint {
  const rnd = seededRandom(prompt);
  const entityRaw = appName.replace(SUFFIX, "").replace(/\s+/g, " ").trim() || "Item";
  const entity = titleCase(entityRaw.split(" ").slice(-2).join(" "));
  const plural = pluralize(entity);
  const id = slug(plural);
  const lower = prompt.toLowerCase();
  const money = /\b(invoice|invoices|expense|budget|payment|payments|sales|deal|order|orders|price|pricing|revenue|bill|billing|subscription|rent)\b/.test(lower);
  const dated = /\b(due|deadline|reminder|reminders|schedule|booking|bookings|appointment|appointments|event|events|habit|habits|plan|trip|travel)\b/.test(lower);
  const people = /\b(client|clients|customer|customers|freelancer|freelancers|member|members|student|students|patient|patients|team|tenant|tenants|volunteer)\b/.test(lower);
  const notify = /\b(remind|reminder|reminders|notify|notification|alert|alerts|email|emails)\b/.test(lower);

  const statuses = money ? ["Draft", "Sent", "Overdue", "Paid"] : dated ? ["Planned", "In progress", "Blocked", "Done"] : ["New", "Active", "On hold", "Done"];
  const personLabel = /\b(client|clients|customer|customers)\b/.test(lower) || (money && people) ? "Client" : people ? "Member" : "Owner";

  const fields: PlanCollection["fields"] = [{ key: "title", label: entity, type: "text" }];
  fields.push({ key: "person", label: personLabel, type: "person" });
  fields.push({ key: "status", label: "Status", type: "status" });
  if (money) fields.push({ key: "amount", label: "Amount", type: "money" });
  if (dated || money) fields.push({ key: "due", label: money ? "Due" : "Date", type: "date" });

  const rowsOut: Row[] = Array.from({ length: 6 }, (_, i) => {
    const r: Row = {
      title: `${entity} ${money ? `#${1041 + i}` : `· ${ORGS[i % ORGS.length]}`}`,
      person: PEOPLE[(i * 3) % PEOPLE.length],
      status: statuses[Math.floor(rnd() * statuses.length)],
    };
    if (money) r.amount = Math.round(200 + rnd() * 4800);
    if (dated || money) r.due = `2026-${rnd() > 0.5 ? "10" : "09"}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
    return r;
  });

  const collection: PlanCollection = {
    id,
    name: plural,
    singular: entity,
    titleField: "title",
    statusField: "status",
    fields,
    rows: rowsOut,
  };

  const first = rowsOut[0];
  const assistant: PlanAgent = {
    id: "assistant",
    name: `${entity} assistant`,
    role: `Answers questions about your ${plural.toLowerCase()} and drafts updates.`,
    framework: "Lyzr",
    model: "claude-opus-5",
    tools: notify ? ["Gmail"] : [],
    instructions: `You are the ${entity} assistant. Answer questions about ${plural.toLowerCase()} using the app's data, draft updates when asked, and say when you're unsure.`,
    samples: [
      `${first.title} is ${String(first.status).toLowerCase()}${first.due ? `, due ${new Date(String(first.due) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}, with ${first.person}.${money ? ` It's for $${Number(first.amount).toLocaleString("en-US")}.` : ""} Want me to draft a short update for them?`,
      `You have ${rowsOut.filter((r) => r.status !== statuses[statuses.length - 1]).length} open ${plural.toLowerCase()}. The oldest one is ${rowsOut[2].title}; I'd start there.`,
    ],
    trace: `Read ${rowsOut.length} ${plural.toLowerCase()}`,
  };
  const insights: PlanAgent = {
    id: "insights",
    name: "Insights",
    role: `Spots trends across your ${plural.toLowerCase()} and writes a weekly summary.`,
    framework: "Lyzr",
    model: "claude-opus-5",
    tools: [],
    instructions: `You are the Insights agent. Look across all ${plural.toLowerCase()}, find what changed this week and write a short, specific summary.`,
    samples: [
      `This week: ${rowsOut.length} ${plural.toLowerCase()} in total, ${rowsOut.filter((r) => r.status === statuses[statuses.length - 1]).length} finished.${money ? ` Outstanding: $${rowsOut.filter((r) => r.status !== "Paid").reduce((s, r) => s + Number(r.amount ?? 0), 0).toLocaleString("en-US")}.` : ""} ${statuses[2]} items are up by 2 since last week, mostly with ${PEOPLE[3]}.`,
    ],
    trace: "Compared this week with last week",
  };

  const pages: PlanPage[] = [
    { id: "overview", name: "Overview", kind: "dashboard", purpose: `Your ${plural.toLowerCase()} at a glance.`, icon: "layout-dashboard", collection: id, agent: "insights" },
    { id, name: plural, kind: "list", purpose: `Every ${entity.toLowerCase()}, searchable and filterable.`, icon: "list", collection: id, agent: "assistant" },
    { id: "assistant", name: "Assistant", kind: "chat", purpose: `Ask anything about your ${plural.toLowerCase()}.`, icon: "message-square", agent: "assistant" },
    {
      id: "settings",
      name: "Settings",
      kind: "settings",
      purpose: "Connections, notifications and who has access.",
      icon: "settings",
    },
  ];

  const theme: AppTheme = (["studio", "paper", "meadow", "midnight"] as const)[Math.floor(rnd() * 4)];

  return {
    id: "generic",
    appName,
    tagline: `A simple, agent-powered way to manage your ${plural.toLowerCase()}.`,
    overview: `An app to track ${plural.toLowerCase()} in one place. An assistant agent answers questions and drafts updates, and an insights agent writes a weekly summary of what changed.${notify ? " Reminders go out by email." : ""}`,
    audience: people ? `You and your ${personLabel.toLowerCase()}s` : "You and your team",
    theme,
    keywords: { strong: [], weak: [] },
    pages,
    agents: [assistant, insights],
    data: [collection],
    integrations: notify ? ["Gmail"] : [],
    questions: [
      {
        id: "users",
        text: "Who will use it?",
        options: [
          { id: "me", label: "Just me", note: "It's a personal app, so there's no sign-up or roles." },
          { id: "team", label: "My team", note: "Teammates sign in and share the same data." },
          { id: "public", label: `My ${personLabel.toLowerCase()}s too`, note: `${personLabel}s get their own sign-in and see only their own ${plural.toLowerCase()}.` },
        ],
      },
      {
        id: "autonomy",
        text: "Should the agents act on their own?",
        options: [
          { id: "suggest", label: "Suggest, I approve", note: "Agents suggest actions; you approve each one." },
          { id: "act", label: "Let them act", note: "Agents act on their own and log what they did." },
        ],
      },
      {
        id: "notify",
        text: "Where should updates go?",
        multi: true,
        options: [
          { id: "email", label: "Email", note: "Updates and reminders go out by email.", integrations: ["Gmail"] },
          { id: "slack", label: "Slack", note: "Updates post to Slack.", integrations: ["Slack"] },
          { id: "none", label: "Nowhere for now", note: "Updates stay in the app for now." },
        ],
      },
    ],
    suggestions: [`Add a weekly email summary of your ${plural.toLowerCase()}`, "Add a chart of progress over time", `Let the assistant create new ${plural.toLowerCase()} from a sentence`],
    testIssue: { found: `Sorting ${plural.toLowerCase()} by date put empty dates first`, fix: "Moved empty dates to the end" },
  };
}

// ---------------------------------------------------------------------------------------------
// Building a plan
// ---------------------------------------------------------------------------------------------

/** Sonnet builds cost 0.4× the credits of Opus. */
export function modelRate(model?: string) {
  return model === "claude-sonnet-5" ? 0.4 : 1;
}

export function estimate(plan: Pick<Plan, "pages" | "agents" | "data" | "model">) {
  const seconds = Math.round(10 + plan.agents.length * 2.4 + plan.data.length * 1.4 + plan.pages.length * 2.6 + 4);
  const credits = Math.round((1.5 + plan.agents.length * 1.2 + plan.pages.length * 0.9 + plan.data.length * 0.4) * modelRate(plan.model) * 10) / 10;
  return { seconds, credits };
}

export function buildPlan(input: {
  blueprint: Blueprint;
  appName?: string;
  answers?: Record<string, string[]> | null;
  settings?: ProjectSettings;
}): Plan {
  const { blueprint: bp, answers, settings } = input;
  const notes: string[] = [];
  const integrations = new Set(bp.integrations);
  const pages = structuredClone(bp.pages);

  if (answers) {
    for (const q of bp.questions) {
      for (const optId of answers[q.id] ?? []) {
        const opt = q.options.find((o) => o.id === optId);
        if (!opt) continue;
        notes.push(opt.note);
        opt.integrations?.forEach((i) => integrations.add(i));
        if (opt.addPage && !pages.some((p) => p.id === opt.addPage!.id)) pages.splice(pages.length - 1, 0, opt.addPage);
      }
    }
  }

  const attachments = settings?.attachments ?? [];
  if (attachments.length) {
    integrations.add("Knowledge base");
    notes.push(`Agents are grounded in ${attachments.length === 1 ? attachments[0].name : `${attachments.length} uploaded files`}.`);
  }

  const model = settings?.model ?? "claude-opus-5";
  const agents = structuredClone(bp.agents).map((a) => ({
    ...a,
    model,
    tools: attachments.length && !a.tools.includes("Knowledge base") && a.id === bp.agents[0].id ? [...a.tools, "Knowledge base"] : a.tools,
  }));
  const theme = (settings?.themePreset as AppTheme | undefined) ?? bp.theme;

  const plan: Plan = {
    blueprintId: bp.id,
    appName: bp.id === "generic" ? input.appName ?? bp.appName : bp.appName,
    tagline: bp.tagline,
    overview: bp.overview,
    audience: bp.audience,
    pages,
    agents,
    data: structuredClone(bp.data),
    integrations: [...integrations],
    notes,
    ui: { theme, search: true },
    model,
    suggestions: bp.suggestions,
    testIssue: bp.testIssue,
    estimate: { seconds: 0, credits: 0 },
  };
  plan.estimate = estimate(plan);
  return plan;
}

export function questionsFor(bp: Blueprint): PlanQuestion[] {
  return bp.questions;
}

// ---------------------------------------------------------------------------------------------
// Plan-stage chat: turn a sentence into a plan change
// ---------------------------------------------------------------------------------------------

const INTEGRATION_WORDS: Record<string, string> = {
  slack: "Slack",
  gmail: "Gmail",
  email: "Gmail",
  notion: "Notion",
  hubspot: "HubSpot",
  linear: "Linear",
  jira: "Jira",
  "google drive": "Google Drive",
  drive: "Google Drive",
  calendar: "Google Calendar",
  sheets: "Google Sheets",
  teams: "Microsoft Teams",
  github: "GitHub",
  stripe: "Stripe",
  whatsapp: "WhatsApp",
};

function guessKind(name: string): PlanPage["kind"] {
  const n = name.toLowerCase();
  if (/(dashboard|report|reports|analytics|insights|overview|stats)/.test(n)) return "dashboard";
  if (/(chat|assistant|ask|help)/.test(n)) return "chat";
  if (/(generate|create|new|request|form|run|builder)/.test(n)) return "run";
  if (/(review|editor|studio|inbox)/.test(n)) return "workbench";
  return "list";
}

function iconFor(kind: PlanPage["kind"]) {
  return { dashboard: "layout-dashboard", list: "list", workbench: "pen-line", chat: "message-square", run: "sparkles", settings: "settings" }[kind];
}

export function newPage(plan: Plan, rawName: string): PlanPage {
  const name = titleCase(rawName.replace(/\b(page|screen|tab|view)\b/gi, "").trim()) || "New page";
  const kind = guessKind(name);
  const main = plan.data[0];
  const agentId = plan.agents[0]?.id;
  const page: PlanPage = {
    id: slug(name),
    name,
    kind,
    purpose: kind === "dashboard" ? `A summary view: ${name.toLowerCase()}.` : `${name}, built from your ${main?.name.toLowerCase() ?? "data"}.`,
    icon: iconFor(kind),
    collection: main?.id,
    agent: agentId,
  };
  if (kind === "run") page.input = { label: "What should it work on?", placeholder: "Describe the task…", cta: "Run" };
  return page;
}

export function newAgent(rawName: string): PlanAgent {
  const name = titleCase(rawName.replace(/\bagent\b/gi, "").trim()) || "Helper";
  return {
    id: slug(name),
    name,
    role: `Handles ${name.toLowerCase()} tasks you describe.`,
    framework: "Lyzr",
    model: "claude-opus-5",
    tools: [],
    instructions: `You are the ${name} agent. Do what's asked, be concise, and say when you're unsure.`,
    samples: [`Done. I handled the ${name.toLowerCase()} step and logged what I changed.`],
    trace: "Ran 1 step",
  };
}

export type PlanChange = { plan: Plan; changes: string[]; reply: string };

export function applyPlanInstruction(plan: Plan, text: string): PlanChange {
  const next = structuredClone(plan);
  const changes: string[] = [];
  const t = text.trim();

  const addPage = t.match(/\badd (?:an? |the )?(.+?) (?:page|screen|tab|view)\b/i);
  if (addPage) {
    const page = newPage(next, addPage[1]);
    if (!next.pages.some((p) => p.id === page.id)) {
      next.pages.splice(Math.max(0, next.pages.length - 1), 0, page);
      changes.push(`Added a ${page.name} page`);
    }
  }

  const addAgent = t.match(/\badd (?:an? |the )?(.+?) agent\b/i);
  if (addAgent) {
    const a = newAgent(addAgent[1]);
    if (!next.agents.some((x) => x.id === a.id)) {
      next.agents.push(a);
      changes.push(`Added a ${a.name} agent`);
    }
  }

  const remove = t.match(/\b(?:remove|drop|delete|get rid of)\s+(?:the\s+)?(.+?)(?:\s+(?:page|agent|table|screen))?[.!]?$/i);
  if (remove) {
    const target = remove[1].toLowerCase();
    const page = next.pages.find((p) => p.name.toLowerCase() === target || p.id === slug(target));
    const ag = next.agents.find((a) => a.name.toLowerCase() === target || a.id === slug(target));
    if (page && page.kind !== "settings") {
      next.pages = next.pages.filter((p) => p !== page);
      changes.push(`Removed the ${page.name} page`);
    } else if (ag) {
      next.agents = next.agents.filter((a) => a !== ag);
      next.pages = next.pages.map((p) => (p.agent === ag.id ? { ...p, agent: next.agents[0]?.id } : p));
      changes.push(`Removed the ${ag.name} agent`);
    }
  }

  const already: string[] = [];
  for (const [word, integration] of Object.entries(INTEGRATION_WORDS)) {
    if (!hits(t, word) || !/\b(add|connect|use|send|post|integrate|with|via|to)\b/i.test(t)) continue;
    if (next.integrations.includes(integration)) {
      if (!already.includes(integration)) already.push(integration);
    } else {
      next.integrations.push(integration);
      changes.push(`Connected ${integration}`);
    }
  }
  if (changes.length === 0 && already.length) {
    return { plan: next, changes: [], reply: `${already.join(" and ")} ${already.length === 1 ? "is" : "are"} already in the plan.` };
  }

  const rename = t.match(/\b(?:call it|rename (?:it|the app) to|name it)\s+["“]?([^"”.]+)["”]?/i);
  if (rename) {
    next.appName = titleCase(rename[1].trim());
    changes.push(`Renamed the app to ${next.appName}`);
  }

  if (changes.length === 0) {
    next.notes.push(t.endsWith(".") ? t : `${t}.`);
    changes.push("Added this to the plan's notes");
  }

  next.estimate = estimate(next);
  const reply =
    changes.length === 1 && changes[0].startsWith("Added this")
      ? "Got it. I've added that to the plan's notes, and the build will account for it."
      : `Updated the plan: ${changes.map((c) => c.charAt(0).toLowerCase() + c.slice(1)).join(", ")}.`;
  return { plan: next, changes, reply };
}

/** Ideas offered when you think out loud in Plan mode after a build. */
export function planIdeas(plan: Plan, text: string) {
  const ideas = [...plan.suggestions];
  if (/\b(auth|login|sign ?in|users?)\b/i.test(text)) ideas.unshift("Add sign-in so each person sees only their own data");
  if (/\b(mobile|phone)\b/i.test(text)) ideas.unshift("Make every page work well on a phone");
  if (/\b(report|analytics|chart|insight)\b/i.test(text)) ideas.unshift("Add a reports page with a chart of the last 30 days");
  return ideas.slice(0, 3);
}
