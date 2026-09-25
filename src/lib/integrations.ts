export type IntegrationCategory = "Code & deploy" | "Communication" | "Workspace" | "CRM & data" | "Custom";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Two-letter monogram and brand-ish tint for the tile (no third-party logos). */
  mono: string;
  tint: string;
  /** What the simulated consent screen asks for. */
  scopes: string[];
};

export const INTEGRATIONS: Integration[] = [
  { id: "github", name: "GitHub", category: "Code & deploy", description: "Import repos, sync every change, open pull requests.", mono: "GH", tint: "#24292f", scopes: ["Read and write the repos you pick", "Open pull requests", "Read your profile"] },
  { id: "vercel", name: "Vercel", category: "Code & deploy", description: "Deploy the generated app to your own Vercel team.", mono: "▲", tint: "#000000", scopes: ["Create deployments", "Read projects and domains"] },
  { id: "slack", name: "Slack", category: "Communication", description: "Let agents post updates, alerts and summaries to channels.", mono: "SL", tint: "#4a154b", scopes: ["Post messages", "Read channels you choose", "See your workspace's name"] },
  { id: "gmail", name: "Gmail", category: "Communication", description: "Read, draft and send email on your behalf.", mono: "GM", tint: "#c5221f", scopes: ["Read email in labels you choose", "Create drafts", "Send email after you approve it"] },
  { id: "teams", name: "Microsoft Teams", category: "Communication", description: "Message people and channels, post adaptive cards.", mono: "MT", tint: "#4b53bc", scopes: ["Post to channels you choose", "Send chat messages"] },
  { id: "notion", name: "Notion", category: "Workspace", description: "Create pages, update databases, pull team knowledge.", mono: "N", tint: "#191919", scopes: ["Read pages you share", "Create and edit pages", "Update databases"] },
  { id: "gdrive", name: "Google Drive", category: "Workspace", description: "Search, read and organise files and folders.", mono: "GD", tint: "#1a73e8", scopes: ["Search and read files you pick", "See file names and folders"] },
  { id: "gdocs", name: "Google Docs", category: "Workspace", description: "Write and update documents, with comments.", mono: "DO", tint: "#1a73e8", scopes: ["Create documents", "Edit documents Architect created"] },
  { id: "gcal", name: "Google Calendar", category: "Workspace", description: "Find free time, book meetings, invite people.", mono: "GC", tint: "#188038", scopes: ["See when you're free", "Create events and send invites"] },
  { id: "linear", name: "Linear", category: "Workspace", description: "Create issues, track cycles, assign work.", mono: "LI", tint: "#5e6ad2", scopes: ["Read issues and projects", "Create and update issues"] },
  { id: "jira", name: "Jira", category: "Workspace", description: "Create and move issues, compile release notes.", mono: "JI", tint: "#0052cc", scopes: ["Read projects and issues", "Create and transition issues"] },
  { id: "hubspot", name: "HubSpot", category: "CRM & data", description: "Create contacts, log activity, move deals.", mono: "HS", tint: "#ff5c35", scopes: ["Read and create contacts", "Log emails and notes", "Move deals between stages"] },
  { id: "apollo", name: "Apollo", category: "CRM & data", description: "Search contacts and enrich company profiles.", mono: "AP", tint: "#3b3be8", scopes: ["Search people and companies", "Use your enrichment credits"] },
  { id: "sheets", name: "Google Sheets", category: "CRM & data", description: "Read, append and calculate over spreadsheets.", mono: "GS", tint: "#188038", scopes: ["Read spreadsheets you pick", "Append rows"] },
  { id: "mcp", name: "MCP server", category: "Custom", description: "Connect any Model Context Protocol server by URL.", mono: "⌘", tint: "#cf4318", scopes: [] },
  { id: "webhook", name: "HTTP tool", category: "Custom", description: "Call any REST API with your own headers and auth.", mono: "{}", tint: "#6b6a62", scopes: [] },
];

export function integrationByName(name: string) {
  return INTEGRATIONS.find((i) => i.name.toLowerCase() === name.toLowerCase());
}

/** Tools an MCP server exposes, discovered by host. Scripted: nothing is called. */
export function mcpTools(url: string): string[] {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {}
  if (host.includes("deepwiki")) return ["read_wiki_structure", "read_wiki_contents", "ask_question"];
  if (host.includes("parallel")) return ["web_search", "extract"];
  if (host.includes("linear")) return ["list_issues", "create_issue", "update_issue"];
  return ["search", "fetch", "list_resources"];
}

/** "https://mcp.deepwiki.com/mcp" → "DeepWiki". Used as the default server name. */
export function mcpNameFromUrl(url: string) {
  try {
    const parts = new URL(url).hostname.split(".").filter((p) => !["mcp", "www", "api", "com", "io", "dev", "app", "ai", "net", "org"].includes(p));
    const word = parts[0] ?? "server";
    if (word === "deepwiki") return "DeepWiki";
    return word.charAt(0).toUpperCase() + word.slice(1);
  } catch {
    return "MCP server";
  }
}

/** A workspace connection as the client sees it. */
export type ConnectionView = {
  id: string;
  integrationId: string;
  kind: "oauth" | "mcp" | "http";
  label: string;
  account: string;
  tools: string[];
  url?: string;
  createdAt: Date;
};
