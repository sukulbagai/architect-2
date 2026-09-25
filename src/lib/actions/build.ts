"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DB } from "@/db";
import { messages, projects, usage, versions, type Message, type Project, type Version } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId } from "@/lib/ids";
import { applyPlanInstruction, buildPlan, matchBlueprint, planIdeas } from "@/lib/sim/plan";
import { generateFiles } from "@/lib/sim/codegen";
import { buildScript, buildSummary, fileChanges } from "@/lib/sim/script";
import { applyEdit } from "@/lib/sim/edit";
import type { BuildScript, EditSummary, Plan } from "@/lib/sim/types";

/* Everything here is simulated: plans, builds and edits come from local generators, so nothing
   calls a paid service. Results are saved exactly as a real build would save them. */

export type ClientMessage = Pick<Message, "id" | "role" | "kind" | "content" | "data" | "createdAt">;
export type ClientVersion = Pick<Version, "id" | "number" | "summary" | "files" | "createdAt"> & { plan: Plan | null };

const toClientMessage = (m: Message): ClientMessage => ({
  id: m.id,
  role: m.role,
  kind: m.kind,
  content: m.content,
  data: m.data,
  createdAt: m.createdAt,
});
const toClientVersion = (v: Version): ClientVersion => ({
  id: v.id,
  number: v.number,
  summary: v.summary,
  files: v.files,
  createdAt: v.createdAt,
  plan: (v.plan as Plan | null) ?? null,
});

async function owned(projectId: string) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) throw new Error("Project not found");
  return { db, ws, project };
}

async function addMessage(db: DB, projectId: string, m: Omit<ClientMessage, "id" | "createdAt">, offsetMs = 0) {
  const [row] = await db
    .insert(messages)
    .values({ id: rowId(), projectId, ...m, createdAt: new Date(Date.now() + offsetMs) })
    .returning();
  return toClientMessage(row);
}

async function nextVersionNumber(db: DB, projectId: string) {
  const [last] = await db
    .select({ number: versions.number })
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.number))
    .limit(1);
  return (last?.number ?? 0) + 1;
}

async function currentFiles(db: DB, project: Project) {
  if (!project.currentVersionId) return {};
  const [v] = await db.select().from(versions).where(eq(versions.id, project.currentVersionId)).limit(1);
  return v?.files ?? {};
}

/** Simulated token accounting at Claude Opus 5 list prices ($5 / $25 per million tokens). */
async function recordUsage(db: DB, workspaceId: string, projectId: string, steps: [string, number, number][]) {
  if (!steps.length) return;
  await db.insert(usage).values(
    steps.map(([step, input, output]) => ({
      id: rowId(),
      workspaceId,
      projectId,
      step,
      model: "claude-opus-5",
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: Math.round(input * 0.6),
      costUsd: ((input * 5 + output * 25) / 1_000_000).toFixed(5),
    })),
  );
}

function planOf(project: Project): Plan {
  if (project.plan) return project.plan as Plan;
  const bp = matchBlueprint(project.prompt, project.settings.templateId, project.name);
  return { ...buildPlan({ blueprint: bp, appName: project.name, settings: project.settings }), appName: project.name };
}

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
  await recordUsage(db, ws.id, projectId, [["plan", 4200, 2600]]);
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
  const message = await addMessage(db, projectId, {
    role: "assistant",
    kind: "build",
    content: `Built ${plan.appName}.`,
    data: buildSummary(plan, files, number, Math.round(seconds)),
  });
  await db
    .update(projects)
    .set({ stage: "ready", status: "draft", currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const tok = Object.values(files).join("").length / 4;
  await recordUsage(db, ws.id, projectId, [
    ["agents", 3000, 1800 * plan.agents.length],
    ["ui", 9000, Math.round(tok)],
    ["build", 6000, 1200],
    ["test", 5000, 900],
  ]);
  revalidatePath("/", "layout");
  return { version: toClientVersion(version), message };
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

async function saveEditVersion(
  db: DB,
  project: Project,
  plan: Plan,
  summary: string,
  changes: string[],
  author: "architect" | "you",
) {
  const before = await currentFiles(db, project);
  const files = generateFiles(plan, project.stack);
  const number = await nextVersionNumber(db, project.id);
  const [prev] = project.currentVersionId
    ? await db.select({ number: versions.number }).from(versions).where(eq(versions.id, project.currentVersionId)).limit(1)
    : [];
  const [version] = await db.insert(versions).values({ id: rowId(), projectId: project.id, number, summary, files, plan }).returning();
  const edit: EditSummary & { author: string; previousVersionId: string | null } = {
    version: number,
    previousVersion: prev?.number ?? number - 1,
    previousVersionId: project.currentVersionId,
    title: summary,
    changes,
    files: fileChanges(before, files),
    author,
  };
  await db
    .update(projects)
    .set({ plan, currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(projects.id, project.id));
  return { version: toClientVersion(version), edit };
}

export async function sendMessage(projectId: string, rawText: string, mode: "plan" | "build") {
  const text = z.string().trim().min(1).max(4000).parse(rawText);
  const { db, ws, project } = await owned(projectId);
  const user = await addMessage(db, projectId, { role: "user", kind: "chat", content: text, data: { mode, stage: project.stage } });

  if (project.stage === "build") {
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: "I'm still building. I'll pick this up as soon as the build finishes.", data: null }, 5);
    return { messages: [user, reply] };
  }

  const plan = planOf(project);

  if (project.stage === "plan") {
    const res = applyPlanInstruction(plan, text);
    await db.update(projects).set({ plan: res.plan, updatedAt: new Date() }).where(eq(projects.id, projectId));
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: res.reply, data: { changes: res.changes } }, 5);
    await recordUsage(db, ws.id, projectId, [["plan", 2400, 600]]);
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
    await recordUsage(db, ws.id, projectId, [["plan", 3100, 700]]);
    return { messages: [user, reply] };
  }

  const res = applyEdit(plan, text);
  if (!res.ok) {
    const reply = await addMessage(db, projectId, { role: "assistant", kind: "chat", content: res.reply, data: { examples: res.examples } }, 5);
    return { messages: [user, reply] };
  }
  const { version, edit } = await saveEditVersion(db, project, res.plan, res.title, res.changes, "architect");
  const reply = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: res.title, data: { ...edit, focusPage: res.focusPage } }, 5);
  await recordUsage(db, ws.id, projectId, [["build", 7000, 2200]]);
  revalidatePath("/", "layout");
  return { messages: [user, reply], plan: res.plan, version };
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
  const { version, edit } = await saveEditVersion(db, project, plan, "Applied plan changes", changes, "you");
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: "Applied plan changes", data: edit });
  await recordUsage(db, ws.id, projectId, [["build", 6000, 1800]]);
  revalidatePath("/", "layout");
  return { version, message, plan };
}

export async function saveFile(projectId: string, path: string, content: string) {
  z.string().min(1).max(300).parse(path);
  z.string().max(200_000).parse(content);
  const { db, project } = await owned(projectId);
  const plan = planOf(project);
  const next: Plan = { ...plan, fileOverrides: { ...(plan.fileOverrides ?? {}), [path]: content } };
  const { version, edit } = await saveEditVersion(db, project, next, `Edited ${path.split("/").pop()}`, [`You edited ${path}`], "you");
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: edit.title, data: edit });
  revalidatePath("/", "layout");
  return { version, message, plan: next };
}

export async function restoreVersion(projectId: string, versionId: string) {
  const { db } = await owned(projectId);
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
  await db
    .update(projects)
    .set({ plan: target.plan, currentVersionId: version.id, stage: "ready", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, {
    role: "system",
    kind: "event",
    content: `Restored v${target.number} as v${number}. Every version is still here if you change your mind.`,
    data: null,
  });
  revalidatePath("/", "layout");
  return { version: toClientVersion(version), message, plan: target.plan as Plan };
}
