export const ROLES = [
  { id: "founder", label: "Founder" },
  { id: "ops", label: "Operations" },
  { id: "sales", label: "Sales & Marketing" },
  { id: "product", label: "Product & Design" },
  { id: "engineer", label: "Engineering" },
  { id: "student", label: "Student" },
  { id: "other", label: "Something else" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const STACKS = [
  { id: "react-vite", label: "React + Vite", note: "Default. Runs in the live preview." },
  { id: "nextjs", label: "Next.js", note: "App Router, server routes." },
  { id: "fastapi-react", label: "FastAPI + React", note: "Python agents, React UI." },
] as const;

export const MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", note: "Default. Best code quality." },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Faster, about 60% cheaper." },
] as const;

export const THEME_PRESETS = [
  { id: "paper", label: "Paper", swatch: ["#fafaf8", "#17160f", "#cf4318"] },
  { id: "midnight", label: "Midnight", swatch: ["#0f1220", "#e6e8f2", "#7c9cff"] },
  { id: "studio", label: "Studio", swatch: ["#ffffff", "#111827", "#2563eb"] },
  { id: "meadow", label: "Meadow", swatch: ["#f6f8f1", "#1d2b1f", "#3f8f4f"] },
  { id: "bold", label: "Bold", swatch: ["#fff7e6", "#1a1a1a", "#ff3d00"] },
] as const;

export const FRAMEWORKS = [
  "Lyzr",
  "LangGraph",
  "CrewAI",
  "OpenAI Agents SDK",
  "Claude Agent SDK",
  "Google ADK",
  "Mastra",
  "GitAgent",
] as const;

export function stackLabel(id: string) {
  return STACKS.find((s) => s.id === id)?.label ?? id;
}

/** Cookie holding the rail's collapsed state, so the server renders it without a flash. */
export const RAIL_COOKIE = "architect_rail";
