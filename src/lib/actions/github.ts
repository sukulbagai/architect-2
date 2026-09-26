"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { connections, envVars, messages, projects, versions, workspaces, type ProjectSettings } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { rowId, shortId, slugify } from "@/lib/ids";
import { toConnectionView } from "@/lib/agent-store";
import { encryptSecret } from "@/lib/secrets";
import { addMessage, currentFiles, owned, planOf, recordUsage, saveEditVersion, toClientVersion } from "@/lib/project-store";
import { generateFiles } from "@/lib/sim/codegen";
import { estimate } from "@/lib/sim/plan";
import { appNameFor, importIntro, organisation, planFromRepo, type ImportSummary } from "@/lib/sim/import";
import { repoFiles } from "@/lib/sim/repo-files";
import {
  ENV_KEY,
  GITHUB_SCOPES,
  TEAMMATE,
  canFastForward,
  closePullRequest as closePr,
  createBranch as branchFrom,
  forkPoint,
  mergePlans,
  githubLoginFor,
  linkRepo,
  mergePullRequest as mergePr,
  openPullRequest as openPr,
  prBlocked,
  pullRemote,
  pushBranch,
  pushCheck,
  repoByName,
  repoFullName,
  repoStatus,
  reposFor,
  resolveImport,
  setAutoCommit as autoCommitTo,
  switchBlocked,
  switchBranch as switchTo,
  teammateChange,
  teammatePush,
  validBranchName,
  validRepoName,
  type ProjectRepo,
} from "@/lib/sim/github";
import type { Plan } from "@/lib/sim/types";

/* GitHub is simulated end to end: there's no OAuth app, no token and no API call. Connecting
   stores a login and a connection row; repos, pushes, branches and pull requests live in the
   project's `repo` JSON, and commits are the project's versions. */

// ---------------------------------------------------------------------------------------------
// Connect

export async function connectGithub() {
  // Onboarding offers this before the workspace is onboarded.
  const ws = await requireWorkspace({ onboarded: false });
  const db = await getDb();
  const login = ws.githubLogin ?? githubLoginFor(ws.name);
  await db.update(workspaces).set({ githubLogin: login, updatedAt: new Date() }).where(eq(workspaces.id, ws.id));
  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, ws.id), eq(connections.integrationId, "github"), eq(connections.kind, "oauth")))
    .limit(1);
  const row =
    existing ??
    (
      await db
        .insert(connections)
        .values({ id: rowId(), workspaceId: ws.id, integrationId: "github", kind: "oauth", label: "GitHub", config: { scopes: GITHUB_SCOPES, account: `@${login}` } })
        .returning()
    )[0];
  revalidatePath("/", "layout");
  return { login, connection: toConnectionView(row, `@${login}`), repos: reposFor(login).length };
}

/** Projects keep their link; they show "GitHub disconnected" until you connect again. */
export async function disconnectGithub() {
  const ws = await requireWorkspace();
  const db = await getDb();
  await db.update(workspaces).set({ githubLogin: null, updatedAt: new Date() }).where(eq(workspaces.id, ws.id));
  await db.delete(connections).where(and(eq(connections.workspaceId, ws.id), eq(connections.integrationId, "github")));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Linking a project to a repository

async function linked(projectId: string) {
  const ctx = await owned(projectId);
  if (!ctx.ws.githubLogin) return { ...ctx, error: "Connect GitHub first." as const, repo: null };
  if (!ctx.project.repo) return { ...ctx, error: "Link a repository first." as const, repo: null };
  return { ...ctx, error: null, repo: ctx.project.repo };
}

async function commitsOf(projectId: string) {
  const db = await getDb();
  const rows = await db.select({ id: versions.id }).from(versions).where(eq(versions.projectId, projectId)).orderBy(asc(versions.number));
  return rows.map((r) => r.id);
}

const linkInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create"), name: z.string().trim().max(100), private: z.boolean(), description: z.string().trim().max(300).optional(), uiMode: z.enum(["simple", "pro"]) }),
  z.object({ mode: z.literal("existing"), name: z.string().trim().max(100), uiMode: z.enum(["simple", "pro"]) }),
]);

/** "support-desk" is taken → "support-desk-2", or the next free number. */
function freeName(name: string, taken: Set<string>) {
  for (let n = 2; n < 100; n++) if (!taken.has(`${name}-${n}`.toLowerCase())) return `${name}-${n}`;
  return `${name}-${Date.now().toString(36)}`;
}

export async function linkRepository(projectId: string, raw: z.infer<typeof linkInput>) {
  const input = linkInput.parse(raw);
  const { db, ws, project } = await owned(projectId);
  const login = ws.githubLogin;
  if (!login) return { ok: false as const, error: "Connect GitHub first." };
  if (project.repo) return { ok: false as const, error: `This project is already linked to ${repoFullName(project.repo)}.` };
  const commits = await commitsOf(projectId);
  const files = Object.keys(await currentFiles(db, project)).length;
  const now = new Date().toISOString();
  let repo: ProjectRepo;
  let content: string;

  if (input.mode === "create") {
    const bad = validRepoName(input.name);
    if (bad) return { ok: false as const, error: bad };
    // Names already on the (simulated) account: its own repos and every repo Architect created there.
    const others = await db.select({ repo: projects.repo }).from(projects).where(eq(projects.workspaceId, ws.id));
    const taken = new Set([...reposFor(login).map((r) => r.name.toLowerCase()), ...others.filter((o) => o.repo?.owner === login).map((o) => o.repo!.name.toLowerCase())]);
    if (taken.has(input.name.toLowerCase())) {
      return { ok: false as const, error: `${login}/${input.name} already exists on GitHub.`, suggestion: freeName(input.name, taken) };
    }
    repo = linkRepo({ owner: login, name: input.name, private: input.private, description: input.description || undefined, origin: "created", branch: "main", autoCommit: input.uiMode === "simple", commits, now });
    content = files
      ? `Created ${login}/${input.name} (${input.private ? "private" : "public"}) and pushed ${files} files to main.`
      : `Created ${login}/${input.name} (${input.private ? "private" : "public"}). The first build is pushed as the first commit.`;
  } else {
    const existing = repoByName(login, input.name);
    if (!existing) return { ok: false as const, error: "That repository isn't in your account." };
    // Your work goes on its own branch, so the repo's main stays exactly as it was.
    const branch = `architect/${slugify(project.name) || "app"}`;
    repo = linkRepo({
      owner: login,
      name: existing.name,
      private: existing.private,
      description: existing.description,
      origin: "linked",
      branch,
      defaultBranch: existing.defaultBranch,
      autoCommit: input.uiMode === "simple",
      commits,
      nextPr: existing.nextPr,
      now,
    });
    content = `Linked ${existing.fullName}. Your work is on a new branch, ${branch}, so ${existing.defaultBranch} is untouched. Open a pull request when you're ready to merge.`;
  }

  await db.update(projects).set({ repo, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, { role: "system", kind: "event", content, data: null });
  return { ok: true as const, repo, message, files };
}

export async function unlinkRepository(projectId: string) {
  const { db, project } = await owned(projectId);
  if (!project.repo) return { ok: true as const, message: null };
  await db.update(projects).set({ repo: null, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, {
    role: "system",
    kind: "event",
    content: `Unlinked ${repoFullName(project.repo)}. Nothing on GitHub was deleted, and every version is still here.`,
    data: null,
  });
  return { ok: true as const, message };
}

// ---------------------------------------------------------------------------------------------
// Push, pull, auto-commit

export async function pushRepository(projectId: string) {
  const { db, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const now = Date.now();
  const check = pushCheck(repo, now);
  if (!check.ok) return { ok: false as const, error: check.error, behind: repoStatus(repo, now).behind > 0 };
  const next = pushBranch(repo, now);
  await db.update(projects).set({ repo: next }).where(eq(projects.id, projectId));
  return { ok: true as const, repo: next, count: check.count, publishing: check.publishing };
}

export async function setAutoCommit(projectId: string, on: boolean) {
  z.boolean().parse(on);
  const { db, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const next = autoCommitTo(repo, on, Date.now());
  await db.update(projects).set({ repo: next }).where(eq(projects.id, projectId));
  return { ok: true as const, repo: next, pushed: repoStatus(repo, Date.now()).ahead - repoStatus(next, Date.now()).ahead };
}

/** Demo only: makes the teammate's change land on the default branch right now. */
export async function simulateTeammatePush(projectId: string) {
  const { db, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const next = teammatePush(repo, Date.now());
  await db.update(projects).set({ repo: next }).where(eq(projects.id, projectId));
  return { ok: true as const, repo: next };
}

/** Pulls the teammate's README change as a new version: a fast-forward, or a merge if you had commits waiting. */
export async function pullRepository(projectId: string) {
  const { db, ws, project, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const now = Date.now();
  if (!repoStatus(repo, now).behind || !repo.teammate) return { ok: false as const, error: "Nothing to pull. You're up to date." };
  if (project.stage === "build") return { ok: false as const, error: "Wait for the build to finish, then pull." };
  const files = await currentFiles(db, project);
  const plan = planOf(project);
  const change = teammateChange(repo.teammate.n);
  const readme = (files["README.md"] ?? `# ${plan.appName}\n`).trimEnd();
  const next: Plan = { ...plan, fileOverrides: { ...(plan.fileOverrides ?? {}), "README.md": `${readme}\n\n${change.section}` } };
  const title = `Merged 1 commit from origin/${repo.branch}: ${change.subject}`;
  const { version, edit, repo: after } = await saveEditVersion(
    db,
    project,
    next,
    title,
    [`${TEAMMATE.name} (@${TEAMMATE.login}) pushed “${change.subject}”, which changes README.md`],
    "you",
    { commit: `Merge branch '${repo.branch}' of ${repo.url}` },
    (id) => pullRemote(repo, id, now),
  );
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: title, data: edit });
  await recordUsage(db, ws.id, projectId, [["git", 400, 60]], project.settings.model);
  return { ok: true as const, version, message, plan: next, repo: after! };
}

// ---------------------------------------------------------------------------------------------
// Branches and pull requests

export async function createBranch(projectId: string, rawName: string) {
  const name = z.string().trim().max(80).parse(rawName);
  const { db, project, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  if (!project.currentVersionId) return { ok: false as const, error: "Build the app first. A branch starts from a version." };
  const bad = validBranchName(name, Object.keys(repo.branches));
  if (bad) return { ok: false as const, error: bad };
  const next = branchFrom(repo, name, Date.now());
  await db.update(projects).set({ repo: next, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const [head] = await db.select({ number: versions.number }).from(versions).where(eq(versions.id, project.currentVersionId)).limit(1);
  const message = await addMessage(db, projectId, { role: "system", kind: "event", content: `Created ${name} from v${head?.number ?? "?"} and switched to it.`, data: null });
  return { ok: true as const, repo: next, message };
}

export async function switchBranch(projectId: string, rawName: string) {
  const name = z.string().trim().max(80).parse(rawName);
  const { db, project, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  if (project.stage === "build") return { ok: false as const, error: "Wait for the build to finish, then switch branches." };
  const blocked = switchBlocked(repo, name);
  if (blocked) return { ok: false as const, error: blocked };
  const next = switchTo(repo, name);
  const headId = next.branches[name].commits[next.branches[name].commits.length - 1];
  const [head] = await db.select().from(versions).where(and(eq(versions.id, headId), eq(versions.projectId, projectId))).limit(1);
  if (!head) return { ok: false as const, error: "That branch's latest version is missing." };
  await db
    .update(projects)
    .set({ repo: next, currentVersionId: head.id, plan: head.plan ?? project.plan, stage: "ready", updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, { role: "system", kind: "event", content: `Switched to ${name}. You're on v${head.number}.`, data: null });
  return { ok: true as const, repo: next, currentVersionId: head.id, plan: (head.plan as Plan | null) ?? null, message };
}

const prInput = z.object({ title: z.string().trim().min(1, "Give the pull request a title.").max(200), body: z.string().max(5000) });

export async function openPullRequest(projectId: string, raw: z.infer<typeof prInput>) {
  const parsed = prInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the title." };
  const { db, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const blocked = prBlocked(repo);
  if (blocked) return { ok: false as const, error: blocked };
  const { repo: next, pr } = openPr(repo, parsed.data, Date.now());
  await db.update(projects).set({ repo: next, updatedAt: new Date() }).where(eq(projects.id, projectId));
  const message = await addMessage(db, projectId, {
    role: "system",
    kind: "event",
    content: `Opened pull request #${pr.number}: ${pr.title} (${pr.from} → ${pr.to}).`,
    data: null,
  });
  return { ok: true as const, repo: next, pr, message };
}

/**
 * Merges on the (simulated) remote, then puts you on the base branch. When the base had moved on,
 * the merge commit is a three-way merge of the two plans, so both sides' changes survive.
 */
export async function mergePullRequest(projectId: string, number: number) {
  z.number().int().min(1).parse(number);
  const { db, project, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const pr = repo.prs.find((p) => p.number === number);
  if (!pr || pr.status !== "open") return { ok: false as const, error: "That pull request isn't open." };
  if (project.stage === "build") return { ok: false as const, error: "Wait for the build to finish, then merge." };
  const now = Date.now();
  const headIds = repo.branches[pr.from]?.commits ?? [];
  const baseIds = repo.branches[pr.to]?.commits ?? [];
  const content = `Merged #${pr.number} into ${pr.to}. You're on ${pr.to} now.`;

  if (canFastForward(repo, pr)) {
    const next = switchTo(mergePr(repo, number, now), pr.to);
    const headId = headIds[headIds.length - 1];
    const [head] = await db.select().from(versions).where(and(eq(versions.id, headId), eq(versions.projectId, projectId))).limit(1);
    await db
      .update(projects)
      .set({ repo: next, currentVersionId: head.id, plan: head.plan ?? project.plan, stage: "ready", updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    const message = await addMessage(db, projectId, { role: "system", kind: "event", content, data: null });
    return { ok: true as const, repo: next, currentVersionId: head.id, plan: (head.plan as Plan | null) ?? null, message, version: null };
  }

  // A three-way merge against the fork point, so both branches' changes survive.
  const forkId = forkPoint(repo, pr.from, pr.to);
  const [head] = await db.select().from(versions).where(eq(versions.id, headIds[headIds.length - 1])).limit(1);
  const [base] = await db.select().from(versions).where(eq(versions.id, baseIds[baseIds.length - 1])).limit(1);
  const [fork] = forkId ? await db.select().from(versions).where(eq(versions.id, forkId)).limit(1) : [];
  const headPlan = head.plan as Plan;
  const basePlan = base.plan as Plan;
  const merged: Plan = mergePlans((fork?.plan as Plan | null) ?? basePlan, basePlan, headPlan);
  merged.estimate = estimate(merged);
  const title = `Merge pull request #${pr.number} from ${pr.from}`;
  const { version, edit, repo: after } = await saveEditVersion(
    db,
    { ...project, currentVersionId: base.id },
    merged,
    title,
    [`Merged ${pr.commits} ${pr.commits === 1 ? "commit" : "commits"} from ${pr.from} into ${pr.to}`, pr.title],
    "you",
    { commit: title },
    (id) => switchTo(mergePr(repo, number, now, id), pr.to),
  );
  const message = await addMessage(db, projectId, { role: "assistant", kind: "edit", content: title, data: edit });
  return { ok: true as const, repo: after!, currentVersionId: version.id, plan: merged, message, version };
}

export async function closePullRequest(projectId: string, number: number) {
  z.number().int().min(1).parse(number);
  const { db, error, repo } = await linked(projectId);
  if (error) return { ok: false as const, error };
  const next = closePr(repo, number, Date.now());
  await db.update(projects).set({ repo: next }).where(eq(projects.id, projectId));
  return { ok: true as const, repo: next };
}

// ---------------------------------------------------------------------------------------------
// Import

const importInput = z.object({
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("github"), repo: z.string().trim().min(1).max(100) }),
    z.object({ kind: z.literal("url"), url: z.string().trim().min(1).max(400) }),
    z.object({ kind: z.literal("zip"), name: z.string().trim().min(1).max(200), size: z.number().int().min(0).max(2_000_000_000) }),
  ]),
  branch: z.string().trim().max(80).nullable(),
  env: z.record(z.string().regex(ENV_KEY), z.string().max(5000)).optional(),
  uiMode: z.enum(["simple", "pro"]),
});

/** Keeps the repo's own .env.example and adds the keys Architect's generated agents need below it. */
function mergeEnvExample(theirs: string | undefined, generated: string | undefined) {
  if (!theirs) return generated;
  const have = new Set(theirs.split("\n").map((l) => l.split("=")[0].trim()));
  const extra = (generated ?? "")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l) && !have.has(l.split("=")[0]));
  return extra.length ? `${theirs.trimEnd()}\n\n# Added by Architect for the generated agents\n${extra.join("\n")}\n` : theirs;
}

export async function importRepository(raw: z.infer<typeof importInput>) {
  const input = importInput.parse(raw);
  const ws = await requireWorkspace();
  const db = await getDb();
  const resolved = resolveImport(input.source, ws.githubLogin);
  if ("error" in resolved) return { ok: false as const, error: resolved.error };
  const profile = resolved.profile;
  if (!profile.importable) return { ok: false as const, error: profile.reason ?? "This repository can't be imported." };
  const branch = resolved.branches.length ? (input.branch && resolved.branches.includes(input.branch) ? input.branch : resolved.defaultBranch) : null;

  const name = appNameFor(resolved.name);
  const id = shortId();
  const stack = profile.stack;
  const base = planFromRepo(profile, resolved.name, resolved.fullName);
  const theirs = repoFiles(resolved);
  const generated = generateFiles(base, stack);
  const overrides: Record<string, string> = { ...theirs };
  const env = mergeEnvExample(theirs[".env.example"], generated[".env.example"]);
  if (env) overrides[".env.example"] = env;
  const plan: Plan = { ...base, fileOverrides: overrides };
  const files = generateFiles(plan, stack);

  const values = Object.fromEntries(Object.entries(input.env ?? {}).filter(([k, v]) => profile.envVars.includes(k) && v.trim()));
  const summary: ImportSummary = {
    repo: resolved.fullName,
    branch,
    source: input.source.kind,
    framework: profile.framework,
    language: profile.language,
    files: profile.files,
    routes: profile.routes.length,
    models: profile.models,
    agents: plan.agents.map((a) => a.name),
    previewable: profile.previewable,
    reason: profile.reason,
    envVars: profile.envVars.map((key) => ({ key, set: !!values[key] })),
    organisation: organisation(profile, files),
    suggestions: plan.suggestions,
  };
  const settings: ProjectSettings = {
    planFirst: true,
    stack,
    model: "claude-opus-5",
    import: { source: input.source.kind, from: resolved.fullName, branch, framework: profile.framework, previewable: profile.previewable, reason: profile.reason, envVars: profile.envVars },
  };

  await db.insert(projects).values({
    id,
    workspaceId: ws.id,
    name,
    slug: `${slugify(name)}-${id.slice(0, 4)}`,
    description: resolved.description || null,
    prompt: `Imported from ${resolved.fullName}`,
    source: "import",
    stack,
    stage: "ready",
    status: "draft",
    settings,
    plan,
    lastOpenedAt: new Date(),
  });
  const [version] = await db
    .insert(versions)
    .values({ id: rowId(), projectId: id, number: 1, summary: `Imported from ${resolved.fullName}${branch ? ` @ ${branch}` : ""}`, files, plan })
    .returning();

  // Imported from your own GitHub: linked and in sync from the start. URLs and ZIPs can be linked later.
  const login = ws.githubLogin;
  const repo =
    login && resolved.repo && resolved.owner === login && branch
      ? linkRepo({
          owner: login,
          name: resolved.repo.name,
          private: resolved.repo.private,
          description: resolved.repo.description,
          origin: "imported",
          branch,
          autoCommit: input.uiMode === "simple",
          commits: [version.id],
          nextPr: resolved.repo.nextPr,
          now: new Date().toISOString(),
        })
      : null;
  await db.update(projects).set({ currentVersionId: version.id, repo }).where(eq(projects.id, id));

  const secrets = Object.entries(values);
  if (secrets.length) {
    await db.insert(envVars).values(secrets.map(([key, value]) => ({ id: rowId(), projectId: id, key, valueEncrypted: encryptSecret(value) })));
  }

  await db.insert(messages).values({
    id: rowId(),
    projectId: id,
    role: "assistant",
    kind: "import",
    content: importIntro(resolved, summary),
    data: summary,
  });
  await recordUsage(db, ws.id, id, [["import", 14000, 2200]], "claude-opus-5");
  revalidatePath("/", "layout");
  return { ok: true as const, id, version: toClientVersion(version) };
}
