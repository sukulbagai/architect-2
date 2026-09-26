import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AgentMemory, AgentTest, KnowledgeFile, PlanAgent } from "@/lib/sim/types";
import type { ProjectRepo } from "@/lib/sim/github";

export type Mode = "simple" | "pro";
export type ProjectStatus = "draft" | "building" | "live" | "error";
export type ProjectStage = "plan" | "build" | "ready";
export type ProjectSource = "prompt" | "template" | "import";

export type MessageKind = "chat" | "questions" | "plan" | "plan-reply" | "build" | "edit" | "event" | "proposal" | "test" | "import";

export type ProjectSettings = {
  themePreset?: string;
  model?: string;
  stack?: string;
  planFirst?: boolean;
  attachments?: { name: string; size: number; kind: "document" | "data" | "image" }[];
  templateId?: string;
  /** Pro: each Build-mode change arrives as a diff to accept or reject. Off by default. */
  reviewChanges?: boolean;
  /** A testing agent checks the app after each change. Unset means on in Simple, off in Pro. */
  testAfterChanges?: boolean;
  /** Standalone agents picked from the Home composer's + menu, snapshotted so the plan can include them. */
  attachedAgents?: PlanAgent[];
  /** Set on imported projects: where the code came from and whether the preview can run it. */
  import?: ProjectImport;
};

export type ProjectImport = {
  source: "github" | "url" | "zip";
  /** "owner/repo", or the ZIP's file name. */
  from: string;
  branch: string | null;
  framework: string;
  previewable: boolean;
  /** Why it can't preview, in one sentence. */
  reason?: string;
  envVars: string[];
};

/** Everything about a standalone agent that isn't a column: the same shape a plan agent has. */
export type AgentConfig = {
  memory?: AgentMemory;
  guardrails?: string[];
  handoffs?: string[];
  tests?: AgentTest[];
  samples?: string[];
  trace?: string;
  /** What the person typed in the New agent wizard. */
  prompt?: string;
};

export type AgentWidget = { color: string; greeting: string; position: "bottom-right" | "bottom-left" };

export type ConnectionKind = "oauth" | "mcp" | "http";
export type ConnectionConfig = {
  scopes?: string[];
  url?: string;
  tools?: string[];
  /** A masked hint of an auth header ("Bearer ••••a91f"). The header itself is never stored. */
  headerHint?: string;
  /** The account the simulated consent screen showed. */
  account?: string;
};

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** A workspace is the unit of identity. Its id lives in an httpOnly cookie; there is no password. */
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  signInMethod: text("sign_in_method").notNull().default("email"),
  role: text("role"),
  mode: text("mode").$type<Mode>().notNull().default("simple"),
  avatarHue: integer("avatar_hue").notNull().default(24),
  githubLogin: text("github_login"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    prompt: text("prompt").notNull().default(""),
    status: text("status").$type<ProjectStatus>().notNull().default("draft"),
    stage: text("stage").$type<ProjectStage>().notNull().default("plan"),
    source: text("source").$type<ProjectSource>().notNull().default("prompt"),
    stack: text("stack").notNull().default("react-vite"),
    settings: jsonb("settings").$type<ProjectSettings>().notNull().default({}),
    plan: jsonb("plan"),
    /** The linked (simulated) GitHub repository: branches as lists of version ids, pull requests. */
    repo: jsonb("repo").$type<ProjectRepo | null>(),
    currentVersionId: text("current_version_id"),
    lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("projects_workspace_idx").on(t.workspaceId, t.updatedAt),
    uniqueIndex("projects_slug_idx").on(t.slug),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    kind: text("kind").$type<MessageKind>().notNull().default("chat"),
    content: text("content").notNull().default(""),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_project_idx").on(t.projectId, t.createdAt)],
);

export const versions = pgTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    summary: text("summary").notNull().default(""),
    files: jsonb("files").$type<Record<string, string>>().notNull().default({}),
    /** Snapshot of the plan this version was built from, so a restore brings back both. */
    plan: jsonb("plan"),
    messageId: text("message_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("versions_project_number_idx").on(t.projectId, t.number)],
);

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    framework: text("framework").notNull().default("lyzr"),
    model: text("model").notNull().default("claude-opus-5"),
    instructions: text("instructions").notNull().default(""),
    tools: jsonb("tools").$type<string[]>().notNull().default([]),
    knowledge: jsonb("knowledge").$type<KnowledgeFile[]>().notNull().default([]),
    published: boolean("published").notNull().default(false),
    /** sha256 of the API key; the key itself is shown once and never stored. */
    apiKeyHash: text("api_key_hash"),
    apiKeyPrefix: text("api_key_prefix"),
    apiKeyCreatedAt: timestamp("api_key_created_at", { withTimezone: true }),
    widget: jsonb("widget").$type<AgentWidget>(),
    config: jsonb("config").$type<AgentConfig>().notNull().default({}),
    /** Real calls to the public API and the widget (the Usage tab adds simulated history). */
    runs: integer("runs").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("agents_workspace_idx").on(t.workspaceId)],
);

/** A simulated connection to an integration or an MCP server, shared by every agent in the workspace. */
export const connections = pgTable(
  "connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    integrationId: text("integration_id").notNull(),
    kind: text("kind").$type<ConnectionKind>().notNull().default("oauth"),
    label: text("label").notNull(),
    config: jsonb("config").$type<ConnectionConfig>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("connections_workspace_idx").on(t.workspaceId, t.createdAt),
    uniqueIndex("connections_oauth_idx").on(t.workspaceId, t.integrationId).where(sql`${t.kind} = 'oauth'`),
  ],
);

export const deployments = pgTable(
  "deployments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull(),
    slug: text("slug").notNull(),
    environment: text("environment").$type<"preview" | "production">().notNull().default("production"),
    status: text("status").$type<"queued" | "building" | "ready" | "failed">().notNull().default("queued"),
    logs: jsonb("logs").$type<{ at: string; line: string }[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("deployments_project_idx").on(t.projectId, t.createdAt)],
);

export const envVars = pgTable(
  "env_vars",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("env_vars_project_key_idx").on(t.projectId, t.key)],
);

export const usage = pgTable(
  "usage",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    step: text("step").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 5 }).notNull().default("0"),
    createdAt: createdAt(),
  },
  (t) => [index("usage_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
