import { applyPlanInstruction, newAgent, newPage } from "./plan";
import { APP_THEMES, THEME_IDS } from "./themes";
import type { AppTheme, FieldType, Plan } from "./types";

export type EditResult =
  | { ok: true; plan: Plan; title: string; changes: string[]; focusPage?: string }
  | { ok: false; reply: string; examples: string[] };

const COLOR_THEMES: [RegExp, AppTheme][] = [
  [/\b(dark|night|midnight|purple|violet)\b/i, "midnight"],
  [/\b(blue|clean|corporate|minimal|light mode)\b/i, "studio"],
  [/\b(green|calm|soft|nature|meadow)\b/i, "meadow"],
  [/\b(orange|red|loud|bold|brutalist|playful)\b/i, "bold"],
  [/\b(warm|serif|editorial|paper|classic)\b/i, "paper"],
];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessFieldType(name: string): FieldType {
  const n = name.toLowerCase();
  if (/(date|due|deadline|when|day)/.test(n)) return "date";
  if (/(price|amount|cost|budget|value|fee|total)/.test(n)) return "money";
  if (/(count|number|score|qty|quantity|rating|age)/.test(n)) return "number";
  if (/(status|priority|stage|state|level)/.test(n)) return "status";
  if (/(email)/.test(n)) return "email";
  if (/(owner|assignee|person|manager|contact)/.test(n)) return "person";
  if (/(notes|description|comment|summary)/.test(n)) return "longtext";
  return "tag";
}

function sampleValue(type: FieldType, i: number) {
  switch (type) {
    case "date":
      return `2026-10-${String(2 + i * 3).padStart(2, "0")}`;
    case "money":
      return [120, 480, 75, 990, 260, 1340][i % 6];
    case "number":
      return [3, 8, 5, 1, 9, 4][i % 6];
    case "status":
      return ["High", "Medium", "Low", "Medium", "High", "Low"][i % 6];
    case "email":
      return ["maya@acme.io", "omar@northwind.io", "lena@kestrel.co", "sam@orbital.dev", "priya@harbor.co", "diego@acme.io"][i % 6];
    case "person":
      return ["Maya Chen", "Omar Haddad", "Lena Fischer", "Sam Okafor", "Priya Nair", "Diego Alvarez"][i % 6];
    case "longtext":
      return "Follow up next week.";
    default:
      return ["Core", "Growth", "Ops", "Core", "Growth", "Ops"][i % 6];
  }
}

const EXAMPLES = [
  "Add a Reports page",
  "Use the Midnight theme",
  "Add a priority field",
  "Add a banner saying “Beta: feedback welcome”",
];

/**
 * Build-mode edits. Recognises the changes this simulation can make for real (theme, pages, agents,
 * fields, search, banner, name) and applies them to the plan; files are regenerated from the plan.
 */
export function applyEdit(plan: Plan, text: string): EditResult {
  const next = structuredClone(plan);
  const changes: string[] = [];
  let focusPage: string | undefined;
  const t = text.trim();

  // Theme
  const named = THEME_IDS.find((id) => new RegExp(`\\b${id}\\b`, "i").test(t));
  const themeish = /\b(theme|colou?rs?|look|style|dark|light|palette|purple|violet|blue|green|orange|red|warm|serif|bold|calm|minimal)\b/i.test(t) && !/\bbanner\b/i.test(t);
  if (named || themeish) {
    const target = named ?? COLOR_THEMES.find(([re]) => re.test(t))?.[1];
    if (target && target !== next.ui.theme) {
      next.ui.theme = target;
      changes.push(`Switched to the ${APP_THEMES[target].label} theme`);
    }
  }

  // Banner
  const banner = t.match(/\b(?:banner|announcement|notice)\b[^"“]*["“]([^"”]+)["”]/i) ?? t.match(/\b(?:banner|announcement)\s+(?:saying|that says|with)\s+(.+)$/i);
  if (banner) {
    next.ui.banner = banner[1].trim().replace(/[.]$/, "");
    changes.push(`Added a banner: “${next.ui.banner}”`);
  } else if (/\bremove (the )?banner\b/i.test(t) && next.ui.banner) {
    delete next.ui.banner;
    changes.push("Removed the banner");
  }

  // Search
  if (/\b(remove|hide|drop)\b.*\bsearch\b/i.test(t) && next.ui.search) {
    next.ui.search = false;
    changes.push("Removed search from list pages");
  } else if (/\b(add|show)\b.*\bsearch\b/i.test(t) && !next.ui.search) {
    next.ui.search = true;
    changes.push("Added search to list pages");
  }

  // Density
  if (/\b(compact|denser|tighter|more dense)\b/i.test(t)) {
    next.ui.compact = true;
    changes.push("Made tables and cards more compact");
  } else if (/\b(roomier|more space|spacious|less dense)\b/i.test(t)) {
    next.ui.compact = false;
    changes.push("Gave tables and cards more room");
  }

  // Fields
  const field = t.match(/\badd (?:an? |the )?([a-z][\w\s-]{1,30}?) (?:field|column)(?: to (?:the )?([\w\s]+))?/i);
  if (field) {
    const label = titleCase(field[1].trim());
    const target =
      next.data.find((c) => field[2] && (c.name.toLowerCase() === field[2].trim().toLowerCase() || c.id === field[2].trim().toLowerCase())) ?? next.data[0];
    if (target && !target.fields.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const type = guessFieldType(label);
      target.fields.push({ key, label, type });
      target.rows = target.rows.map((r, i) => ({ ...r, [key]: sampleValue(type, i) }));
      changes.push(`Added a ${label} field to ${target.name.toLowerCase()}`);
      focusPage = next.pages.find((p) => p.collection === target.id && p.kind === "list")?.id;
    }
  }

  // Pages, agents, integrations, renames: shared with the planner
  if (/\b(page|screen|tab|view|agent|remove|drop|delete|rename|call it|name it|connect|integrate)\b/i.test(t)) {
    const res = applyPlanInstruction(next, t);
    const real = res.changes.filter((c) => !c.startsWith("Added this"));
    if (real.length) {
      Object.assign(next, res.plan);
      changes.push(...real);
      const added = res.plan.pages.find((p) => !plan.pages.some((q) => q.id === p.id));
      if (added) focusPage = added.id;
    }
  }

  // Suggested next steps from the plan: implement them as a page or an agent
  if (changes.length === 0) {
    const suggestion = plan.suggestions.find((s) => s.toLowerCase() === t.toLowerCase().replace(/[.!]$/, ""));
    if (suggestion) {
      const dashboardish = /\b(report|reports|chart|dashboard|digest|track|show|compare|streak|history|breakdown|by team|over time|most)\b/i.test(suggestion);
      const object =
        suggestion
          .replace(/^(add|show|track|compare|let|send|post|remind|alert|turn|export|pull|score|link|auto-approve|repurpose)\s+/i, "")
          .replace(/^(a|an|the)\s+/i, "")
          .split(/\s+(?:of|for|so|with|after|to|from|by|every|each|when|that|the day)\b/i)[0]
          .split(" ")
          .slice(0, 3)
          .join(" ") || "Automation";
      if (dashboardish) {
        const page = newPage(next, object);
        page.kind = "dashboard";
        page.icon = "layout-dashboard";
        page.purpose = suggestion + ".";
        if (!next.pages.some((p) => p.id === page.id)) next.pages.splice(next.pages.length - 1, 0, page);
        changes.push(`Added a ${page.name} page`);
        focusPage = page.id;
      } else {
        const agent = newAgent(object);
        agent.role = suggestion + ".";
        if (/\b(slack|digest|post)\b/i.test(suggestion) && !next.integrations.includes("Slack")) next.integrations.push("Slack");
        if (/\b(email|remind|gmail|reply|replies)\b/i.test(suggestion) && !next.integrations.includes("Gmail")) next.integrations.push("Gmail");
        if (!next.agents.some((a) => a.id === agent.id)) next.agents.push(agent);
        changes.push(`Added a ${agent.name} agent`);
      }
      next.suggestions = next.suggestions.filter((s) => s !== suggestion);
      next.notes.push(`${suggestion}.`);
    }
  }

  if (changes.length === 0) {
    return {
      ok: false,
      reply:
        "I couldn't turn that into a change in this demo build. Right now I can change the theme, add or remove pages and agents, add fields, toggle search, set a banner and rename the app.",
      examples: EXAMPLES,
    };
  }

  const title = changes.length === 1 ? changes[0] : `${changes[0]} and ${changes.length - 1} more`;
  return { ok: true, plan: next, title, changes, focusPage };
}
