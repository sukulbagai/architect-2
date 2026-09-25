/**
 * The simulation's data model. A Plan fully describes an app: the Plan tab edits it, the preview
 * renders it, and the code generator turns it into files. Everything is deterministic, so the same
 * plan always produces the same files and the same preview.
 */

export type AppTheme = "paper" | "midnight" | "studio" | "meadow" | "bold";

export type PageKind = "dashboard" | "list" | "workbench" | "chat" | "run" | "settings";

export type FieldType = "text" | "longtext" | "number" | "money" | "date" | "status" | "email" | "person" | "tag";

export type PlanField = { key: string; label: string; type: FieldType; currency?: "USD" | "GBP" | "EUR" };

export type Row = Record<string, string | number>;

export type PlanCollection = {
  id: string;
  name: string;
  singular: string;
  fields: PlanField[];
  rows: Row[];
  titleField: string;
  statusField?: string;
};

export type AgentMemory = { mode: "off" | "conversation" | "long-term"; window?: number };
export type KnowledgeFile = { name: string; size: number; chunks: number };
export type AgentTest = { id: string; input: string; expect: string };

export type PlanAgent = {
  id: string;
  name: string;
  role: string;
  /** A framework id from `frameworks.ts` ("lyzr", "langgraph"…). Older plans stored the label ("Lyzr"). */
  framework: string;
  model: string;
  /** Built-ins ("Web search"), integration names ("Slack") and MCP servers ("mcp:DeepWiki"). */
  tools: string[];
  instructions: string;
  /** Scripted responses the preview plays back when the agent "runs". */
  samples: string[];
  /** A tool call the preview shows before the answer, for realism. */
  trace?: string;
  memory?: AgentMemory;
  /** Ids from `GUARDRAILS` in `agents.ts`. */
  guardrails?: string[];
  /** Agent ids this agent can hand work to. */
  handoffs?: string[];
  /** Names and sizes only: file contents never leave the browser. */
  knowledge?: KnowledgeFile[];
  /** Saved from the test console; `expect` is a phrase the reply should mention. */
  tests?: AgentTest[];
};

export type PlanPage = {
  id: string;
  name: string;
  kind: PageKind;
  purpose: string;
  icon: string;
  collection?: string;
  agent?: string;
  /** For "run" pages: what the user gives the agents. */
  input?: { label: string; placeholder: string; cta: string };
};

export type QuestionOption = {
  id: string;
  label: string;
  note: string;
  integrations?: string[];
  addPage?: PlanPage;
};

export type PlanQuestion = {
  id: string;
  text: string;
  multi?: boolean;
  options: QuestionOption[];
};

/**
 * A bug in the generated app. It's real in the generated code (codegen writes the unguarded line),
 * the preview renders the page's crash state, and fixing it produces a genuine diff.
 */
export type Issue = {
  id: string;
  pageId: string;
  severity: "error" | "warning";
  /** Simple: "The Reports page can't load its data yet." */
  plain: string;
  /** Pro: "TypeError: Cannot read properties of undefined (reading 'map')" */
  title: string;
  file: string;
  line: number;
  stack: string[];
  /** "Guarded the empty list and added a loading state" */
  fix: string;
};

export type EditTone = "accent" | "muted";
export type EditSize = "s" | "m" | "l";
export type EditStyle = { tone?: EditTone; size?: EditSize };

export type Plan = {
  blueprintId: string;
  appName: string;
  tagline: string;
  overview: string;
  audience: string;
  pages: PlanPage[];
  agents: PlanAgent[];
  data: PlanCollection[];
  integrations: string[];
  notes: string[];
  ui: {
    theme: AppTheme;
    banner?: string;
    search: boolean;
    compact?: boolean;
    /** Visual edits to text that has no plan field of its own, keyed by the element's edit id. */
    labels?: Record<string, string>;
    /** Visual edits to emphasis and size, keyed by the element's edit id. */
    styles?: Record<string, EditStyle>;
  };
  /** The model Architect builds with. Sonnet costs less, so it changes the estimate. */
  model?: string;
  /** Open bugs in the generated app. Versions snapshot them, so undo brings a bug back. */
  issues?: Issue[];
  /** Pages whose live-data loading has been guarded by a fix. */
  guards?: string[];
  /** Hand edits made in the Code tab; they survive regeneration. `null` keeps a file out. */
  fileOverrides?: Record<string, string | null>;
  /** Next steps suggested after a build. */
  suggestions: string[];
  /** A scripted issue the testing step finds and fixes. */
  testIssue?: { found: string; fix: string };
  estimate: { credits: number; seconds: number };
};

export type BuildStepId = "plan" | "agents" | "data" | "ui" | "test" | "ready";

export type BuildEvent =
  | { at: number; type: "step"; step: BuildStepId; status: "active" | "done"; detail?: string }
  | { at: number; type: "sub"; step: BuildStepId; text: string }
  | { at: number; type: "file"; path: string; duration: number }
  | { at: number; type: "preview" }
  | { at: number; type: "done" };

export type BuildScript = {
  events: BuildEvent[];
  duration: number;
  files: Record<string, string>;
  credits: number;
};

export type BuildSummary = {
  version: number;
  seconds: number;
  credits: number;
  pages: string[];
  agents: string[];
  tables: string[];
  files: number;
  issue?: { found: string; fix: string };
  suggestions: string[];
};

export type FileChange = { path: string; added: number; removed: number; status: "added" | "modified" | "deleted" };

export type EditSummary = {
  version: number;
  previousVersion: number;
  title: string;
  changes: string[];
  files: FileChange[];
};

/** A change waiting for review in Pro: nothing is saved until it's accepted. */
export type ProposalFile = FileChange & { before: string | null; after: string | null };

export type ProposalData = {
  status: "pending" | "accepted" | "partial" | "discarded";
  baseVersionId: string;
  title: string;
  changes: string[];
  plan: Plan;
  commit: string;
  files: ProposalFile[];
  focusPage?: string;
  /** Set when a newer proposal replaced this one before it was reviewed. */
  superseded?: boolean;
  /** How many files were accepted, and the version that made, once it's closed. */
  accepted?: number;
  version?: number;
};

/** What the testing agent did during a change, shown on the edit card. */
export type TestReport = { checks: number; caught?: { plain: string; fix: string } };
