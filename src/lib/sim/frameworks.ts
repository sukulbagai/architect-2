/**
 * The agent frameworks Architect can generate code for. Config is saved per agent and the code is
 * real, readable source for that framework; nothing here runs on those frameworks.
 */

export type FrameworkId = "lyzr" | "langgraph" | "crewai" | "openai-agents" | "claude-agent-sdk" | "google-adk" | "mastra" | "gitagent";

export type FrameworkLanguage = "YAML" | "Python" | "TypeScript" | "Files";

export type Framework = {
  id: FrameworkId;
  label: string;
  language: FrameworkLanguage;
  /** One line for the picker. */
  description: string;
  /** Packages the generated project gains (package.json or requirements.txt). */
  packages: string[];
};

export const FRAMEWORK_LIST: Framework[] = [
  { id: "lyzr", label: "Lyzr", language: "YAML", description: "Hosted by Lyzr. Nothing to run yourself; the default.", packages: [] },
  { id: "langgraph", label: "LangGraph", language: "Python", description: "A graph of steps with state, loops and tool nodes.", packages: ["langgraph==0.6.7", "langchain-anthropic==0.3.20"] },
  { id: "crewai", label: "CrewAI", language: "Python", description: "Role-playing agents that work as a crew on tasks.", packages: ["crewai==0.186.1"] },
  { id: "openai-agents", label: "OpenAI Agents SDK", language: "TypeScript", description: "Lightweight agents with tools, handoffs and tracing.", packages: ["@openai/agents@^0.1.0", "zod@^3.25.0"] },
  { id: "claude-agent-sdk", label: "Claude Agent SDK", language: "TypeScript", description: "Claude's agent loop with tools and MCP built in.", packages: ["@anthropic-ai/claude-agent-sdk@^0.1.0", "zod@^3.25.0"] },
  { id: "google-adk", label: "Google ADK", language: "Python", description: "Google's Agent Development Kit, with a dev UI and evals.", packages: ["google-adk==1.14.0", "litellm==1.77.0"] },
  { id: "mastra", label: "Mastra", language: "TypeScript", description: "TypeScript agents with memory, workflows and evals.", packages: ["@mastra/core@^0.17.0", "@mastra/memory@^0.15.0", "@ai-sdk/anthropic@^2.0.0", "zod@^3.25.0"] },
  { id: "gitagent", label: "GitAgent", language: "Files", description: "An agent as plain files in the repo: soul, rules, skills.", packages: [] },
];

const BY_ID = new Map(FRAMEWORK_LIST.map((f) => [f.id, f]));

/** Accepts an id ("langgraph") or a label from older plans ("LangGraph"). Unknown values are Lyzr. */
export function frameworkOf(value: string | undefined): Framework {
  if (!value) return FRAMEWORK_LIST[0];
  const v = value.toLowerCase();
  return BY_ID.get(v as FrameworkId) ?? FRAMEWORK_LIST.find((f) => f.label.toLowerCase() === v) ?? FRAMEWORK_LIST[0];
}

export function frameworkLabel(value: string | undefined) {
  return frameworkOf(value).label;
}
