"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { messages, projects, type ProjectSettings } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId, shortId, slugify } from "@/lib/ids";
import { nameFromPrompt } from "@/lib/format";
import { getTemplate } from "@/lib/templates";
import { buildPlan, matchBlueprint } from "@/lib/sim/plan";

const createSchema = z.object({
  prompt: z.string().trim().min(3, "Describe what you want to build.").max(8000),
  templateId: z.string().optional(),
  settings: z
    .object({
      themePreset: z.string().optional(),
      model: z.string().optional(),
      stack: z.string().optional(),
      planFirst: z.boolean().optional(),
      attachments: z
        .array(z.object({ name: z.string(), size: z.number(), kind: z.enum(["document", "data", "image"]) }))
        .optional(),
    })
    .optional(),
});

export async function createProject(input: z.infer<typeof createSchema>) {
  const data = createSchema.parse(input);
  const ws = await requireWorkspace();
  const db = await getDb();

  const template = data.templateId ? getTemplate(data.templateId) : undefined;
  const name = template?.name ?? nameFromPrompt(data.prompt);
  const id = shortId();
  const settings: ProjectSettings = {
    planFirst: true,
    stack: "react-vite",
    model: "claude-opus-5",
    ...data.settings,
    ...(template ? { templateId: template.id } : {}),
  };

  await db.insert(projects).values({
    id,
    workspaceId: ws.id,
    name,
    slug: `${slugify(name)}-${id.slice(0, 4)}`,
    prompt: data.prompt,
    source: template ? "template" : "prompt",
    stack: settings.stack ?? "react-vite",
    stage: settings.planFirst === false ? "build" : "plan",
    settings,
    lastOpenedAt: new Date(),
  });
  await db.insert(messages).values({
    id: rowId(),
    projectId: id,
    role: "user",
    kind: "chat",
    content: data.prompt,
    data: settings.attachments?.length ? { attachments: settings.attachments } : null,
  });

  // Simulated planning: match the prompt to a blueprint, then either ask its questions or plan straight away.
  const blueprint = matchBlueprint(data.prompt, template?.id, name);
  if (settings.planFirst === false) {
    const plan = { ...buildPlan({ blueprint, appName: name, settings }), appName: name };
    await db.update(projects).set({ plan }).where(eq(projects.id, id));
  } else {
    await db.insert(messages).values({
      id: rowId(),
      projectId: id,
      role: "assistant",
      kind: "questions",
      content: template
        ? `Good pick. A few quick questions so ${template.name} fits the way you work.`
        : "Before I plan it, a few quick questions.",
      data: { questions: blueprint.questions, blueprintId: blueprint.id },
      createdAt: new Date(Date.now() + 5),
    });
  }

  revalidatePath("/", "layout");
  return { id };
}

async function ownedProject(id: string) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, ws.id)))
    .limit(1);
  if (!project) throw new Error("Project not found");
  return { db, ws, project };
}

export async function renameProject(id: string, name: string) {
  const clean = z.string().trim().min(1).max(80).parse(name);
  const { db, project } = await ownedProject(id);
  await db.update(projects).set({ name: clean, updatedAt: new Date() }).where(eq(projects.id, project.id));
  revalidatePath("/", "layout");
}

export async function duplicateProject(id: string) {
  const { db, ws, project } = await ownedProject(id);
  const newId = shortId();
  const name = `${project.name} (copy)`;
  await db.insert(projects).values({
    ...project,
    id: newId,
    workspaceId: ws.id,
    name,
    slug: `${slugify(name)}-${newId.slice(0, 4)}`,
    status: "draft",
    stage: project.plan ? "plan" : project.stage,
    repo: null,
    currentVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastOpenedAt: null,
  });
  revalidatePath("/", "layout");
  return { id: newId };
}

export async function deleteProject(id: string) {
  const { db, project } = await ownedProject(id);
  await db.delete(projects).where(eq(projects.id, project.id));
  revalidatePath("/", "layout");
}
