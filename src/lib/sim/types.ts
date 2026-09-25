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

export type PlanAgent = {
  id: string;
  name: string;
  role: string;
  framework: string;
  model: string;
  tools: string[];
  instructions: string;
  /** Scripted responses the preview plays back when the agent "runs". */
  samples: string[];
  /** A tool call the preview shows before the answer, for realism. */
  trace?: string;
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
  };
  /** Hand edits made in the Code tab; they survive regeneration. */
  fileOverrides?: Record<string, string>;
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

export type EditSummary = {
  version: number;
  previousVersion: number;
  title: string;
  changes: string[];
  files: { path: string; added: number; removed: number; status: "added" | "modified" | "deleted" }[];
};
