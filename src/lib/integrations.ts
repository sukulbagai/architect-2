export type IntegrationCategory = "Code & deploy" | "Communication" | "Workspace" | "CRM & data" | "Custom";

export type Integration = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Two-letter monogram and brand-ish tint for the tile (no third-party logos). */
  mono: string;
  tint: string;
};

export const INTEGRATIONS: Integration[] = [
  { id: "github", name: "GitHub", category: "Code & deploy", description: "Import repos, sync every change, open pull requests.", mono: "GH", tint: "#24292f" },
  { id: "vercel", name: "Vercel", category: "Code & deploy", description: "Deploy the generated app to your own Vercel team.", mono: "▲", tint: "#000000" },
  { id: "slack", name: "Slack", category: "Communication", description: "Let agents post updates, alerts and summaries to channels.", mono: "SL", tint: "#4a154b" },
  { id: "gmail", name: "Gmail", category: "Communication", description: "Read, draft and send email on your behalf.", mono: "GM", tint: "#c5221f" },
  { id: "teams", name: "Microsoft Teams", category: "Communication", description: "Message people and channels, post adaptive cards.", mono: "MT", tint: "#4b53bc" },
  { id: "notion", name: "Notion", category: "Workspace", description: "Create pages, update databases, pull team knowledge.", mono: "N", tint: "#191919" },
  { id: "gdrive", name: "Google Drive", category: "Workspace", description: "Search, read and organise files and folders.", mono: "GD", tint: "#1a73e8" },
  { id: "gcal", name: "Google Calendar", category: "Workspace", description: "Find free time, book meetings, invite people.", mono: "GC", tint: "#188038" },
  { id: "linear", name: "Linear", category: "Workspace", description: "Create issues, track cycles, assign work.", mono: "LI", tint: "#5e6ad2" },
  { id: "jira", name: "Jira", category: "Workspace", description: "Create and move issues, compile release notes.", mono: "JI", tint: "#0052cc" },
  { id: "hubspot", name: "HubSpot", category: "CRM & data", description: "Create contacts, log activity, move deals.", mono: "HS", tint: "#ff5c35" },
  { id: "apollo", name: "Apollo", category: "CRM & data", description: "Search contacts and enrich company profiles.", mono: "AP", tint: "#3b3be8" },
  { id: "sheets", name: "Google Sheets", category: "CRM & data", description: "Read, append and calculate over spreadsheets.", mono: "GS", tint: "#188038" },
  { id: "mcp", name: "MCP server", category: "Custom", description: "Connect any Model Context Protocol server by URL.", mono: "⌘", tint: "#cf4318" },
  { id: "webhook", name: "HTTP tool", category: "Custom", description: "Call any REST API with your own headers and auth.", mono: "{}", tint: "#6b6a62" },
];
