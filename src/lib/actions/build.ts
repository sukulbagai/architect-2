"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db";
import { messages, projects, versions, type Project, type ProjectSettings } from "@/db/schema";
import { rowId } from "@/lib/ids";
import { applyPlanInstruction, buildPlan, estimate, matchBlueprint, planIdeas } from "@/lib/sim/plan";
import { generateFiles, pagePath } from "@/lib/sim/codegen";
import { buildScript, buildSummary, fileChanges } from "@/lib/sim/script";
import { applyEdit, type EditResult } from "@/lib/sim/edit";
import { breakIt, caughtText, fixIssue as fixPlanIssue, guardPage, maybeIssue, plantIssue, testChecks } from "@/lib/sim/issues";
import { commitMessage } from "@/lib/sim/commit";
import { applyVisualChange } from "@/lib/sim/visual-edit";
import { describeAgentChanges, toolIntegration } from "@/lib/sim/agents";
import { agentInput, testsInput } from "@/lib/agent-store";
import type { EditTarget, VisualChange } from "@/lib/sim/visual";
import {
  addMessage,
  currentFiles,
  nextVersionNumber,
  owned,
  planOf,
  recordUsage,
  repoAfter,
  saveEditVersion,
  toClientMessage,
  toClientVersion,
  type ClientMessage,
  type EditData,
} from "@/lib/project-store";
import type { AgentTest, BuildScript, Issue, Plan, PlanAgent, ProposalData, ProposalFile, TestReport } from "@/lib/sim/types";

export type { ClientMessage, ClientVersion, EditData } from "@/lib/project-store";

/* Everything here is simulated: plans, builds and edits come from local generators, so nothing
   calls a paid service. Results are saved exactly as a real build would save them. */

// ---------------------------------------------------------------------------------------------

const answersSchema = z.record(z.string(), z.array(z.string())).nullable();

export async function answerQuestions(projectId: string, rawAnswers: Record<string, string[]> | null) {
  const answers = answersSchema.parse(rawAnswers);
  const { db, ws, project } = await owned(projectId);
  const bp = matchBlueprint(project.prompt, project.settings.templateId, project.name);
  const plan: Plan = { ...buildPlan({ blueprint: bp, appName: project.name, answers, settings: project.settings }), appName: project.name };

  const [questionsMsg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.projectId, projectId), eq(messages.kind, "questions")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (questionsMsg) {
    await db
      .update(messages)
      .set({ data: { ...(questionsMsg.data as object), answered: answers ?? "skipped" } })
      .where(eq(messages.id, questionsMsg.id));
  }

  const labels = answers
    ? bp.questions.flatMap((q) => (answers[q.id] ?? []).map((id) => q.options.find((o) => o.id === id)?.label).filter(Boolean))
    : [];
  const user = await addMessage(db, projectId, {
    role: "user",
    kind: "chat",
    content: answers ? labels.join(" · ") : "Skip the questions",
    data: null,
  });
  const reply = await addMessage(
    db,
    projectId,
    {
      role: "assistant",
      kind: "plan",
      content: "Here's the plan. Edit anything in it, or tell me what to change.",
      data: {
        pages: plan.pages.length,
        agents: plan.agents.length,
        tables: plan.data.length,
        estimate: plan.estimate,
        integrations: plan.integrations,
      },
    },
    5,
  );

  await db.update(projects).set({ plan, updatedAt: new Date() }).where(eq(projects.id, projectId));
  await recordUsage(db, ws.id, projectId, [["plan", 4200, 2600]], project.settings.model);
  revalidatePath("/", "layout");
  return { plan, messages: [user, reply], questionsId: questionsMsg?.id ?? null, answered: answers ?? ("skipped" as const) };
}

// ---------------------------------------------------------------------------------------------

export async function startBuild(projectId: string): Promise<{ script: BuildScript; plan: Plan }> {
  const { db, project } = await owned(projectId);
  const plan = planOf(project);
  const files = generateFiles(plan, project.stack);
  const script = buildScript(plan, files);
  await db
    .update(projects)
    .set({ plan, stage: "build", status: "building", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  revalidatePath("/", "layout");
  return { script, plan };
}

export async function completeBuild(projectId: string, seconds: number) {
  const { db, ws, project } = await owned(projectId);
  const plan = planOf(project);
  const files = generateFiles(plan, project.stack);
  const number = await nextVersionNumber(db, projectId);
  const [version] = await db
    .insert(versions)
    .values({ id: rowId(), projectId, number, summary: number === 1 ? "First build" : "Rebuilt from the plan", files, plan })
    .returning();
  const linked = repoAfter(project, version.id);
  const message = await addMessage(db, projectId, {
    role: "assistant",
    kind: "build",
    content: `Built ${plan.appName}.`,
    data: buildSummary(plan, files, number, Math.round(seconds)),
  });
  await db
    .update(projects)
    .set({ stage: "ready", status: "draft", currentVersionId: version.id, ...linked, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const tok = Object.values(files).join("").length / 4;
  await recordUsage(db, ws.id, projectId, [
    ["agents", 3000, 1800 * plan.agents.length],
    ["ui", 9000, Math.round(tok)],
    ["build", 6000, 1200],
    ["test", 5000, 900],
  ], project.settings.model);
  revalidatePath("/", "layout");
  return { version: toClientVersion(version), message, repo: linked.repo ?? null };
}

export async function stopBuild(projectId: string) {
  const { db, project } = await owned(projectId);
  const hasVersion = !!project.currentVersionId;
  await db
    .update(projects)
    .set({ stage: hasVersion ? "ready" : "plan", status: "draft", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, {
    role: "system",
    kind: "event",
    content: "Build stopped. Nothing was saved, and you can resume from the plan any time.",
    data: { resumable: true },
  });
  revalidatePath("/", "layout");
  return { message, stage: hasVersion ? ("ready" as const) : ("plan" as const) };
}

// ---------------------------------------------------------------------------------------------

const sendOptions = z
  .object({ uiMode: z.enum(["simple", "pro"]).optional() })
  .optional();

/** The testing agent is on by default in Simple and off in Pro, where issues surface in the drawer. */
function testing(settings: ProjectSettings, uiMode: "simple" | "pro") {
  return settings.testAfterChanges ?? uiMode === "simple";
}

function checksFor(plan: Plan) {
  return testChecks(plan).length;
}

const MENTION = /(^|\s)@([\w./[\]-]+)/g;
const BREAK = /\b(?:and\s+)?break (?:it|this|the app)\b/i;

/**
 * A Build-mode change after the first build. Runs the edit engine, then the scripted bug and the
 * testing agent, and either saves a version or (Pro, with review on) proposes it as a diff.
 */
async function buildModeChange(db: DB, project: Project, plan: Plan, text: string, uiMode: "simple" | "pro", seedNumber: number) {
  const files = await currentFiles(db, project);
  const mentions = [...text.matchAll(MENTION)].map((m) => m[2].replace(/[.,;:!?]+$/, "")).filter((p) => files[p] !== undefined);
  const mentionedPage = plan.pages.find((p) => mentions.includes(pagePath(plan, p, project.stack)));
  let clean = text.replace(MENTION, "$1").replace(/\s+/g, " ").trim();
  const wantsBreak = BREAK.test(clean);
  if (wantsBreak) clean = clean.replace(BREAK, "").trim();

  let res: EditResult = wantsBreak && !clean ? { ok: true, plan, title: "", changes: [] } : applyEdit(plan, clean, { pageId: mentionedPage?.id });
  if (!res.ok && !wantsBreak) return { mentions, res };
  if (!res.ok) res = { ok: true, plan, title: "", changes: [] };

  let next = res.plan;
  let issue: Issue | undefined;
  let test: TestReport | undefined;
  const seed = `${project.id}:${seedNumber}:${clean}`;

  if (wantsBreak) {
    const broken = breakIt(next, res.focusPage ?? mentionedPage?.id, seed, project.stack);
    if (broken) {
      next = broken.plan;
      issue = broken.issue;
      res = {
        ...res,
        title: res.title ? `${res.title} and 1 more` : broken.title,
        changes: [...res.changes, ...broken.changes],
        focusPage: broken.focusPage,
      };
    }
  } else {
    const breaks = maybeIssue(next, res.trigger, seed);
    if (testing(project.settings, uiMode)) {
      test = { checks: checksFor(next) };
      if (breaks) {
        const planted = plantIssue(next, breaks, seed, project.stack);
        next = guardPage(planted.plan, breaks.id);
        test.caught = { plain: caughtText(planted.plan, planted.issue), fix: planted.issue.fix };
      }
    } else if (breaks) {
      const planted = plantIssue(next, breaks, seed, project.stack);
      next = planted.plan;
      issue = planted.issue;
    }
  }

  if (res.changes.length === 0) return { mentions, res: { ok: false as const, reply: "There's no page with data to switch over here.", examples: [] } };
  return { mentions, res: { ...res, plan: next }, issue, test };
}

export async function sendMessage(projectId: string, rawText: string, mode: "plan" | "build", rawOpts?: { uiMode?: "simple" | "pro" }) {
  const text = z.string().trim().min(1).max(4000).parse(rawText);
  const uiMode = sendOptions.parse(rawOpts)?.uiMode ?? "simple";
  const { db, ws, project } = await owned(projectId);
  const model = project.settings.model;
  const mentioned = uiMode === "pro" ? [...text.matchAll(MENTION)].map((m) => m[2]) : [];
  const user = await addMessage(db, projectId, {
    role: "user",
    kind: "chat",
    content: text,
    data: { mode, stage: project.stage, ...(mentioned.length ? { mentions: mentioned } : {}) },
  });

  if (project.stage === "build") {
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: "I'm still building. I'll pick this up as soon as the build finishes.", data: null }, 5);
    return { messages: [user, reply] };
  }

  const plan = planOf(project);

  if (project.stage === "plan") {
    const res = applyPlanInstruction(plan, text);
    await db.update(projects).set({ plan: res.plan, updatedAt: new Date() }).where(eq(projects.id, projectId));
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: res.reply, data: { changes: res.changes } }, 5);
    await recordUsage(db, ws.id, projectId, [["plan", 2400, 600]], model);
    revalidatePath("/", "layout");
    return { messages: [user, reply], plan: res.plan };
  }

  if (mode === "plan") {
    const ideas = planIdeas(plan, text);
    const reply = await addMessage(
      db,
      projectId,
      {
        role: "assistant",
        kind: "plan-reply",
        content: "Here's how I'd think about it. Nothing has changed in the app yet.",
        data: { ideas },
      },
      5,
    );
    await recordUsage(db, ws.id, projectId, [["plan", 3100, 700]], model);
    return { messages: [user, reply] };
  }

  const number = await nextVersionNumber(db, projectId);
  const out = await buildModeChange(db, project, plan, text, uiMode, number);
  const res = out.res;
  if (!res.ok) {
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: res.reply, data: { examples: res.examples } }, 5);
    return { messages: [user, reply] };
  }
  const issueRef = out.issue ? { id: out.issue.id, pageId: out.issue.pageId, plain: out.issue.plain } : undefined;
  const commit = commitMessage(res.title, res.changes);
  await recordUsage(db, ws.id, projectId, [["build", 7000, 2200], ...(out.test ? [["test", 3000, 500] as [string, number, number]] : [])], model);

  // Pro with review on: propose the change as a diff. Nothing is saved until it's accepted.
  if (uiMode === "pro" && project.settings.reviewChanges && project.currentVersionId) {
    const before = await currentFiles(db, project);
    const after = generateFiles(res.plan, project.stack);
    const files: ProposalFile[] = fileChanges(before, after).map((f) => ({ ...f, before: before[f.path] ?? null, after: after[f.path] ?? null }));
    const replaced = await supersedePending(db, projectId);
    const data: ProposalData & { issue?: EditData["issue"]; test?: TestReport } = {
      status: "pending",
      baseVersionId: project.currentVersionId,
      title: res.title,
      changes: res.changes,
      plan: res.plan,
      commit,
      files,
      focusPage: res.focusPage,
      ...(issueRef ? { issue: issueRef } : {}),
      ...(out.test ? { test: out.test } : {}),
    };
    const proposal = await addMessage(db, projectId, { role: "assistant", kind: "proposal", content: res.title, data }, 5);
    return { messages: [user, proposal], replaced };
  }

  const { version, edit, repo } = await saveEditVersion(db, project, res.plan, res.title, res.changes, "architect", {
    commit,
    focusPage: res.focusPage,
    ...(issueRef ? { issue: issueRef } : {}),
    ...(out.test ? { test: out.test } : {}),
  });
  const reply = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: res.title, data: edit }, 5);
  revalidatePath("/", "layout");
  return { messages: [user, reply], plan: res.plan, version, repo };
}

/** A newer proposal replaces any that are still waiting, so there's only ever one to review. */
async function supersedePending(db: DB, projectId: string) {
  const open = await db
    .select()
    .from(messages)
    .where(and(eq(messages.projectId, projectId), eq(messages.kind, "proposal")));
  const pending = open.filter((m) => (m.data as ProposalData | null)?.status === "pending");
  const out: ClientMessage[] = [];
  for (const m of pending) {
    const data = { ...(m.data as ProposalData), status: "discarded" as const, superseded: true };
    await db.update(messages).set({ data }).where(eq(messages.id, m.id));
    out.push(toClientMessage({ ...m, data }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

export async function savePlan(projectId: string, plan: Plan) {
  const { db, project } = await owned(projectId);
  if (project.stage !== "plan") throw new Error("Use applyPlan once the app is built");
  await db.update(projects).set({ plan, updatedAt: new Date() }).where(eq(projects.id, projectId));
  return { ok: true };
}

export async function applyPlan(projectId: string, plan: Plan) {
  const { db, ws, project } = await owned(projectId);
  const before = planOf(project);
  const changes: string[] = [];
  const names = (xs: { name: string }[]) => xs.map((x) => x.name);
  for (const n of names(plan.pages).filter((n) => !names(before.pages).includes(n))) changes.push(`Added the ${n} page`);
  for (const n of names(before.pages).filter((n) => !names(plan.pages).includes(n))) changes.push(`Removed the ${n} page`);
  for (const n of names(plan.agents).filter((n) => !names(before.agents).includes(n))) changes.push(`Added the ${n} agent`);
  for (const n of names(before.agents).filter((n) => !names(plan.agents).includes(n))) changes.push(`Removed the ${n} agent`);
  if (plan.appName !== before.appName) changes.push(`Renamed the app to ${plan.appName}`);
  if (changes.length === 0) changes.push("Updated descriptions from the plan");
  const { version, edit, repo } = await saveEditVersion(db, project, plan, "Applied plan changes", changes, "you");
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: "Applied plan changes", data: edit });
  await recordUsage(db, ws.id, projectId, [["build", 6000, 1800]], project.settings.model);
  revalidatePath("/", "layout");
  return { version, message, plan, repo };
}

export async function saveFile(projectId: string, path: string, content: string) {
  z.string().min(1).max(300).parse(path);
  z.string().max(200_000).parse(content);
  const { db, project } = await owned(projectId);
  const plan = planOf(project);
  const next: Plan = { ...plan, fileOverrides: { ...(plan.fileOverrides ?? {}), [path]: content } };
  const { version, edit, repo } = await saveEditVersion(db, project, next, `Edited ${path.split("/").pop()}`, [`You edited ${path}`], "you");
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: edit.title, data: edit });
  revalidatePath("/", "layout");
  return { version, message, plan: next, repo };
}

export async function restoreVersion(projectId: string, versionId: string) {
  const { db, project } = await owned(projectId);
  const [target] = await db
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, projectId)))
    .limit(1);
  if (!target) throw new Error("Version not found");
  const number = await nextVersionNumber(db, projectId);
  const [version] = await db
    .insert(versions)
    .values({ id: rowId(), projectId, number, summary: `Restored v${target.number}`, files: target.files, plan: target.plan })
    .returning();
  const linked = repoAfter(project, version.id);
  await db
    .update(projects)
    .set({ plan: target.plan, currentVersionId: version.id, stage: "ready", ...linked, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, {
    role: "system",
    kind: "event",
    content: `Restored v${target.number} as v${number}. Every version is still here if you change your mind.`,
    data: null,
  });
  revalidatePath("/", "layout");
  return { version: toClientVersion(version), message, plan: target.plan as Plan, repo: linked.repo ?? null };
}

// ---------------------------------------------------------------------------------------------
// Iterate: review, fixes, visual edits, testing, settings

async function proposalMessage(db: DB, projectId: string, messageId: string) {
  const [m] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.projectId, projectId), eq(messages.kind, "proposal")))
    .limit(1);
  if (!m) throw new Error("Proposal not found");
  return { row: m, data: m.data as ProposalData & { issue?: EditData["issue"]; test?: TestReport } };
}

export async function acceptProposal(projectId: string, messageId: string, rawPaths: string[], rawCommit: string) {
  const acceptedPaths = z.array(z.string().max(300)).max(500).parse(rawPaths);
  const commit = z.string().trim().min(1).max(200).parse(rawCommit);
  const { db, ws, project } = await owned(projectId);
  const { row, data } = await proposalMessage(db, projectId, messageId);
  if (data.status !== "pending") return { ok: false as const, reason: "closed" as const };
  if (project.currentVersionId !== data.baseVersionId) {
    return {
      ok: false as const,
      reason: "stale" as const,
      error: "The app changed since this was proposed. Ask again and I'll redo it against the latest version.",
    };
  }
  const accepted = new Set(acceptedPaths.filter((p) => data.files.some((f) => f.path === p)));
  if (accepted.size === 0) return { ok: false as const, reason: "empty" as const, error: "Pick at least one file, or discard the change." };

  // Rejected files stay exactly as they were: pinned to their base content (a rejected new file
  // stays out, a rejected deletion comes back). Files are still generated from the plan.
  const rejected = data.files.filter((f) => !accepted.has(f.path));
  let plan = data.plan;
  if (rejected.length) {
    const overrides = { ...(plan.fileOverrides ?? {}) };
    for (const f of rejected) overrides[f.path] = f.before;
    plan = { ...plan, fileOverrides: overrides };
  }
  const total = data.files.length;
  const changes = rejected.length
    ? [...data.changes, `Kept ${rejected.length === 1 ? rejected[0].path : `${rejected.length} files`} as ${rejected.length === 1 ? "it was" : "they were"}`]
    : data.changes;
  const { version, edit, repo } = await saveEditVersion(db, project, plan, commit, changes, "you", {
    commit,
    focusPage: data.focusPage,
    review: { accepted: accepted.size, total },
    ...(data.issue && plan.issues?.some((i) => i.id === data.issue!.id) ? { issue: data.issue } : {}),
    ...(data.test ? { test: data.test } : {}),
  });
  const closed = { ...data, status: rejected.length ? ("partial" as const) : ("accepted" as const), accepted: accepted.size, version: edit.version };
  await db.update(messages).set({ data: closed }).where(eq(messages.id, row.id));
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: commit, data: edit });
  await recordUsage(db, ws.id, projectId, [["review", 1200, 200]], project.settings.model);
  revalidatePath("/", "layout");
  return { ok: true as const, version, message, proposal: toClientMessage({ ...row, data: closed }), plan, repo };
}

export async function discardProposal(projectId: string, messageId: string) {
  const { db } = await owned(projectId);
  const { row, data } = await proposalMessage(db, projectId, messageId);
  if (data.status !== "pending") return { proposal: toClientMessage(row), message: null };
  const closed = { ...data, status: "discarded" as const };
  await db.update(messages).set({ data: closed }).where(eq(messages.id, row.id));
  const message = await addMessage(db, projectId, { role: "system", kind: "event", content: "Change discarded. The app is unchanged.", data: null });
  return { proposal: toClientMessage({ ...row, data: closed }), message };
}

const settingsPatch = z.object({
  reviewChanges: z.boolean().optional(),
  testAfterChanges: z.boolean().optional(),
  model: z.enum(["claude-opus-5", "claude-sonnet-5"]).optional(),
});

/** A general project-settings setter: review, testing and the build model today. */
export async function setProjectSettings(projectId: string, rawPatch: Partial<ProjectSettings>) {
  const patch = settingsPatch.parse(rawPatch);
  const { db, project } = await owned(projectId);
  const settings: ProjectSettings = { ...project.settings, ...patch };
  let plan = project.plan as Plan | null;
  if (patch.model && plan) {
    plan = { ...plan, model: patch.model };
    plan.estimate = estimate(plan);
  }
  await db.update(projects).set({ settings, ...(plan ? { plan } : {}), updatedAt: new Date() }).where(eq(projects.id, projectId));
  return { settings, plan };
}

export async function fixIssue(projectId: string, issueId: string) {
  z.string().min(1).max(80).parse(issueId);
  const { db, ws, project } = await owned(projectId);
  const fixed = fixPlanIssue(planOf(project), issueId);
  if (!fixed) return { ok: false as const, error: "That problem is already fixed." };
  const { plan, issue } = fixed;
  const title = `Fixed: ${issue.plain.replace(/\.$/, "")}`;
  const { version, edit, repo } = await saveEditVersion(db, project, plan, title, [issue.fix], "architect", {
    commit: commitMessage(title, [issue.fix], { type: "fix", scope: issue.pageId }),
    focusPage: issue.pageId,
    fixed: true,
  });
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: title, data: edit });
  await recordUsage(db, ws.id, projectId, [["fix", 5200, 900]], project.settings.model);
  revalidatePath("/", "layout");
  return { ok: true as const, version, message, plan, focusPage: issue.pageId, repo };
}

const targetSchema = z.object({
  editId: z.string().min(1).max(120),
  kind: z.string().max(40).optional(),
  pageId: z.string().max(80).optional(),
  text: z.string().max(400).optional(),
});
const changeSchema = z.object({
  text: z.string().max(400).optional(),
  tone: z.enum(["accent", "muted"]).nullable().optional(),
  size: z.enum(["s", "m", "l"]).nullable().optional(),
  prompt: z.string().max(1000).optional(),
});

export async function applyVisualEdit(projectId: string, rawTarget: EditTarget, rawChange: VisualChange) {
  const target = targetSchema.parse(rawTarget);
  const change = changeSchema.parse(rawChange);
  const { db, ws, project } = await owned(projectId);
  if (project.stage !== "ready") return { ok: false as const, error: "Build the app first, then point at what to change." };
  const res = applyVisualChange(planOf(project), target, change);
  if (!res.ok) return { ok: false as const, error: res.reply };
  const { version, edit, repo } = await saveEditVersion(db, project, res.plan, res.title, res.changes, "you", {
    commit: commitMessage(res.title, res.changes),
    focusPage: res.focusPage,
  });
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: res.title, data: edit });
  await recordUsage(db, ws.id, projectId, [["build", 2600, 700]], project.settings.model);
  revalidatePath("/", "layout");
  return { ok: true as const, version, message, plan: res.plan, focusPage: res.focusPage, repo };
}

/**
 * /test: the testing agent opens the app and clicks through it once. If a page is broken it fixes
 * it (a new version); otherwise it reports what it checked.
 */
export async function runTests(projectId: string) {
  const { db, ws, project } = await owned(projectId);
  if (project.stage !== "ready") return { ok: false as const, error: "There's nothing to test until the app is built." };
  const plan = planOf(project);
  const checks = checksFor(plan);
  await recordUsage(db, ws.id, projectId, [["test", 4200, 700]], project.settings.model);
  const open = plan.issues?.[0];
  if (open) {
    const fixed = fixPlanIssue(plan, open.id)!;
    const title = `Testing agent fixed the ${plan.pages.find((p) => p.id === open.pageId)?.name ?? "broken"} page`;
    const { version, edit, repo } = await saveEditVersion(db, project, fixed.plan, title, [open.fix], "architect", {
      commit: commitMessage(title, [open.fix], { type: "fix", scope: open.pageId }),
      focusPage: open.pageId,
      test: { checks },
      fixed: true,
    });
    const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: title, data: edit });
    revalidatePath("/", "layout");
    return { ok: true as const, version, message, plan: fixed.plan, focusPage: open.pageId, repo };
  }
  const results = testChecks(plan);
  const message = await addMessage(db, projectId, {
    role: "assistant",
    kind: "test",
    content: `${checks} checks passed`,
    data: { checks, pages: plan.pages.length, results },
  });
  return { ok: true as const, message };
}

// ---------------------------------------------------------------------------------------------
// Agents: the editor in the Agents tab saves one agent at a time

/**
 * Saves one agent from the Agents tab. Before the first build it just updates the plan; after it,
 * the agent's files are regenerated (in its framework) and the change lands as a version.
 */
export async function saveAgent(projectId: string, raw: PlanAgent) {
  const input = agentInput.parse(raw);
  const { db, ws, project } = await owned(projectId);
  if (project.stage === "build") return { ok: false as const, error: "Wait for the build to finish, then save." };
  const plan = planOf(project);
  const before = plan.agents.find((a) => a.id === input.id);
  if (!before) return { ok: false as const, error: "That agent isn't in the plan any more. Reload to see the latest." };

  const next: PlanAgent = {
    ...before,
    ...input,
    handoffs: (input.handoffs ?? []).filter((id) => id !== input.id && plan.agents.some((a) => a.id === id)),
    // Test cases are saved on their own, straight from the console.
    tests: before.tests,
  };
  const agents = plan.agents.map((a) => (a.id === input.id ? next : a));
  const integrations = [...plan.integrations];
  for (const t of next.tools) {
    const i = toolIntegration(t);
    if (i && !integrations.includes(i.name)) integrations.push(i.name);
  }
  const nextPlan: Plan = { ...plan, agents, integrations };
  nextPlan.estimate = estimate(nextPlan);

  const changes = describeAgentChanges(before, next, agents);
  if (changes.length === 0) return { ok: false as const, error: "Nothing has changed since the last save." };

  if (project.stage === "plan") {
    await db.update(projects).set({ plan: nextPlan, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return { ok: true as const, plan: nextPlan, changes };
  }

  const title = `Updated ${next.name}${/agent$/i.test(next.name) ? "" : " agent"}`;
  const { version, edit, repo } = await saveEditVersion(db, project, nextPlan, title, changes, "you", {
    commit: commitMessage(title, changes, { scope: "agents" }),
  });
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: title, data: edit });
  await recordUsage(db, ws.id, projectId, [["agents", 2400, 900]], project.settings.model);
  revalidatePath("/", "layout");
  return { ok: true as const, plan: nextPlan, changes, version, message, repo };
}

/** Test cases from the console. They're checks, not code, so they don't make a version. */
export async function saveAgentTests(projectId: string, agentId: string, raw: AgentTest[]) {
  const tests = testsInput.parse(raw);
  const { db, project } = await owned(projectId);
  const plan = planOf(project);
  if (!plan.agents.some((a) => a.id === agentId)) return { ok: false as const };
  const next: Plan = { ...plan, agents: plan.agents.map((a) => (a.id === agentId ? { ...a, tests } : a)) };
  await db.update(projects).set({ plan: next }).where(eq(projects.id, projectId));
  return { ok: true as const };
}
