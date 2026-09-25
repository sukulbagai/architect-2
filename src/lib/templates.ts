import type { RoleId } from "./constants";

export type ThumbLayout = "sidebar" | "landing" | "chat" | "dashboard";

export type Template = {
  id: string;
  name: string;
  tagline: string;
  category: "Support" | "Sales" | "Marketing" | "Operations" | "Engineering" | "Research" | "Learning" | "Finance";
  roles: RoleId[];
  agents: string[];
  integrations: string[];
  prompt: string;
  layout: ThumbLayout;
};

export const TEMPLATES: Template[] = [
  {
    id: "support-desk",
    layout: "sidebar",
    name: "Support Desk Copilot",
    tagline: "Drafts replies from your help docs and escalates the tricky tickets.",
    category: "Support",
    roles: ["ops", "founder", "product"],
    agents: ["Triage", "Answer drafter", "Escalation"],
    integrations: ["Gmail", "Slack"],
    prompt:
      "Build a support desk where incoming tickets are triaged by urgency, an agent drafts a reply grounded in our help docs, and anything it isn't sure about is escalated to a human in Slack. Agents see a queue, a draft editor and a one-click send.",
  },
  {
    id: "resume-screener",
    layout: "dashboard",
    name: "Resume Screener",
    tagline: "Scores resumes against a role and books interviews with the best fits.",
    category: "Operations",
    roles: ["ops", "founder"],
    agents: ["Parser", "Scorer", "Scheduler"],
    integrations: ["Google Calendar", "Gmail"],
    prompt:
      "Build a recruiting app where I paste a job description and upload resumes. An agent extracts each candidate's experience, scores them against the role with reasons, and lets me invite the top candidates to an interview slot from my calendar.",
  },
  {
    id: "lead-research",
    layout: "landing",
    name: "Lead Research Studio",
    tagline: "Researches a company, finds the right contact and writes the first email.",
    category: "Sales",
    roles: ["sales", "founder"],
    agents: ["Researcher", "Enricher", "Email writer"],
    integrations: ["Apollo", "HubSpot"],
    prompt:
      "Build a sales research tool: I enter a company name, a researcher agent summarises what they do and recent news, an enricher finds the likely decision maker, and a writer drafts a short personalised first email I can edit and save to HubSpot.",
  },
  {
    id: "content-engine",
    layout: "landing",
    name: "Content Engine",
    tagline: "Turns one idea into a blog post, social threads and an SEO check.",
    category: "Marketing",
    roles: ["sales", "founder", "product"],
    agents: ["Strategist", "Writer", "SEO reviewer"],
    integrations: ["Notion", "LinkedIn"],
    prompt:
      "Build a content studio where I give a topic and a tone. A strategist agent outlines the piece, a writer drafts a blog post plus three LinkedIn posts, and an SEO reviewer suggests keywords and a meta description. I can edit everything before publishing to Notion.",
  },
  {
    id: "meeting-actions",
    layout: "chat",
    name: "Meeting Notes to Actions",
    tagline: "Summarises a transcript, pulls out owners and deadlines, posts them to Slack.",
    category: "Operations",
    roles: ["ops", "product", "engineer"],
    agents: ["Summarizer", "Action extractor", "Notifier"],
    integrations: ["Slack", "Linear"],
    prompt:
      "Build an app where I paste or upload a meeting transcript. It writes a short summary, extracts action items with owners and due dates into an editable table, and posts them to a Slack channel or creates Linear issues with one click.",
  },
  {
    id: "code-review",
    layout: "sidebar",
    name: "Code Review Assistant",
    tagline: "Reviews a pull request, flags risks and suggests the missing tests.",
    category: "Engineering",
    roles: ["engineer"],
    agents: ["Diff reader", "Reviewer", "Test suggester"],
    integrations: ["GitHub"],
    prompt:
      "Build a code review assistant: I paste a GitHub pull request URL, a diff-reader agent summarises the change, a reviewer agent lists risks by severity with file and line references, and a test agent proposes missing test cases I can copy.",
  },
  {
    id: "knowledge-chat",
    layout: "chat",
    name: "Team Knowledge Chat",
    tagline: "Answers questions from your docs, with citations your team can check.",
    category: "Research",
    roles: ["engineer", "ops", "product", "founder"],
    agents: ["Retriever", "Answerer"],
    integrations: ["Google Drive", "Confluence"],
    prompt:
      "Build an internal knowledge chat. I upload our handbook and wiki pages; people ask questions in plain English and get answers with citations to the exact document and section. Admins can see which questions went unanswered.",
  },
  {
    id: "market-brief",
    layout: "dashboard",
    name: "Market Research Brief",
    tagline: "Researches a market and writes a sourced two-page brief.",
    category: "Research",
    roles: ["founder", "product", "student"],
    agents: ["Web researcher", "Analyst", "Writer"],
    integrations: ["Web search", "Google Docs"],
    prompt:
      "Build a market research app: I describe a market or product idea, a researcher agent gathers sources from the web, an analyst sizes the market and lists competitors in a table, and a writer produces a two-page brief with citations I can export to Google Docs.",
  },
  {
    id: "expense-auditor",
    layout: "dashboard",
    name: "Expense Auditor",
    tagline: "Reads receipts, checks them against policy and flags exceptions.",
    category: "Finance",
    roles: ["ops", "founder"],
    agents: ["Extractor", "Policy checker"],
    integrations: ["Google Sheets"],
    prompt:
      "Build an expense auditing app. People upload receipts, an agent extracts merchant, date, amount and category, a policy agent checks each one against our expense policy, and finance sees a dashboard of exceptions they can approve or reject.",
  },
  {
    id: "study-buddy",
    layout: "chat",
    name: "Study Buddy",
    tagline: "Explains your notes, quizzes you and tracks what you've mastered.",
    category: "Learning",
    roles: ["student"],
    agents: ["Tutor", "Quiz maker"],
    integrations: [],
    prompt:
      "Build a study app where I upload lecture notes. A tutor agent explains any concept I highlight in simpler words, a quiz agent generates practice questions, and a progress page shows which topics I've mastered and which need review.",
  },
];

export function templatesForRole(role: string | null | undefined, limit = 6) {
  const ranked = [...TEMPLATES].sort((a, b) => {
    const ar = role && a.roles.includes(role as RoleId) ? 0 : 1;
    const br = role && b.roles.includes(role as RoleId) ? 0 : 1;
    return ar - br;
  });
  return ranked.slice(0, limit);
}

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}

export function layoutForTemplate(id: string | undefined | null): ThumbLayout | undefined {
  return id ? getTemplate(id)?.layout : undefined;
}
