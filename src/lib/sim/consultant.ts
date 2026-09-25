import { getTemplate } from "@/lib/templates";

export const TIME_SINKS = [
  { id: "email", label: "Answering customer emails", template: "support-desk", hours: 9 },
  { id: "screening", label: "Screening candidates", template: "resume-screener", hours: 7 },
  { id: "prospecting", label: "Researching prospects", template: "lead-research", hours: 8 },
  { id: "content", label: "Writing content", template: "content-engine", hours: 6 },
  { id: "meetings", label: "Meeting follow-ups", template: "meeting-actions", hours: 4 },
  { id: "reviews", label: "Reviewing code", template: "code-review", hours: 5 },
  { id: "questions", label: "Answering the same questions", template: "knowledge-chat", hours: 5 },
  { id: "research", label: "Market research", template: "market-brief", hours: 6 },
  { id: "expenses", label: "Checking expenses", template: "expense-auditor", hours: 4 },
  { id: "studying", label: "Studying for exams", template: "study-buddy", hours: 5 },
] as const;

export const TOOLS = ["Gmail", "Slack", "Notion", "HubSpot", "Google Calendar", "Linear", "GitHub", "Google Sheets", "Jira", "Confluence"];

/** Which time-sinks each role usually has, so the Consultant pre-selects sensible defaults. */
const ROLE_DEFAULTS: Record<string, string[]> = {
  founder: ["prospecting", "research", "email"],
  ops: ["email", "meetings", "expenses"],
  sales: ["prospecting", "content"],
  product: ["meetings", "research", "questions"],
  engineer: ["reviews", "questions", "meetings"],
  student: ["studying", "research"],
  other: ["email", "meetings"],
};

export function defaultSinks(role: string | null | undefined) {
  return ROLE_DEFAULTS[role ?? "other"] ?? ROLE_DEFAULTS.other;
}

export type Idea = {
  templateId: string;
  name: string;
  pitch: string;
  hours: number;
  agents: string[];
  uses: string[];
  prompt: string;
};

export function ideasFor(input: { sinks: string[]; tools: string[]; extra?: string }): Idea[] {
  const chosen = TIME_SINKS.filter((s) => input.sinks.includes(s.id));
  const fillers = TIME_SINKS.filter((s) => ["questions", "research", "meetings", "email", "content"].includes(s.id) && !chosen.includes(s));
  // What you picked always ranks first; general ideas only fill the list up to three.
  const pool = [...chosen.map((s) => ({ s, picked: true })), ...fillers.map((s) => ({ s, picked: false }))].slice(0, Math.max(3, chosen.length));
  return pool
    .map(({ s, picked }) => {
      const tpl = getTemplate(s.template)!;
      const uses = tpl.integrations.filter((i) => input.tools.includes(i));
      const toolLine = uses.length ? ` It works with ${uses.join(" and ")}, which you already use.` : "";
      const extra = input.extra?.trim() ? ` Also: ${input.extra.trim()}` : "";
      return {
        picked,
        idea: {
          templateId: tpl.id,
          name: tpl.name,
          pitch: `${tpl.tagline}${toolLine}`,
          hours: s.hours + uses.length,
          agents: tpl.agents,
          uses,
          prompt: `${tpl.prompt}${uses.length ? ` Connect it to ${uses.join(" and ")}.` : ""}${extra}`,
        },
      };
    })
    .sort((a, b) => Number(b.picked) - Number(a.picked) || b.idea.hours - a.idea.hours)
    .slice(0, 3)
    .map((x) => x.idea);
}
