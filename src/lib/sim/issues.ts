import { hashString } from "../seeded";
import { BUGGY_LINE, generateFiles, pagePath } from "./codegen";
import type { Issue, Plan, PlanPage } from "./types";

/**
 * Scripted bugs, so the Fix it flow is visible. Some edits that add a page or a field "break" the
 * page they touch: codegen writes a line that maps over data before it has loaded, the preview
 * shows the page's crash state, and the fix guards it. Everything is deterministic.
 */

export type IssueTrigger = { kind: "page" | "field"; pageId?: string };

const TITLE = "TypeError: Cannot read properties of undefined (reading 'map')";
const FIX = "Made the page wait for its data and show a loading state";

/** Pages that load data can break; settings and pages without a collection can't. */
function breakable(plan: Plan, pageId?: string): PlanPage | undefined {
  const ok = (p: PlanPage) => p.kind !== "settings" && !!p.collection && plan.data.some((c) => c.id === p.collection);
  const wanted = plan.pages.find((p) => p.id === pageId);
  if (wanted && ok(wanted)) return wanted;
  return plan.pages.find((p) => ok(p) && p.kind === "list") ?? plan.pages.find(ok);
}

/** The file, line and stack for an issue, read from the code this plan generates. */
function locate(plan: Plan, page: PlanPage, stack: string) {
  const file = pagePath(plan, page, stack);
  const source = generateFiles(plan, stack)[file] ?? "";
  const lines = source.split("\n");
  const index = lines.findIndex((l) => l.includes(BUGGY_LINE));
  const line = index >= 0 ? index + 1 : 1;
  const column = index >= 0 ? lines[index].indexOf(".map") + 2 : 1;
  const component = file.startsWith("app/") ? `${page.name.replace(/[^a-zA-Z0-9]/g, "")}Page` : file.split("/").pop()!.replace(/\.tsx$/, "");
  const react = "node_modules/react-dom/cjs/react-dom-client.development.js";
  return {
    file,
    line,
    stack: [
      `at ${component} (${file}:${line}:${column})`,
      `at renderWithHooks (${react}:5654:22)`,
      `at updateFunctionComponent (${react}:8931:19)`,
      `at beginWork (${react}:10556:18)`,
      `at performUnitOfWork (${react}:15179:22)`,
    ],
  };
}

/** Adds an open issue to a page and fills in where it lives in the generated code. */
export function plantIssue(plan: Plan, page: PlanPage, seed: string, stack: string): { plan: Plan; issue: Issue } {
  const draft: Issue = {
    id: `iss_${hashString(`${seed}:${page.id}`).toString(36)}`,
    pageId: page.id,
    severity: "error",
    plain: `The ${page.name} page can't load its data yet.`,
    title: TITLE,
    file: "",
    line: 1,
    stack: [],
    fix: FIX,
  };
  const next: Plan = { ...plan, issues: [...(plan.issues ?? []).filter((i) => i.pageId !== page.id), draft] };
  const issue = { ...draft, ...locate(next, page, stack) };
  next.issues = next.issues!.map((i) => (i.id === issue.id ? issue : i));
  return { plan: next, issue };
}

/**
 * Roughly one in three edits that add a page or a field leaves a bug on the page it touched.
 * Theme, banner and rename edits never do. Returns the page that would break, or nothing.
 */
export function maybeIssue(plan: Plan, trigger: IssueTrigger | undefined, seed: string): PlanPage | undefined {
  if (!trigger) return undefined;
  if (hashString(seed) % 3 !== 0) return undefined;
  const page = breakable(plan, trigger.pageId);
  return page && page.id === (trigger.pageId ?? page.id) ? page : undefined;
}

/** "break it": a hidden trigger that always breaks a page, for demos and QA. */
export function breakIt(plan: Plan, pageId: string | undefined, seed: string, stack: string) {
  const page = breakable(plan, pageId);
  if (!page) return null;
  const { plan: next, issue } = plantIssue(plan, page, seed, stack);
  return {
    plan: next,
    issue,
    title: `Switched the ${page.name} page to live data`,
    changes: [`Switched the ${page.name} page to live data from the API`],
    focusPage: page.id,
  };
}

/** The testing agent (or Fix it) repairs a page: the issue closes and the page keeps its guard. */
export function guardPage(plan: Plan, pageId: string): Plan {
  return {
    ...plan,
    issues: (plan.issues ?? []).filter((i) => i.pageId !== pageId),
    guards: [...new Set([...(plan.guards ?? []), pageId])],
  };
}

export function fixIssue(plan: Plan, issueId: string): { plan: Plan; issue: Issue } | null {
  const issue = plan.issues?.find((i) => i.id === issueId);
  if (!issue) return null;
  const page = plan.pages.find((p) => p.id === issue.pageId);
  const next = guardPage(plan, issue.pageId);
  next.notes = [...next.notes, `${page?.name ?? "Pages"} load live data safely, with a loading state.`];
  return { plan: next, issue };
}

/** How the testing agent describes a bug it caught, after the fact. */
export function caughtText(plan: Plan, issue: Issue) {
  const page = plan.pages.find((p) => p.id === issue.pageId);
  return `The ${page?.name ?? "new"} page crashed while loading its data`;
}

/** What the testing agent checks. The count on every report comes from this list. */
export function testChecks(plan: Plan) {
  return [
    "Opened the app in a browser",
    ...plan.pages.map((p) => `${p.name} loads without errors`),
    ...plan.pages.map((p) => `${p.name} fits a phone screen`),
    ...plan.agents.slice(0, 3).map((a) => `${a.name} answers a sample request`),
    ...(plan.ui.search ? ["Search filters the list"] : []),
    "Every link and button goes somewhere",
    "Forms submit and show a confirmation",
    "No errors in the browser console",
  ];
}
