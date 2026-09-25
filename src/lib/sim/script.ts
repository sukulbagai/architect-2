import { diffLines } from "diff";
import type { BuildEvent, BuildScript, BuildSummary, EditSummary, Plan } from "./types";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function fileOrder(path: string) {
  if (/^(frontend\/)?(package\.json|index\.html|vite\.config|tsconfig|next\.config)/.test(path)) return 0;
  if (/(theme\.css|globals\.css|main\.tsx|layout\.tsx|App\.tsx)$/.test(path)) return 1;
  if (/components\//.test(path)) return 2;
  if (/lib\//.test(path)) return 3;
  if (/pages\/|app\/.*page\.tsx|^app\/page\.tsx/.test(path)) return 4;
  if (/^backend\//.test(path)) return 5;
  return 6;
}

/**
 * The build as a timed script. The client plays it back: steps tick, files stream into the Code tab,
 * and the preview switches on once the first screen exists. Durations are compressed to ~25 s.
 */
export function buildScript(plan: Plan, files: Record<string, string>): BuildScript {
  const events: BuildEvent[] = [];
  let t = 0;
  const at = (ms: number) => (t += ms);

  events.push({ at: t, type: "step", step: "plan", status: "active" });
  events.push({
    at: at(700),
    type: "step",
    step: "plan",
    status: "done",
    detail: `${plan.pages.length} pages · ${plan.agents.length} agents · ${plan.data.length} ${plan.data.length === 1 ? "table" : "tables"}`,
  });

  events.push({ at: at(250), type: "step", step: "agents", status: "active" });
  for (const a of plan.agents) {
    events.push({ at: at(350), type: "sub", step: "agents", text: `Creating ${a.name}` });
    const path = `agents/${a.id}.yaml`;
    if (files[path]) events.push({ at: t, type: "file", path, duration: 700 });
    at(800);
  }
  events.push({ at: at(200), type: "step", step: "agents", status: "done", detail: plan.agents.map((a) => a.name).join(", ") });

  events.push({ at: at(250), type: "step", step: "data", status: "active" });
  const rows = plan.data.reduce((n, c) => n + c.rows.length, 0);
  events.push({ at: at(300), type: "sub", step: "data", text: `Creating ${plan.data.map((c) => c.name.toLowerCase()).join(", ")}` });
  for (const c of plan.data) {
    const path = Object.keys(files).find((p) => p.endsWith(`data/${c.id}.ts`));
    if (path) {
      events.push({ at: t, type: "file", path, duration: 600 });
      at(650);
    }
  }
  events.push({ at: at(250), type: "sub", step: "data", text: `Added ${rows} sample rows` });
  events.push({
    at: at(300),
    type: "step",
    step: "data",
    status: "done",
    detail: plan.data.map((c) => c.name.toLowerCase()).join(", "),
  });

  events.push({ at: at(250), type: "step", step: "ui", status: "active" });
  const ui = Object.keys(files)
    .filter((p) => !p.startsWith("agents/") && !/data\/[^/]+\.ts$/.test(p) && p !== "README.md" && p !== ".env.example")
    .sort((a, b) => fileOrder(a) - fileOrder(b) || a.localeCompare(b));
  const firstPage = ui.find((p) => fileOrder(p) === 4);
  const budget = 12500;
  const raw = ui.map((p) => clamp(files[p].length * 0.6, 220, 1500));
  const scale = Math.min(1, budget / raw.reduce((s, n) => s + n, 0));
  let previewSent = false;
  ui.forEach((path, i) => {
    const duration = Math.round(raw[i] * scale);
    events.push({ at: t, type: "file", path, duration });
    at(duration + 60);
    if (path === firstPage && !previewSent) {
      events.push({ at: t, type: "preview" });
      previewSent = true;
    }
  });
  if (!previewSent) events.push({ at: t, type: "preview" });
  for (const p of ["README.md", ".env.example"]) if (files[p]) {
    events.push({ at: t, type: "file", path: p, duration: 300 });
    at(340);
  }
  events.push({ at: at(150), type: "step", step: "ui", status: "done", detail: plan.pages.map((p) => p.name).join(", ") });

  events.push({ at: at(250), type: "step", step: "test", status: "active" });
  events.push({ at: at(500), type: "sub", step: "test", text: "Opened the app in a browser" });
  events.push({ at: at(900), type: "sub", step: "test", text: `Clicked through ${plan.pages.length} pages` });
  if (plan.testIssue) {
    events.push({ at: at(800), type: "sub", step: "test", text: `Found: ${plan.testIssue.found}` });
    events.push({ at: at(1100), type: "sub", step: "test", text: `Fixed: ${plan.testIssue.fix}` });
  }
  events.push({
    at: at(500),
    type: "step",
    step: "test",
    status: "done",
    detail: plan.testIssue ? "Fixed 1 issue on its own" : `${8 + plan.pages.length * 2} checks passed`,
  });
  events.push({ at: at(300), type: "step", step: "ready", status: "done", detail: `Built in ${Math.round(t / 1000)} s` });
  events.push({ at: at(100), type: "done" });

  return { events, duration: t, files, credits: plan.estimate.credits };
}

export function buildSummary(plan: Plan, files: Record<string, string>, version: number, seconds: number): BuildSummary {
  return {
    version,
    seconds,
    credits: plan.estimate.credits,
    pages: plan.pages.map((p) => p.name),
    agents: plan.agents.map((a) => a.name),
    tables: plan.data.map((c) => c.name),
    files: Object.keys(files).length,
    issue: plan.testIssue,
    suggestions: plan.suggestions.slice(0, 3),
  };
}

export function fileChanges(before: Record<string, string>, after: Record<string, string>): EditSummary["files"] {
  const out: EditSummary["files"] = [];
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const path of [...paths].sort()) {
    const a = before[path];
    const b = after[path];
    if (a === b) continue;
    if (a === undefined) {
      out.push({ path, added: b.split("\n").length, removed: 0, status: "added" });
    } else if (b === undefined) {
      out.push({ path, added: 0, removed: a.split("\n").length, status: "deleted" });
    } else {
      let added = 0;
      let removed = 0;
      for (const part of diffLines(a, b)) {
        if (part.added) added += part.count ?? 0;
        if (part.removed) removed += part.count ?? 0;
      }
      out.push({ path, added, removed, status: "modified" });
    }
  }
  return out;
}
