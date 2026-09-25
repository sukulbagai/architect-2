import type { AppTheme, PlanAgent, PlanCollection, PlanPage, PlanQuestion, Row } from "./types";

/** Everything the simulator knows about one kind of app. */
export type Blueprint = {
  id: string;
  appName: string;
  tagline: string;
  overview: string;
  audience: string;
  theme: AppTheme;
  /** Strong keywords score 2, weak ones 1. A prompt needs 2 points to match. */
  keywords: { strong: string[]; weak: string[] };
  pages: PlanPage[];
  agents: PlanAgent[];
  data: PlanCollection[];
  integrations: string[];
  questions: PlanQuestion[];
  suggestions: string[];
  testIssue?: { found: string; fix: string };
};

const settingsPage: PlanPage = {
  id: "settings",
  name: "Settings",
  kind: "settings",
  purpose: "Connections, notifications and who has access.",
  icon: "settings",
};

function agent(a: Omit<PlanAgent, "framework" | "model" | "tools" | "instructions"> & Partial<PlanAgent>): PlanAgent {
  return {
    framework: "lyzr",
    model: "claude-opus-5",
    tools: [],
    instructions: `You are the ${a.name} agent. ${a.role} Be concise, cite your sources, and say when you're unsure.`,
    memory: { mode: "conversation", window: 20 },
    guardrails: /escalat/i.test(a.id) ? ["approve-external", "cite-sources", "human-handoff"] : ["approve-external", "cite-sources"],
    handoffs: [],
    ...a,
  };
}

const rows = (r: Row[]) => r;

export const BLUEPRINTS: Blueprint[] = [
  {
    id: "support-desk",
    appName: "Support Desk Copilot",
    tagline: "Answers tickets from your help docs and escalates the tricky ones.",
    overview:
      "A support inbox where every new ticket is triaged by urgency, an agent drafts a reply grounded in your help docs, and anything it isn't sure about goes to a person in Slack.",
    audience: "Support agents and team leads",
    theme: "studio",
    keywords: {
      strong: ["support", "ticket", "tickets", "helpdesk", "help desk", "customer service", "complaints"],
      weak: ["inbox", "reply", "replies", "customers", "escalate"],
    },
    pages: [
      { id: "overview", name: "Overview", kind: "dashboard", purpose: "Queue health at a glance: open, urgent and resolved today.", icon: "layout-dashboard", collection: "tickets", agent: "triage" },
      { id: "queue", name: "Queue", kind: "list", purpose: "Every ticket, sorted by urgency, with its suggested owner.", icon: "inbox", collection: "tickets", agent: "triage" },
      { id: "reply-studio", name: "Reply studio", kind: "workbench", purpose: "Review the drafted reply, check its sources, send it.", icon: "pen-line", collection: "tickets", agent: "drafter" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "triage",
        name: "Triage",
        handoffs: ["drafter", "escalation"],
        role: "Reads each new ticket, tags its topic and sets urgency.",
        tools: ["Gmail"],
        samples: [
          "Urgent · Billing. The customer was charged twice for order #48213. Suggested owner: Billing team. Confidence 0.93.",
          "Normal · Account. The password reset link expired. Suggested reply: resend the link with a 24-hour expiry.",
        ],
        trace: "Read ticket #4821 · matched 2 similar tickets",
      }),
      agent({
        id: "drafter",
        name: "Answer drafter",
        handoffs: ["escalation"],
        role: "Writes a reply grounded in the help docs, with citations.",
        tools: ["Knowledge base"],
        samples: [
          "Hi Maya,\n\nSorry about the double charge on order #48213. I've refunded the duplicate payment of $49.00, and you'll see it on your statement in 3–5 business days (Refund policy §2).\n\nAnything else I can help with?\n\nBest,\nThe support team",
          "Hi Omar,\n\nReset links expire after 30 minutes for security. I've sent you a fresh one that's valid for the next 24 hours (Account security §4).\n\nLet me know if it still doesn't work.",
        ],
        trace: "Searched help docs · 3 matches (Refund policy §2)",
      }),
      agent({
        id: "escalation",
        name: "Escalation",
        role: "Flags low-confidence or sensitive tickets and posts them to Slack.",
        tools: ["Slack"],
        samples: [
          "Escalated #48220 to #support-leads: the customer mentions a chargeback. Confidence is below 0.6, so a person should reply.",
        ],
        trace: "Posted to #support-leads",
      }),
    ],
    data: [
      {
        id: "tickets",
        name: "Tickets",
        singular: "Ticket",
        titleField: "subject",
        statusField: "urgency",
        fields: [
          { key: "subject", label: "Subject", type: "text" },
          { key: "customer", label: "Customer", type: "person" },
          { key: "topic", label: "Topic", type: "tag" },
          { key: "urgency", label: "Urgency", type: "status" },
          { key: "received", label: "Received", type: "date" },
        ],
        rows: rows([
          { subject: "Refund for double charge", customer: "Maya Chen", topic: "Billing", urgency: "Urgent", received: "2026-09-25" },
          { subject: "Can't reset my password", customer: "Omar Haddad", topic: "Account", urgency: "Normal", received: "2026-09-25" },
          { subject: "Invoice needs our VAT number", customer: "Lena Fischer", topic: "Billing", urgency: "Normal", received: "2026-09-24" },
          { subject: "Export to CSV is greyed out", customer: "Sam Okafor", topic: "Bug", urgency: "High", received: "2026-09-24" },
          { subject: "How do I add a teammate?", customer: "Priya Nair", topic: "How-to", urgency: "Low", received: "2026-09-23" },
          { subject: "Charged after cancelling", customer: "Diego Alvarez", topic: "Billing", urgency: "Urgent", received: "2026-09-23" },
        ]),
      },
      {
        id: "replies",
        name: "Replies",
        singular: "Reply",
        titleField: "ticket",
        statusField: "state",
        fields: [
          { key: "ticket", label: "Ticket", type: "text" },
          { key: "author", label: "Author", type: "person" },
          { key: "state", label: "State", type: "status" },
          { key: "sent", label: "Sent", type: "date" },
        ],
        rows: rows([
          { ticket: "Refund for double charge", author: "Answer drafter", state: "Needs review", sent: "" },
          { ticket: "Can't reset my password", author: "Answer drafter", state: "Sent", sent: "2026-09-25" },
          { ticket: "How do I add a teammate?", author: "Jordan Lee", state: "Sent", sent: "2026-09-23" },
          { ticket: "Charged after cancelling", author: "Escalation", state: "Draft", sent: "" },
        ]),
      },
    ],
    integrations: ["Gmail", "Slack", "Knowledge base"],
    questions: [
      {
        id: "source",
        text: "Where do tickets come from?",
        options: [
          { id: "gmail", label: "A shared inbox", note: "Tickets arrive from a shared Gmail inbox.", integrations: ["Gmail"] },
          { id: "widget", label: "A help widget on our site", note: "Tickets arrive from a help widget on the website." },
          { id: "both", label: "Both", note: "Tickets arrive from both the shared inbox and the website widget.", integrations: ["Gmail"] },
        ],
      },
      {
        id: "autonomy",
        text: "How much should the agents do on their own?",
        options: [
          { id: "approve", label: "Draft, I send", note: "Agents draft replies; a person approves every send." },
          { id: "auto", label: "Send the easy ones", note: "Agents send replies they're confident about (above 0.9) and queue the rest for review." },
        ],
      },
      {
        id: "escalate",
        text: "Who should hear about escalations?",
        multi: true,
        options: [
          { id: "slack", label: "A Slack channel", note: "Escalations post to a Slack channel.", integrations: ["Slack"] },
          { id: "email", label: "The team lead by email", note: "Escalations email the team lead.", integrations: ["Gmail"] },
          { id: "none", label: "No one for now", note: "Escalations stay in the queue for now." },
        ],
      },
    ],
    suggestions: ["Add a weekly report of top ticket topics", "Let customers rate each reply", "Send a Slack digest every morning"],
    testIssue: { found: "The queue showed a blank screen when there were no tickets", fix: "Added an empty state with a “Connect your inbox” button" },
  },
  {
    id: "resume-screener",
    appName: "Resume Screener",
    tagline: "Scores resumes against a role and books interviews with the best fits.",
    overview:
      "Paste a job description and upload resumes. An agent pulls out each candidate's experience, scores them against the role with reasons, and invites the strongest to an interview slot from your calendar.",
    audience: "Recruiters and hiring managers",
    theme: "meadow",
    keywords: {
      strong: ["resume", "resumes", "cv", "candidate", "candidates", "recruit", "recruiting", "hiring", "applicant"],
      weak: ["interview", "interviews", "job", "role", "talent"],
    },
    pages: [
      { id: "pipeline", name: "Pipeline", kind: "dashboard", purpose: "Candidates by stage and this week's interviews.", icon: "layout-dashboard", collection: "candidates", agent: "scorer" },
      {
        id: "screen",
        name: "Screen a role",
        kind: "run",
        purpose: "Paste a job description; agents parse, score and shortlist.",
        icon: "sparkles",
        collection: "candidates",
        agent: "scorer",
        input: { label: "Job description", placeholder: "Paste the job description…", cta: "Screen candidates" },
      },
      { id: "candidates", name: "Candidates", kind: "list", purpose: "Everyone who applied, with scores and reasons.", icon: "users", collection: "candidates", agent: "parser" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "parser",
        name: "Resume parser",
        handoffs: ["scorer"],
        role: "Pulls experience, skills and education out of each resume.",
        tools: ["Knowledge base"],
        samples: ["Priya Nair: 6 years backend (Go, Postgres, Kafka), led the payments migration at Finch, BSc Computer Science. Gap: no Kubernetes."],
        trace: "Parsed 12 resumes · 2 PDFs needed OCR",
      }),
      agent({
        id: "scorer",
        name: "Scorer",
        handoffs: ["scheduler"],
        role: "Scores each candidate 0–100 against the role and explains why.",
        samples: [
          "Top matches for Senior Backend Engineer:\n\n1. Priya Nair (91). Payments at scale, strong Postgres, has mentored juniors.\n2. Daniel Kim (84). Solid Go, lighter on distributed systems.\n3. Aisha Bello (79). Great system design; would need to ramp up on Go.\n\n9 others scored below 70.",
        ],
        trace: "Compared 12 candidates against 7 requirements",
      }),
      agent({
        id: "scheduler",
        name: "Scheduler",
        role: "Finds free interview slots and sends invites.",
        tools: ["Google Calendar", "Gmail"],
        samples: ["Invited Priya Nair to Tue 14:00–14:45 and Daniel Kim to Wed 10:30–11:15. Both invites include the panel and a video link."],
        trace: "Checked 3 calendars · found 4 shared slots",
      }),
    ],
    data: [
      {
        id: "candidates",
        name: "Candidates",
        singular: "Candidate",
        titleField: "name",
        statusField: "stage",
        fields: [
          { key: "name", label: "Name", type: "person" },
          { key: "role", label: "Role", type: "text" },
          { key: "score", label: "Score", type: "number" },
          { key: "stage", label: "Stage", type: "status" },
          { key: "applied", label: "Applied", type: "date" },
        ],
        rows: rows([
          { name: "Priya Nair", role: "Senior Backend Engineer", score: 91, stage: "Interview", applied: "2026-09-18" },
          { name: "Daniel Kim", role: "Senior Backend Engineer", score: 84, stage: "Interview", applied: "2026-09-19" },
          { name: "Aisha Bello", role: "Senior Backend Engineer", score: 79, stage: "Screened", applied: "2026-09-20" },
          { name: "Tomás Ruiz", role: "Product Designer", score: 74, stage: "Screened", applied: "2026-09-21" },
          { name: "Hannah Weiss", role: "Product Designer", score: 66, stage: "New", applied: "2026-09-23" },
          { name: "Kwame Mensah", role: "Senior Backend Engineer", score: 58, stage: "Rejected", applied: "2026-09-17" },
        ]),
      },
    ],
    integrations: ["Google Calendar", "Gmail"],
    questions: [
      {
        id: "roles",
        text: "How many roles do you hire for at once?",
        options: [
          { id: "one", label: "One at a time", note: "Screening focuses on one open role at a time." },
          { id: "several", label: "Several roles", note: "Candidates are grouped by role, with a role switcher." },
        ],
      },
      {
        id: "contact",
        text: "Should the app contact candidates?",
        options: [
          { id: "approve", label: "Only after I approve", note: "Invites go out only after you approve the shortlist." },
          { id: "auto", label: "Send invites automatically", note: "Candidates scoring above 85 get an invite automatically.", integrations: ["Gmail"] },
        ],
      },
      {
        id: "review",
        text: "Who reviews shortlists?",
        multi: true,
        options: [
          { id: "me", label: "Just me", note: "You review every shortlist." },
          { id: "managers", label: "Hiring managers", note: "Hiring managers can view shortlists and leave notes." },
          { id: "slack", label: "A Slack channel", note: "New shortlists post to Slack.", integrations: ["Slack"] },
        ],
      },
    ],
    suggestions: ["Add a rejection email with personal feedback", "Show time-to-hire for each role", "Let hiring managers leave scorecards"],
    testIssue: { found: "Scores above 100 broke the progress bars", fix: "Clamped scores to 0–100" },
  },
  {
    id: "lead-research",
    appName: "Lead Research Studio",
    tagline: "Researches a company, finds the right contact and writes the first email.",
    overview:
      "Enter a company name. A researcher agent summarises what they do and what's new, an enricher finds the likely decision maker, and a writer drafts a short, personal first email you can edit and save to your CRM.",
    audience: "Sales reps and founders doing outbound",
    theme: "bold",
    keywords: {
      strong: ["lead", "leads", "prospect", "prospects", "prospecting", "outreach", "outbound", "cold email", "sdr"],
      weak: ["sales", "crm", "deal", "deals", "pipeline", "hubspot"],
    },
    pages: [
      { id: "pipeline", name: "Pipeline", kind: "dashboard", purpose: "Leads by stage, reply rate and deal value.", icon: "layout-dashboard", collection: "leads", agent: "researcher" },
      {
        id: "research",
        name: "Research a company",
        kind: "run",
        purpose: "One company in, a brief, a contact and a first email out.",
        icon: "sparkles",
        collection: "leads",
        agent: "writer",
        input: { label: "Company", placeholder: "e.g. Northwind Logistics", cta: "Research" },
      },
      { id: "leads", name: "Leads", kind: "list", purpose: "Every lead with its stage and last touch.", icon: "users", collection: "leads", agent: "enricher" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "researcher",
        name: "Researcher",
        handoffs: ["enricher"],
        role: "Summarises what a company does and what's new.",
        tools: ["Web search"],
        samples: [
          "Northwind Logistics: mid-market 3PL, about 400 staff, headquartered in Rotterdam. Raised a €40M Series C in June to expand cold-chain warehousing. Hiring 12 operations roles; a new VP Operations started in August.",
        ],
        trace: "Read 6 sources · company site, press, LinkedIn",
      }),
      agent({
        id: "enricher",
        name: "Enricher",
        handoffs: ["writer"],
        role: "Finds the likely decision maker and their contact details.",
        tools: ["Apollo"],
        samples: ["Best contact: Sofie de Vries, VP Operations (joined Aug 2026). Email verified. Second choice: Mark Jansen, Head of Procurement."],
        trace: "Searched Apollo · 3 matching contacts",
      }),
      agent({
        id: "writer",
        name: "Email writer",
        role: "Drafts a short, personal first email.",
        tools: ["HubSpot"],
        samples: [
          "Subject: Cold-chain growth at Northwind\n\nHi Sofie,\n\nCongrats on the new role, and on the Series C. Scaling cold-chain capacity usually means dock scheduling gets messy fast; we help 3PLs cut dock wait times by about 30%.\n\nWorth a 20-minute look next week?\n\nBest,\nAlex",
        ],
        trace: "Saved draft to HubSpot",
      }),
    ],
    data: [
      {
        id: "leads",
        name: "Leads",
        singular: "Lead",
        titleField: "company",
        statusField: "stage",
        fields: [
          { key: "company", label: "Company", type: "text" },
          { key: "contact", label: "Contact", type: "person" },
          { key: "stage", label: "Stage", type: "status" },
          { key: "value", label: "Deal value", type: "money" },
          { key: "updated", label: "Last touch", type: "date" },
        ],
        rows: rows([
          { company: "Northwind Logistics", contact: "Sofie de Vries", stage: "Contacted", value: 48000, updated: "2026-09-25" },
          { company: "Brightline Health", contact: "Marcus Hale", stage: "Replied", value: 72000, updated: "2026-09-24" },
          { company: "Kestrel Foods", contact: "Ana Lima", stage: "Researched", value: 30000, updated: "2026-09-24" },
          { company: "Orbital Labs", contact: "Yuki Tanaka", stage: "Meeting", value: 96000, updated: "2026-09-22" },
          { company: "Harbor & Co", contact: "Ben Carter", stage: "New", value: 18000, updated: "2026-09-21" },
          { company: "Fenwick Energy", contact: "Ruth Adeyemi", stage: "Contacted", value: 54000, updated: "2026-09-20" },
        ]),
      },
    ],
    integrations: ["Apollo", "HubSpot", "Web search"],
    questions: [
      {
        id: "segment",
        text: "Who do you usually sell to?",
        options: [
          { id: "startups", label: "Startups", note: "Research focuses on funding, founders and hiring signals." },
          { id: "mid", label: "Mid-market", note: "Research focuses on growth signals and operations leaders." },
          { id: "enterprise", label: "Enterprise", note: "Research maps several stakeholders per account." },
        ],
      },
      {
        id: "drafts",
        text: "Where should drafts go?",
        options: [
          { id: "hubspot", label: "HubSpot", note: "Drafts are saved to the contact in HubSpot.", integrations: ["HubSpot"] },
          { id: "gmail", label: "Gmail drafts", note: "Drafts land in your Gmail drafts folder.", integrations: ["Gmail"] },
          { id: "app", label: "Keep them in the app", note: "Drafts stay in the app for you to copy." },
        ],
      },
    ],
    suggestions: ["Add a follow-up sequence after 3 days", "Score leads by how well they fit", "Pull replies back in from Gmail"],
    testIssue: { found: "Long company names overflowed the table", fix: "Truncated long names and added a tooltip" },
  },
  {
    id: "content-engine",
    appName: "Content Engine",
    tagline: "Turns one idea into a blog post, social posts and an SEO check.",
    overview:
      "Give a topic and a tone. A strategist agent outlines the piece, a writer drafts a blog post plus three LinkedIn posts, and an SEO reviewer suggests keywords and a meta description. Everything is editable before it's published.",
    audience: "Marketers and founders who write",
    theme: "paper",
    keywords: {
      strong: ["content", "blog", "seo", "newsletter", "linkedin posts", "social media", "copywriting"],
      weak: ["post", "posts", "article", "articles", "marketing", "social", "writing"],
    },
    pages: [
      { id: "calendar", name: "Calendar", kind: "dashboard", purpose: "What's drafting, in review and scheduled.", icon: "calendar", collection: "posts", agent: "strategist" },
      {
        id: "new-piece",
        name: "New piece",
        kind: "run",
        purpose: "One idea in, a full set of drafts out.",
        icon: "sparkles",
        collection: "posts",
        agent: "writer",
        input: { label: "Topic and tone", placeholder: "e.g. Why async standups work — friendly, practical", cta: "Draft it" },
      },
      { id: "drafts", name: "Drafts", kind: "workbench", purpose: "Edit drafts side by side with the SEO notes.", icon: "pen-line", collection: "posts", agent: "seo" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "strategist",
        name: "Strategist",
        handoffs: ["writer"],
        role: "Outlines the piece and picks the angle.",
        samples: [
          "Angle: async standups save focus time, but only with 3 rules.\n\nOutline:\n1. The hidden cost of daily meetings\n2. What to write in an async update\n3. Three rules that make it work\n4. A two-week trial plan",
        ],
        trace: "Read your last 12 posts for voice",
      }),
      agent({
        id: "writer",
        name: "Writer",
        handoffs: ["seo"],
        role: "Drafts the blog post and three LinkedIn posts.",
        samples: [
          "Why async standups work (when you follow 3 rules)\n\nMost teams don't hate standups; they hate the context switch. A 15-minute meeting at 10:00 can cost an engineer the whole morning's focus.\n\nHere's what changed when we moved ours to a written update…",
        ],
        trace: "Drafted 1 post and 3 LinkedIn variants",
      }),
      agent({
        id: "seo",
        name: "SEO reviewer",
        role: "Suggests keywords and a meta description.",
        tools: ["Web search"],
        samples: [
          "Primary keyword: “async standup” (2.4k searches a month, low difficulty). Add “remote team updates” in an H2.\n\nMeta description: “Async standups save focus time. Here are 3 rules that make them work, plus a two-week trial plan.” (104 characters)",
        ],
        trace: "Checked 8 competing articles",
      }),
    ],
    data: [
      {
        id: "posts",
        name: "Posts",
        singular: "Post",
        titleField: "title",
        statusField: "status",
        fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "channel", label: "Channel", type: "tag" },
          { key: "status", label: "Status", type: "status" },
          { key: "publish", label: "Publish on", type: "date" },
          { key: "author", label: "Author", type: "person" },
        ],
        rows: rows([
          { title: "Why async standups work", channel: "Blog", status: "Review", publish: "2026-09-30", author: "Writer" },
          { title: "3 rules for async updates", channel: "LinkedIn", status: "Scheduled", publish: "2026-10-01", author: "Writer" },
          { title: "Our pricing page teardown", channel: "Blog", status: "Drafting", publish: "2026-10-06", author: "Maya Chen" },
          { title: "What we learned from 100 demos", channel: "Newsletter", status: "Idea", publish: "", author: "Strategist" },
          { title: "Hiring our first designer", channel: "LinkedIn", status: "Published", publish: "2026-09-19", author: "Sam Okafor" },
        ]),
      },
    ],
    integrations: ["Notion", "LinkedIn"],
    questions: [
      {
        id: "channel",
        text: "What's your main channel?",
        options: [
          { id: "blog", label: "Blog", note: "The blog post is the main piece; social posts promote it." },
          { id: "linkedin", label: "LinkedIn", note: "LinkedIn posts are the main piece.", integrations: ["LinkedIn"] },
          { id: "newsletter", label: "Newsletter", note: "Drafts are shaped as a weekly newsletter." },
        ],
      },
      {
        id: "voice",
        text: "What should it sound like?",
        options: [
          { id: "friendly", label: "Friendly", note: "Voice: friendly and plain-spoken." },
          { id: "expert", label: "Expert", note: "Voice: precise and expert, with data." },
          { id: "bold", label: "Bold", note: "Voice: opinionated and punchy." },
        ],
      },
    ],
    suggestions: ["Add a brand voice guide the writer follows", "Turn posts into a weekly newsletter", "Track which posts drive sign-ups"],
    testIssue: { found: "Headings in drafts showed as plain text", fix: "Rendered drafts as formatted text" },
  },
  {
    id: "meeting-actions",
    appName: "Meeting Notes to Actions",
    tagline: "Summarises a transcript, pulls out owners and deadlines, posts them to Slack.",
    overview:
      "Paste or upload a meeting transcript. The app writes a short summary, pulls action items with owners and due dates into an editable table, and posts them to Slack or creates Linear issues in one click.",
    audience: "Team leads and anyone who runs recurring meetings",
    theme: "paper",
    keywords: {
      strong: ["meeting", "meetings", "transcript", "transcripts", "action items", "minutes", "standup"],
      weak: ["notes", "follow-up", "follow ups", "recap", "zoom"],
    },
    pages: [
      { id: "overview", name: "Overview", kind: "dashboard", purpose: "Open actions by owner and what's due this week.", icon: "layout-dashboard", collection: "actions", agent: "summarizer" },
      {
        id: "process",
        name: "Process a meeting",
        kind: "run",
        purpose: "Transcript in, summary and action items out.",
        icon: "sparkles",
        collection: "actions",
        agent: "extractor",
        input: { label: "Transcript", placeholder: "Paste a transcript, or drop a recording…", cta: "Extract actions" },
      },
      { id: "actions", name: "Action items", kind: "list", purpose: "Every action with its owner and due date.", icon: "list-checks", collection: "actions", agent: "notifier" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "summarizer",
        name: "Summarizer",
        handoffs: ["extractor"],
        role: "Writes a five-line summary of the meeting.",
        samples: [
          "Weekly product sync (42 min): the new onboarding shipped, churn is flat at 3.1%, and the pricing test starts Monday. Open question: who owns the enterprise SSO rollout?",
        ],
        trace: "Read 6,240 words",
      }),
      agent({
        id: "extractor",
        name: "Action extractor",
        handoffs: ["notifier"],
        role: "Pulls out every commitment with an owner and a due date.",
        samples: [
          "5 action items:\n• Lena: finalise the pricing test copy (Fri 3 Oct)\n• Omar: draft the SSO rollout plan (Tue 7 Oct)\n• Sam: fix the onboarding email typo (today)\n• Maya: share the churn dashboard with sales (Thu 2 Oct)\n• Team: decide who owns SSO (next sync)",
        ],
        trace: "Found 5 commitments · resolved 4 dates",
      }),
      agent({
        id: "notifier",
        name: "Notifier",
        role: "Posts actions to Slack and creates Linear issues.",
        tools: ["Slack", "Linear"],
        samples: ["Posted 5 action items to #product-sync and created 2 Linear issues (SSO rollout plan, onboarding email typo)."],
        trace: "Posted to #product-sync",
      }),
    ],
    data: [
      {
        id: "actions",
        name: "Actions",
        singular: "Action",
        titleField: "task",
        statusField: "status",
        fields: [
          { key: "task", label: "Task", type: "text" },
          { key: "owner", label: "Owner", type: "person" },
          { key: "due", label: "Due", type: "date" },
          { key: "status", label: "Status", type: "status" },
          { key: "meeting", label: "Meeting", type: "tag" },
        ],
        rows: rows([
          { task: "Finalise pricing test copy", owner: "Lena Fischer", due: "2026-10-03", status: "In progress", meeting: "Product sync" },
          { task: "Draft SSO rollout plan", owner: "Omar Haddad", due: "2026-10-07", status: "Open", meeting: "Product sync" },
          { task: "Fix onboarding email typo", owner: "Sam Okafor", due: "2026-09-25", status: "Done", meeting: "Product sync" },
          { task: "Share churn dashboard with sales", owner: "Maya Chen", due: "2026-10-02", status: "Open", meeting: "Product sync" },
          { task: "Book Q4 offsite venue", owner: "Priya Nair", due: "2026-10-10", status: "Blocked", meeting: "Leadership" },
        ]),
      },
    ],
    integrations: ["Slack", "Linear"],
    questions: [
      {
        id: "source",
        text: "Where do transcripts come from?",
        options: [
          { id: "paste", label: "I'll paste them in", note: "Transcripts are pasted or uploaded by hand." },
          { id: "zoom", label: "Zoom recordings", note: "New Zoom recordings are transcribed and processed automatically." },
          { id: "meet", label: "Google Meet", note: "Google Meet transcripts are picked up from Drive.", integrations: ["Google Drive"] },
        ],
      },
      {
        id: "destination",
        text: "Where should action items go?",
        multi: true,
        options: [
          { id: "slack", label: "Slack", note: "Actions post to the team's Slack channel.", integrations: ["Slack"] },
          { id: "linear", label: "Linear", note: "Engineering actions become Linear issues.", integrations: ["Linear"] },
          { id: "email", label: "An email recap", note: "Attendees get an email recap.", integrations: ["Gmail"] },
        ],
      },
    ],
    suggestions: ["Remind owners the day before an action is due", "Add a weekly digest of open actions", "Link actions back to the moment in the recording"],
    testIssue: { found: "Dates like “next Tuesday” weren't turned into real dates", fix: "Resolved relative dates to calendar dates" },
  },
  {
    id: "code-review",
    appName: "Code Review Assistant",
    tagline: "Reviews a pull request, flags risks and suggests the missing tests.",
    overview:
      "Paste a GitHub pull request URL. A diff-reader agent summarises the change, a reviewer lists risks by severity with file and line references, and a test agent proposes the missing test cases.",
    audience: "Engineering teams",
    theme: "midnight",
    keywords: {
      strong: ["code review", "pull request", "pull requests", "diff", "code reviews", "pr review"],
      weak: ["github", "repo", "code", "bugs", "engineering", "tests"],
    },
    pages: [
      { id: "reviews", name: "Reviews", kind: "dashboard", purpose: "Recent reviews and the risks they found.", icon: "layout-dashboard", collection: "reviews", agent: "reviewer" },
      {
        id: "review",
        name: "Review a PR",
        kind: "run",
        purpose: "A pull request in, a prioritised review out.",
        icon: "sparkles",
        collection: "reviews",
        agent: "reviewer",
        input: { label: "Pull request URL", placeholder: "https://github.com/acme/api/pull/482", cta: "Review" },
      },
      { id: "history", name: "History", kind: "list", purpose: "Every review, filterable by repo and risk.", icon: "history", collection: "reviews", agent: "tests" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "diff-reader",
        name: "Diff reader",
        handoffs: ["reviewer"],
        role: "Summarises what a pull request changes.",
        tools: ["GitHub"],
        samples: ["PR #482 adds rate limiting to the public API: new middleware (limits.ts, +120), Redis client wiring (+34) and config flags (+12). 7 files, +214 −31."],
        trace: "Fetched PR #482 · 7 files",
      }),
      agent({
        id: "reviewer",
        name: "Reviewer",
        handoffs: ["tests"],
        role: "Lists risks by severity with file and line references.",
        tools: ["GitHub"],
        samples: [
          "3 findings:\n\nHigh · limits.ts:48 — the limiter key uses the raw IP, so clients behind a shared proxy share one bucket. Use the API key when there is one.\nMedium · redis.ts:22 — no timeout on the Redis call; a slow Redis will stall every request.\nLow · config.ts:9 — document RATE_LIMIT_WINDOW in the README.",
        ],
        trace: "Read 214 added lines · checked 3 callers",
      }),
      agent({
        id: "tests",
        name: "Test suggester",
        role: "Proposes the test cases a change is missing.",
        samples: [
          "Missing tests:\n1. Two API keys behind the same IP get separate limits.\n2. Requests still pass when Redis times out (fail open).\n3. A 429 response includes a Retry-After header.",
        ],
        trace: "Compared with 42 existing tests",
      }),
    ],
    data: [
      {
        id: "reviews",
        name: "Reviews",
        singular: "Review",
        titleField: "pr",
        statusField: "risk",
        fields: [
          { key: "pr", label: "Pull request", type: "text" },
          { key: "repo", label: "Repo", type: "tag" },
          { key: "author", label: "Author", type: "person" },
          { key: "risk", label: "Risk", type: "status" },
          { key: "reviewed", label: "Reviewed", type: "date" },
        ],
        rows: rows([
          { pr: "#482 Add API rate limiting", repo: "api", author: "Omar Haddad", risk: "High", reviewed: "2026-09-25" },
          { pr: "#479 Cache org settings", repo: "api", author: "Lena Fischer", risk: "Medium", reviewed: "2026-09-24" },
          { pr: "#131 New billing page", repo: "web", author: "Maya Chen", risk: "Low", reviewed: "2026-09-24" },
          { pr: "#128 Bump React to 19.2", repo: "web", author: "Sam Okafor", risk: "Clean", reviewed: "2026-09-23" },
          { pr: "#476 Retry webhooks", repo: "api", author: "Priya Nair", risk: "Medium", reviewed: "2026-09-22" },
        ]),
      },
    ],
    integrations: ["GitHub"],
    questions: [
      {
        id: "where",
        text: "Where should reviews show up?",
        options: [
          { id: "comments", label: "As PR comments", note: "Reviews are posted as comments on the pull request.", integrations: ["GitHub"] },
          { id: "app", label: "Only in this app", note: "Reviews stay in the app until someone shares them." },
        ],
      },
      {
        id: "strictness",
        text: "How strict should it be?",
        options: [
          { id: "risks", label: "Real risks only", note: "The reviewer reports bugs, security and performance risks only." },
          { id: "all", label: "Everything, style too", note: "The reviewer also flags naming and style." },
        ],
      },
    ],
    suggestions: ["Post the review as a PR comment automatically", "Add a team style guide the reviewer follows", "Track which risks come up most"],
    testIssue: { found: "Very long diffs timed out the reviewer", fix: "Split large diffs into chunks of 400 lines" },
  },
  {
    id: "knowledge-chat",
    appName: "Team Knowledge Chat",
    tagline: "Answers questions from your docs, with citations your team can check.",
    overview:
      "Upload the handbook and wiki pages. People ask questions in plain English and get answers with citations to the exact document and section. Admins can see which questions went unanswered.",
    audience: "Everyone at the company, plus the people who own the docs",
    theme: "studio",
    keywords: {
      strong: ["knowledge base", "handbook", "wiki", "internal docs", "documentation", "rag", "faq"],
      weak: ["docs", "knowledge", "questions", "answers", "policies", "internal"],
    },
    pages: [
      { id: "ask", name: "Ask", kind: "chat", purpose: "Ask anything; every answer cites its sources.", icon: "message-square", agent: "answerer" },
      { id: "sources", name: "Sources", kind: "list", purpose: "Every connected document and when it was last synced.", icon: "library", collection: "docs", agent: "retriever" },
      { id: "gaps", name: "Gaps", kind: "dashboard", purpose: "Questions people asked that the docs couldn't answer.", icon: "layout-dashboard", collection: "questions", agent: "answerer" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "retriever",
        name: "Retriever",
        handoffs: ["answerer"],
        role: "Finds the passages that answer a question.",
        tools: ["Knowledge base", "Google Drive"],
        samples: ["Found 4 passages: Handbook › Time off §3.2, Handbook › Holidays §3.4, HR FAQ › Carry-over, Payroll › Unpaid leave."],
        trace: "Searched 128 documents · 4 relevant passages",
      }),
      agent({
        id: "answerer",
        name: "Answerer",
        role: "Answers in plain English and cites every claim.",
        samples: [
          "You get 25 days of paid leave a year, plus public holidays. Up to 5 unused days carry over to next year, as long as you use them by 31 March.\n\nSources: Handbook › Time off §3.2 · HR FAQ › Carry-over",
          "Expenses under £25 don't need a receipt, but you still need to log them within 30 days. Anything above that needs a photo of the receipt.\n\nSources: Expense policy §2.1",
        ],
        trace: "Searched 128 documents · 4 relevant passages",
      }),
    ],
    data: [
      {
        id: "docs",
        name: "Documents",
        singular: "Document",
        titleField: "title",
        statusField: "status",
        fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "source", label: "Source", type: "tag" },
          { key: "owner", label: "Owner", type: "person" },
          { key: "status", label: "Status", type: "status" },
          { key: "updated", label: "Updated", type: "date" },
        ],
        rows: rows([
          { title: "Employee handbook", source: "Drive", owner: "Priya Nair", status: "Indexed", updated: "2026-09-20" },
          { title: "Expense policy", source: "Confluence", owner: "Ben Carter", status: "Indexed", updated: "2026-09-12" },
          { title: "Security onboarding", source: "Confluence", owner: "Omar Haddad", status: "Stale", updated: "2026-03-02" },
          { title: "Brand guidelines", source: "Upload", owner: "Maya Chen", status: "Indexed", updated: "2026-08-28" },
          { title: "On-call runbook", source: "Drive", owner: "Sam Okafor", status: "Syncing", updated: "2026-09-25" },
        ]),
      },
      {
        id: "questions",
        name: "Questions",
        singular: "Question",
        titleField: "question",
        statusField: "answered",
        fields: [
          { key: "question", label: "Question", type: "text" },
          { key: "asked", label: "Times asked", type: "number" },
          { key: "answered", label: "Answered", type: "status" },
        ],
        rows: rows([
          { question: "How many days off do I get?", asked: 41, answered: "Answered" },
          { question: "Can I expense a home office chair?", asked: 17, answered: "Unanswered" },
          { question: "Who approves travel?", asked: 12, answered: "Answered" },
          { question: "What's the parental leave policy?", asked: 9, answered: "Answered" },
          { question: "Is there a learning budget?", asked: 8, answered: "Unanswered" },
        ]),
      },
    ],
    integrations: ["Google Drive", "Confluence", "Knowledge base"],
    questions: [
      {
        id: "sources",
        text: "Where do the docs live?",
        multi: true,
        options: [
          { id: "drive", label: "Google Drive", note: "Docs sync from Google Drive.", integrations: ["Google Drive"] },
          { id: "confluence", label: "Confluence", note: "Docs sync from Confluence.", integrations: ["Confluence"] },
          { id: "upload", label: "I'll upload files", note: "Docs are uploaded by hand." },
        ],
      },
      {
        id: "audience",
        text: "Who can ask questions?",
        options: [
          { id: "company", label: "Everyone at the company", note: "Anyone with a company email can ask." },
          { id: "team", label: "Only my team", note: "Access is limited to your team." },
        ],
      },
    ],
    suggestions: ["Add a Slack bot so people can ask from Slack", "Alert doc owners when a page goes stale", "Show the most-asked questions each week"],
    testIssue: { found: "Citations pointed at the wrong section on long pages", fix: "Anchored citations to section headings" },
  },
  {
    id: "market-brief",
    appName: "Market Research Brief",
    tagline: "Researches a market and writes a sourced two-page brief.",
    overview:
      "Describe a market or product idea. A researcher agent gathers sources from the web, an analyst sizes the market and lists competitors in a table, and a writer produces a two-page brief with citations.",
    audience: "Founders, product managers and strategy teams",
    theme: "paper",
    keywords: {
      strong: ["market research", "competitor", "competitors", "market size", "market analysis", "competitive"],
      weak: ["market", "research", "industry", "brief", "trends", "analysis"],
    },
    pages: [
      { id: "briefs", name: "Briefs", kind: "dashboard", purpose: "Every brief and where it stands.", icon: "layout-dashboard", collection: "competitors", agent: "analyst" },
      {
        id: "new-brief",
        name: "New brief",
        kind: "run",
        purpose: "A market in, a sourced brief out.",
        icon: "sparkles",
        collection: "competitors",
        agent: "writer",
        input: { label: "Market or idea", placeholder: "e.g. AI note-takers for clinics in the UK", cta: "Research" },
      },
      { id: "competitors", name: "Competitors", kind: "list", purpose: "Every competitor with pricing and threat level.", icon: "swords", collection: "competitors", agent: "researcher" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "researcher",
        name: "Web researcher",
        handoffs: ["analyst"],
        role: "Gathers sources from the web.",
        tools: ["Web search"],
        samples: ["Gathered 23 sources: 6 market reports, 9 competitor sites, 5 news articles and 3 regulator pages (NHS DSPT, ICO)."],
        trace: "Searched 14 queries · kept 23 sources",
      }),
      agent({
        id: "analyst",
        name: "Analyst",
        handoffs: ["writer"],
        role: "Sizes the market and compares competitors.",
        samples: [
          "UK clinic AI note-takers: about £120M in 2026, growing roughly 28% a year. 7 direct competitors; the top 3 hold about 60% share. Buyers care most about NHS compliance, EHR integration and accuracy on medical terms.",
        ],
        trace: "Cross-checked 6 reports",
      }),
      agent({
        id: "writer",
        name: "Writer",
        role: "Writes the two-page brief with citations.",
        tools: ["Google Docs"],
        samples: [
          "Brief: AI note-takers for UK clinics\n\nSummary. Demand is real and growing, driven by GP burnout and NHS funding for admin automation. Winning needs DSPT compliance from day one and an integration with EMIS or SystmOne…\n\n2 pages · 14 citations",
        ],
        trace: "Wrote 2 pages · 14 citations",
      }),
    ],
    data: [
      {
        id: "competitors",
        name: "Competitors",
        singular: "Competitor",
        titleField: "name",
        statusField: "threat",
        fields: [
          { key: "name", label: "Company", type: "text" },
          { key: "segment", label: "Segment", type: "tag" },
          { key: "pricing", label: "Price / seat / month", type: "money", currency: "GBP" },
          { key: "threat", label: "Threat", type: "status" },
        ],
        rows: rows([
          { name: "Scribewell", segment: "GP practices", pricing: 79, threat: "High" },
          { name: "NoteNurse", segment: "Private clinics", pricing: 59, threat: "High" },
          { name: "ClinicPal", segment: "GP practices", pricing: 45, threat: "Medium" },
          { name: "MedMemo", segment: "Hospitals", pricing: 120, threat: "Medium" },
          { name: "Quill Health", segment: "Therapists", pricing: 35, threat: "Low" },
        ]),
      },
    ],
    integrations: ["Web search", "Google Docs"],
    questions: [
      {
        id: "purpose",
        text: "What's the brief for?",
        options: [
          { id: "fundraising", label: "Fundraising", note: "The brief leads with market size and why now." },
          { id: "strategy", label: "Product strategy", note: "The brief leads with gaps competitors leave open." },
          { id: "entry", label: "Entering a market", note: "The brief leads with regulation and go-to-market." },
        ],
      },
      {
        id: "export",
        text: "Where should briefs go?",
        options: [
          { id: "docs", label: "Google Docs", note: "Briefs export to Google Docs.", integrations: ["Google Docs"] },
          { id: "pdf", label: "A PDF", note: "Briefs export as a PDF." },
          { id: "app", label: "Stay in the app", note: "Briefs stay in the app." },
        ],
      },
    ],
    suggestions: ["Track competitor pricing every week", "Export briefs as a slide deck", "Compare two markets side by side"],
    testIssue: { found: "The same source was numbered twice in citations", fix: "De-duplicated sources before numbering" },
  },
  {
    id: "expense-auditor",
    appName: "Expense Auditor",
    tagline: "Reads receipts, checks them against policy and flags exceptions.",
    overview:
      "People upload receipts. An agent extracts merchant, date, amount and category, a policy agent checks each one against your expense policy, and finance sees exceptions they can approve or reject.",
    audience: "Finance teams and managers who approve spend",
    theme: "studio",
    keywords: {
      strong: ["expense", "expenses", "receipt", "receipts", "reimbursement", "reimbursements"],
      weak: ["finance", "audit", "spend", "policy", "accounting"],
    },
    pages: [
      { id: "overview", name: "Overview", kind: "dashboard", purpose: "Spend this month and open exceptions.", icon: "layout-dashboard", collection: "expenses", agent: "checker" },
      { id: "review", name: "Review queue", kind: "workbench", purpose: "Approve or reject exceptions with the policy side by side.", icon: "scale", collection: "expenses", agent: "checker" },
      { id: "expenses", name: "All expenses", kind: "list", purpose: "Every expense with its policy check.", icon: "receipt", collection: "expenses", agent: "extractor" },
      settingsPage,
    ],
    agents: [
      agent({
        id: "extractor",
        name: "Extractor",
        handoffs: ["checker"],
        role: "Reads receipts and pulls out merchant, date, amount and category.",
        samples: ["Receipt read: The Ivy Soho · 12 Sep 2026 · £186.40 · Meals & entertainment · 4 guests listed."],
        trace: "Read 1 receipt · 98% confidence",
      }),
      agent({
        id: "checker",
        name: "Policy checker",
        role: "Checks each expense against the policy and explains exceptions.",
        tools: ["Knowledge base", "Google Sheets"],
        samples: [
          "Exception: £186.40 for 4 guests is £46.60 a head, over the £40 client-dinner limit (Expense policy §5.1).\n\nSuggestion: approve with a note, or ask for the client names.",
        ],
        trace: "Checked against Expense policy §5.1",
      }),
    ],
    data: [
      {
        id: "expenses",
        name: "Expenses",
        singular: "Expense",
        titleField: "merchant",
        statusField: "policy",
        fields: [
          { key: "merchant", label: "Merchant", type: "text" },
          { key: "employee", label: "Employee", type: "person" },
          { key: "amount", label: "Amount", type: "money", currency: "GBP" },
          { key: "category", label: "Category", type: "tag" },
          { key: "policy", label: "Policy check", type: "status" },
          { key: "date", label: "Date", type: "date" },
        ],
        rows: rows([
          { merchant: "The Ivy Soho", employee: "Ben Carter", amount: 186.4, category: "Meals", policy: "Exception", date: "2026-09-12" },
          { merchant: "British Airways", employee: "Priya Nair", amount: 412, category: "Travel", policy: "OK", date: "2026-09-15" },
          { merchant: "Pret A Manger", employee: "Sam Okafor", amount: 9.2, category: "Meals", policy: "OK", date: "2026-09-18" },
          { merchant: "Apple Store", employee: "Maya Chen", amount: 1299, category: "Equipment", policy: "Exception", date: "2026-09-19" },
          { merchant: "Uber", employee: "Omar Haddad", amount: 34.5, category: "Travel", policy: "Missing receipt", date: "2026-09-21" },
          { merchant: "WeWork", employee: "Lena Fischer", amount: 55, category: "Workspace", policy: "OK", date: "2026-09-22" },
        ]),
      },
    ],
    integrations: ["Google Sheets", "Knowledge base"],
    questions: [
      {
        id: "source",
        text: "Where do receipts come from?",
        options: [
          { id: "upload", label: "Uploaded in the app", note: "People upload receipts in the app." },
          { id: "email", label: "Forwarded emails", note: "Receipts forwarded to a finance inbox are picked up.", integrations: ["Gmail"] },
          { id: "cards", label: "A company card feed", note: "Card transactions are matched to receipts." },
        ],
      },
      {
        id: "approver",
        text: "Who approves exceptions?",
        options: [
          { id: "finance", label: "The finance team", note: "The finance team approves every exception." },
          { id: "manager", label: "Each person's manager", note: "Exceptions go to the employee's manager first." },
        ],
      },
    ],
    suggestions: ["Show monthly spend by team", "Auto-approve anything under £25 that passes policy", "Export approved expenses to Sheets"],
    testIssue: { found: "Amounts in euros were added to amounts in pounds", fix: "Converted every amount to GBP before totals" },
  },
  {
    id: "study-buddy",
    appName: "Study Buddy",
    tagline: "Explains your notes, quizzes you and tracks what you've mastered.",
    overview:
      "Upload lecture notes. A tutor agent explains any concept in simpler words, a quiz agent generates practice questions, and a progress page shows which topics you've mastered and which need review.",
    audience: "Students",
    theme: "meadow",
    keywords: {
      strong: ["study", "studying", "quiz", "quizzes", "exam", "exams", "flashcard", "flashcards", "tutor", "lecture"],
      weak: ["student", "students", "learn", "learning", "course", "revision"],
    },
    pages: [
      { id: "progress", name: "Progress", kind: "dashboard", purpose: "Topics mastered, learning and due for review.", icon: "layout-dashboard", collection: "topics", agent: "tutor" },
      { id: "tutor", name: "Tutor", kind: "chat", purpose: "Ask for an explanation in simpler words.", icon: "message-square", agent: "tutor" },
      {
        id: "quiz",
        name: "Quiz me",
        kind: "run",
        purpose: "A topic in, a practice quiz out.",
        icon: "sparkles",
        collection: "topics",
        agent: "quiz",
        input: { label: "Topic", placeholder: "e.g. The Krebs cycle", cta: "Make a quiz" },
      },
      settingsPage,
    ],
    agents: [
      agent({
        id: "tutor",
        name: "Tutor",
        handoffs: ["quiz"],
        role: "Explains concepts from your notes in simpler words.",
        tools: ["Knowledge base"],
        samples: [
          "Think of the Krebs cycle as a roundabout. Acetyl-CoA joins, goes once around, and each lap releases 2 CO₂ and loads up 3 NADH, 1 FADH₂ and 1 ATP. Those loaded carriers are what power most of your ATP later.",
          "Osmosis is water moving through a membrane towards the side with more dissolved stuff, trying to even things out. No energy needed: it's passive.",
        ],
        trace: "Read Lecture 7 notes · Biochemistry",
      }),
      agent({
        id: "quiz",
        name: "Quiz maker",
        role: "Writes practice questions from your notes.",
        samples: [
          "Quiz: the Krebs cycle (5 questions)\n1. Where in the cell does the Krebs cycle happen?\n2. How many NADH are made per turn?\n3. Which molecule joins oxaloacetate to start the cycle?\n4. Why is it called a cycle?\n5. How many CO₂ are released per turn?",
        ],
        trace: "Used Lecture 7 · 5 questions",
      }),
    ],
    data: [
      {
        id: "topics",
        name: "Topics",
        singular: "Topic",
        titleField: "topic",
        statusField: "status",
        fields: [
          { key: "topic", label: "Topic", type: "text" },
          { key: "course", label: "Course", type: "tag" },
          { key: "mastery", label: "Mastery %", type: "number" },
          { key: "status", label: "Status", type: "status" },
          { key: "reviewed", label: "Last reviewed", type: "date" },
        ],
        rows: rows([
          { topic: "Krebs cycle", course: "Biochemistry", mastery: 62, status: "Learning", reviewed: "2026-09-24" },
          { topic: "Glycolysis", course: "Biochemistry", mastery: 88, status: "Mastered", reviewed: "2026-09-20" },
          { topic: "Osmosis", course: "Cell biology", mastery: 45, status: "Needs review", reviewed: "2026-09-12" },
          { topic: "Enzyme kinetics", course: "Biochemistry", mastery: 71, status: "Learning", reviewed: "2026-09-22" },
          { topic: "Mitosis", course: "Cell biology", mastery: 93, status: "Mastered", reviewed: "2026-09-18" },
        ]),
      },
    ],
    integrations: ["Knowledge base"],
    questions: [
      {
        id: "subject",
        text: "What are you studying?",
        options: [
          { id: "science", label: "Science", note: "Explanations use diagrams-in-words and analogies." },
          { id: "humanities", label: "Humanities", note: "Explanations focus on arguments, dates and sources." },
          { id: "languages", label: "Languages", note: "Practice focuses on vocabulary and grammar drills." },
        ],
      },
      {
        id: "format",
        text: "How should it quiz you?",
        options: [
          { id: "mcq", label: "Multiple choice", note: "Quizzes use multiple-choice questions." },
          { id: "short", label: "Short answers", note: "Quizzes use short written answers, marked by the tutor." },
          { id: "cards", label: "Flashcards", note: "Practice uses flashcards with spaced repetition." },
        ],
      },
    ],
    suggestions: ["Add spaced repetition reminders", "Turn notes into flashcards automatically", "Show a study streak"],
    testIssue: { found: "The quiz repeated the same question twice", fix: "Removed duplicate questions" },
  },
];

export function getBlueprint(id: string) {
  return BLUEPRINTS.find((b) => b.id === id);
}
