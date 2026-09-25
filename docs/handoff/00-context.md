# Architect 2.0: shared context for every remaining milestone

Read this whole file before starting any milestone. It covers what the product is, the rules you must not break, what already exists, how the code is organised, how to verify your work, and what "done" means. Each milestone file (`04-…` to `07-…`) assumes you've read it.

- **Product spec:** `docs/spec.md` (snapshot of the living spec doc; the doc itself is at https://claude.ai/code/artifact/b381f50f-abd1-4d20-bf96-997b0ac214a3).
- **Repo:** `git@github.com:sukulbagai/architect-2.git`, branch `main`, private for now.
- **Local path:** `/Users/sukulbagai/Desktop/tmp_Architect2.0`

---

## 1. What this is

A hiring assignment for Lyzr (Technical Product Manager role). The task is to design and build "Architect 2.0", the next version of Lyzr's vibe-coding platform architect.new. It must serve **non-technical builders and developers** in one product: prompt → plan → build → preview → iterate → GitHub → deploy, plus agents in any framework and importing existing projects.

Reviewers judge, in order:

1. **Design, UI/UX and flows** (most important): every screen needs one obvious next step, with care over small details. The design comes from first principles; it isn't a copy of any existing product.
2. **Feature coverage:** every flow a platform like this needs, even as dummy flows.
3. **Working functionality** (plus points): a real database and anything else that actually works.

The central design idea: **one project, two depths.** *Simple* mode shows the app and plain-language progress. *Pro* mode adds files, diffs, logs, terminal and Git. The theme (light/dark/system) is a separate toggle from the mode.

---

## 2. Hard rules (non-negotiable)

1. **No API keys and nothing that costs money.** Every flow that would call a paid or external service is **simulated inside the app**: AI planning and building, GitHub, deploys, integrations, OAuth, billing and email. Don't add env vars for services, don't ask the user for keys, and don't call the Claude/OpenAI/GitHub/Vercel APIs. npm libraries that run locally are fine. **Ask the user before adding any external service, even a free one** (a hosted bundler, a CDN-loaded script, a third-party widget).
2. **No Supabase.** The database is Neon Postgres in production (`DATABASE_URL`, free plan, added from Vercel's Storage tab) and embedded PGlite locally (`.data/pglite`). One Drizzle schema covers both.
3. **Sign-in stays simulated.** A workspace id lives in the httpOnly cookie `architect_ws`. **Never look a workspace up by email:** an unverified email must not unlock anyone's data.
4. **Simulations must feel real but stay honest.** Streamed steps, realistic timing and success *and* failure states. When the demo can't do something, say so plainly (see how `applyEdit` falls back with examples). Never build a form that collects real credentials or payment details.
5. **Commit and push only when the user asks.** Work on `main` (the user asked for this). End every commit message with:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
6. **Keep `pnpm typecheck`, `pnpm lint` and `pnpm build` clean**, with no warnings introduced.
7. **Next.js 16 is newer than your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before using an API you aren't sure of (see `AGENTS.md`).
8. **Theme and mode are independent.** Never tie dark mode to Pro.

---

## 3. Current state (milestones 1 to 4 are done)

Commits on `main`: `784b02c` (M1), `4f94b6b` (M2), `0ed2d7b` (M3). M4 is built on top (see below).

**Milestone 1, foundation:**
- **Design and shell:** design tokens (light "drafting paper" / dark "night desk"), fonts (Geist, Geist Mono, Instrument Serif), logo, and an app shell with a collapsible rail (its state lives in a cookie), recent projects, theme switcher and user menu with the Simple/Pro switch.
- **Landing:** a working prompt box (the draft carries through sign-in via `localStorage["architect:draft"]`), animated workspace mock, "same change, two depths" toggle, how-it-works and feature grid.
- **Sign-in and onboarding:** simulated sign-in (Google/GitHub account picker, email magic-link screen) and three-step onboarding (role, "Do you write code?" which sets the mode, theme and a GitHub placeholder).
- **Home:** composer with + menu (attach files, theme preset, and stack/model in Pro), Plan-first switch, three other ways to start, recent projects and templates ranked by role.
- **Projects:** search (`/` shortcut), status filters, sort, grid/list, rename/duplicate/delete.
- **Other pages:** Explore (template gallery by category), Agents (empty state), Integrations (catalog; Connect is a placeholder toast), Usage (static tiles), Settings (profile, mode, theme, sign out, delete workspace).

**Milestone 2, plan and build (all simulated):**
- **Simulation engine** in `src/lib/sim/`: blueprints, plan, codegen, build script, edit engine, Consultant.
- **Workspace `/p/[id]`:** clarifying-question chips → living plan (editable; plan-stage chat edits it) → Build this → live build timeline (steps, streaming files, preview after the first screen, Stop/Resume) → "Built and ready" card with next-step suggestions → Build-mode edits create versions with Undo; Plan-mode replies with ideas and doesn't change the app.
- **Stage tabs:** Preview (device sizes, page switcher, reload, open in a new tab, previewing old versions), Plan, Agents (read-only cards), Data (sample rows, schema in Pro), Code (Pro; CodeMirror; hand edits saved as new versions; Simple reaches it via ⋯ → View code), Versions (timeline, preview/restore, per-file diffs in Pro), Settings (rename, delete).
- **Generated app preview** `/p/[id]/preview`: rendered from the plan in a sandboxed same-origin iframe; five themes; page kinds dashboard, list (search, filters, drawer), workbench, chat, run (multi-agent pipeline) and settings.
- **The Consultant dialog** on Home.

**Milestone 3, iterate (all simulated):**
- **Diff review (Pro):** a Review-changes toggle (composer + Settings tab, stored in `settings.reviewChanges`). With it on, a Build-mode change becomes a `proposal` message and a **Review** stage tab (file checkboxes, `DiffView`, conventional-commit message, Accept selected / Discard, `j`/`k`/`x`/`⌘↵`). Partial accepts pin rejected files to their base content via `plan.fileOverrides` (`null` keeps a new file out). Stale proposals fail politely.
- **Issues and Fix it:** about one in three edits that add a page or field plant a real bug (the "break it" message always does). Codegen writes the unguarded `data.items.map(...)` line; the preview shows the page's crash state; the Workspace shows a banner (plain sentence in Simple, stack and `file:line` link in Pro); Fix it saves a version whose diff adds the guard and a loading state.
- **Testing agent:** `settings.testAfterChanges` (default on in Simple, off in Pro). When on, a bug that would have been planted is caught and fixed inside the same change ("Caught and fixed: …"). `/test` runs it once.
- **Visual edit:** a Select toggle (`V`) in the Preview toolbar; hover outlines and click-to-select inside the app; a floating panel (Text, Emphasis, Size, prompt) with a live draft in the app; Apply saves a version. Text lands on real plan fields; styles become CSS in `theme.css`.
- **Pro drawer (`⌘J`):** Terminal (scripted shell over the current files, history, Tab completion), Logs (runtime lines from the app plus the last build), Problems (open issues with Fix it).
- **Command palette (`⌘K`)** on every signed-in page and in the Workspace, plus a `?` shortcuts dialog. Rail and Workspace top bar have search buttons.
- **Composer:** `/` commands, `@file` mentions (Pro; points the change at that page), model chip (Pro; Sonnet costs 0.4×).
- **Build cards (Pro):** finished steps expand to their files; the done card has "Show steps".

**Milestone 4, agents (simulated runs, real config and code):**
- **Agent editor (Workspace → Agents tab, `stage-agents.tsx` + `components/agents/agent-editor.tsx`):** list | detail with a **List | Flow** toggle. Sections: name/role, What it does (Simple) / Instructions with a token estimate (Pro), Model (credits a run), Framework (Pro picker with a live read-only code preview and "Open in Code tab"; Simple shows "Runs on Lyzr · Change"), Tools (built-ins, workspace connections, MCP servers and HTTP tools, each Connected or "Connect" in place), Knowledge, Memory, Guardrails, Hands off to. Unsaved edits live per agent in `useWorkspace().agentDrafts` (they survive tab switches; the Agents tab shows a dot). The sticky save bar calls `saveAgent`: before the first build it updates the plan; after it, it regenerates the agent's files as a version ("Updated Triage agent") with an edit card. Save is blocked while the Plan tab has unapplied changes.
- **Per-framework code (`sim/agent-code.ts`):** `agentFiles(agent, ctx)` for Lyzr (YAML), LangGraph, CrewAI, Google ADK (Python), OpenAI Agents SDK, Claude Agent SDK, Mastra (TypeScript) and GitAgent (a folder of files). SDKs go only into the generated `package.json` / `agents/requirements.txt` / `backend/requirements.txt`. `lib/agents.ts` in the generated app is now a registry (`AGENTS = { id: { name, framework, entry } }`) and `lib/agent-runtime.ts` / `backend/agents.py` have one adapter per framework used. Builds stream every agent file.
- **Flow (`components/agents/agent-flow.tsx`, `@xyflow/react`):** columns: pages that use agents → agents by handoff depth (tool pills under each) → outputs (integrations and "Saved to <collection>"). Handoffs are animated dashed brand edges. Also used, compact, in the Plan tab's section 4. Click an agent to select it.
- **Test console (`components/agents/test-console.tsx`):** a side sheet in the Workspace, a tab on standalone agents. Trace steps stream in, then the reply types out. Replies come from `simulateRun()` (`sim/agents.ts`): the sample that best matches the input, a trace from the agent's real config, and a handoff when the input mentions a refund, legal, a chargeback… Pro can switch the trace to JSON. **Save as test case** stores `{input, expect}` straight away (no version); **Run all tests** passes while the instructions still mention the expected phrase (`evaluateTest`).
- **Standalone agents:** `/agents` (library: standalone cards + agents grouped by app, deep-linking to `/p/<id>?tab=agents&agent=<id>`), `/agents/new` (describe → simulated draft → framework and model → create), `/agents/[id]` (Configure, Test, Deploy, Usage). Deploy: Publish switch, `POST /api/v1/agents/<id>/run` with a key shown once (`ak_live_…`, stored as sha256 + prefix, revocable), curl/JS/Python snippets, widget colour/greeting/position with a live preview and an iframe snippet. Usage: 14 days of simulated history plus today's real calls.
- **Runtime routes:** `POST /api/agents/[projectId]/[agentId]/run` (cookie + ownership; accepts the unsaved draft; logs an `agent-test` usage row), `POST /api/v1/agents/[agentId]/run` (public; Bearer key; 401/404/400 JSON errors; CORS), `/embed/agent/[id]` (public widget page; replies through the `runWidget` server action in `actions/embed.ts`, published agents only). None of these are in the proxy matcher except `/agents/*`.
- **Connections (`connections` table, `actions/connections.ts`):** Integrations page has a Connected section (Disconnect with confirm) and simulated OAuth consent per integration (scopes in `lib/integrations.ts`; Allow → "Connecting…" → Connected; Deny → "Connection cancelled"). MCP servers and HTTP tools are added by https URL; MCP tools are scripted by host (`mcpTools`). Only a masked hint of an auth header is kept.
- **Knowledge:** drop zone / Add files (pdf, docx, txt, md, csv, xlsx), names and sizes only, a deterministic 1.5 s "Indexing…" bar, then "Ready · N chunks" (one per 2 KB). Home attachments land on the first agent.
- **Home composer:** + → Add existing agents lists standalone agents; picks show as chips and are snapshotted into `settings.attachedAgents`, which `buildPlan` appends to the plan (with a note).
- **⌘K:** "Open an agent…" in the Workspace.

**Still placeholders.** Each is a `toast()` or a note that its milestone must replace:

| Where | What it says | Replaced in |
| --- | --- | --- |
| `src/components/workspace/workspace.tsx` GitHub button | "GitHub sync arrives in the GitHub milestone" | M5 |
| `src/components/workspace/workspace.tsx` Share button | "Sharing arrives in a later milestone" | M7 |
| `src/components/workspace/workspace.tsx` Deploy button | "Deploying arrives in the Ship milestone" | M6 |
| `src/components/workspace/chat-composer.tsx` `/deploy` | same toast | M6 |
| `src/lib/sim/terminal.ts` `architect deploy` | "Deploying from the terminal arrives with the Ship milestone" | M6 |
| `src/lib/sim/terminal.ts` `git status` / `git branch` | always "main", "working tree clean" | M5 |
| `src/components/home/start-options.tsx` Import a repo | "Importing arrives with the GitHub milestone" | M5 |
| `src/components/auth/onboarding.tsx` Connect GitHub | "GitHub connects in the GitHub milestone" | M5 |
| `src/components/settings/integration-grid.tsx` GitHub card Connect | "GitHub connects in the GitHub milestone" | M5 |
| `src/components/agents/tools-section.tsx` GitHub tool "Connect" | same toast (the tool stays on; agents like the code reviewer use it) | M5 |
| `src/components/workspace/stage-panels.tsx` DataPanel footer | "…query console … later milestone" | M7 |
| `src/components/workspace/stage-panels.tsx` SettingsPanel note | "Environment variables, the custom domain and GitHub settings arrive…" | M5/M6 |
| `src/app/(app)/usage/page.tsx` | static zero tiles | M6 |
| `src/lib/format.ts` comment | "Until Claude names projects (milestone 2)…" | Leave it; naming stays heuristic |

When your milestone lands a feature, **remove its placeholder**. Never leave a toast promising a feature that now exists.

---

## 4. Running it

```bash
pnpm install
pnpm dev                 # http://localhost:3000 (the QA scripts below use --port 3100)
pnpm typecheck && pnpm lint && pnpm build
```

- **Local database.** Without `DATABASE_URL` the app uses PGlite in `.data/pglite` (gitignored) and migrates it on first connection. To reset local data, stop the dev server and delete `.data/pglite`. Ask the user before deleting anything outside the scratch area.
- **Schema changes.** Edit `src/db/schema.ts`, then run `pnpm db:generate --name <what>` to create `drizzle/000N_<what>.sql`. **Restart the dev server afterwards.** The PGlite client is cached on `globalThis` and only migrates when it first connects.
- **Production.** `pnpm build` runs `scripts/migrate.ts`, which migrates Neon when `DATABASE_URL` is set, then `next build`. In production without `DATABASE_URL` the app throws a clear error, unless `ALLOW_EMBEDDED_DB` is set.
- **New routes.** After adding one, run `npx next typegen` so the global `PageProps<"/route">` / `LayoutProps<…>` types know about it.

---

## 5. Codebase map

```
src/
  proxy.ts                      Next 16 "proxy" (was middleware): redirects app routes to /login without the cookie
  app/
    layout.tsx                  Root: fonts, ThemeProvider (next-themes), TooltipProvider, Toaster
    globals.css                 ALL design tokens (+ code colours, avatar hues, utilities)
    page.tsx                    Landing
    (auth)/login, (auth)/welcome
    (app)/layout.tsx            Signed-in shell (AppShell rail); requireWorkspace()
    (app)/home|projects|agents|explore|integrations|usage|settings/page.tsx
    p/[id]/page.tsx             Workspace (server): loads project, messages, versions, connections → <Workspace/>;
                                reads ?tab= and ?agent= for deep links
    (app)/agents, agents/new, agents/[id]   Agents library, New agent wizard, standalone agent page
    api/agents/[projectId]/[agentId]/run    Test-console runs (cookie)
    api/v1/agents/[agentId]/run             Public agent API (Bearer key)
    embed/agent/[id]            Public chat widget (not in the proxy matcher)
    p/[id]/preview/page.tsx     Generated app (server): ?embed=1 &v=<versionId> | &draft=1 &page=<pageId>
    p/[id]/not-found.tsx
  db/schema.ts, db/index.ts     Drizzle schema; getDb() picks Neon (DATABASE_URL) or PGlite
  lib/
    session.ts                  WORKSPACE_COOKIE, getWorkspace() (cached per request), requireWorkspace()
    actions/auth.ts             signIn, completeOnboarding, signOut
    actions/workspace.ts        setMode, updateProfile, deleteWorkspace
    actions/projects.ts         createProject (also creates questions msg or plan), rename/duplicate/delete
    actions/build.ts            answerQuestions, sendMessage, startBuild, completeBuild, stopBuild,
                                savePlan, applyPlan, saveFile, restoreVersion,
                                acceptProposal, discardProposal, setProjectSettings, fixIssue,
                                applyVisualEdit, runTests (+ ClientMessage/ClientVersion/EditData types)
    actions/projects.ts         createProject, rename/duplicate/delete, listProjects (for ⌘K)
    actions/build.ts            (also) saveAgent, saveAgentTests for plan agents
    actions/agents.ts           standalone agents: create, save, tests, publish, API keys, widget, test runs
    actions/connections.ts      connectIntegration, addMcpServer, addHttpTool, disconnect
    actions/embed.ts            runWidget (public, published agents only)
    agent-store.ts              server-only: agentInput (zod), rowToPlanAgent, toConnectionView, key hashing, usageSeries
    integrations.ts             catalog with consent scopes, mcpTools(url), ConnectionView
    sim/                        THE SIMULATION ENGINE (see §7)
    constants.ts                ROLES, STACKS, MODELS, THEME_PRESETS, FRAMEWORKS, RAIL_COOKIE
    templates.ts                10 Explore/Home templates (+ layoutForTemplate)
    integrations.ts             Integrations catalog data
    format.ts, ids.ts, seeded.ts, utils.ts (cn)
  components/
    ui/                         shadcn (radix-nova style). Import from "@/components/ui/…"
    shell/app-shell.tsx         AppShell, Rail (with the ⌘K search button), UserMenu, useModeSwitch()
    command/                    CommandProvider (⌘K, ?), useRegisterCommands(group, items), CommandPalette,
                                ShortcutsDialog. Mounted in (app)/layout.tsx and p/[id]/page.tsx
    agents/                     agent-editor (+ tools-section, knowledge-section, agent-code), test-console,
                                agent-flow (xyflow), save-bar, new-agent-wizard, standalone-agent, widget-chat,
                                embed-chat, agent-bits (AgentAvatar, FrameworkChip)
    integrations/               connect-dialog (simulated OAuth consent), custom-tool-dialog (MCP server / HTTP tool)
    common/                     PageHeader/PageContainer, EmptyState, ProjectThumb (generated wireframe),
                                StatusBadge/StatusDot, ThemeSwitcher
    brand/                      Logo/LogoMark, WorkspaceAvatar
    landing/, auth/, home/, projects/, explore/, settings/
    workspace/
      workspace.tsx             Top bar, mobile Chat/App switch, resizable chat, stage tabs + toolbar,
                                select mode, drawer state, ⌘\ ⌘J V shortcuts, registers ⌘K commands
      use-workspace.ts          ALL workspace client state + actions + build playback
      chat-messages.tsx         Renders messages by kind (questions, plan, build, edit, proposal, test,
                                plan-reply, chat, event); ProposalCard, TestCard, HelpCard, BuildSteps
      chat-composer.tsx         Plan/Build switch, / commands (SLASH_COMMANDS), @ mentions, Review and
                                Test toggles, model chip, send/stop
      review-panel.tsx          The Review tab for a pending proposal
      visual-edit-panel.tsx     Floating panel for a selected element
      bottom-drawer.tsx         Pro drawer: terminal-view, logs-view, problems-view
      stage-preview.tsx         iframe preview, device frames, build skeleton, "previewing old version" bar,
                                issue banner, select-mode bar, visual edit panel, app → Workspace messages
      plan-panel.tsx            Editable living plan
      stage-code.tsx            File tree + CodeMirror editor (dynamic import) + save-as-version
      stage-panels.tsx          VersionsPanel, DataPanel, SettingsPanel
      stage-agents.tsx          AgentsPanel: list | detail, Flow view, save bar, test console sheet
      code-editor.tsx, diff-view.tsx
    preview/
      preview-app.tsx           Generated-app shell, theme vars, postMessage protocol, scoped CSS (.arch-app),
                                select mode (outlines), crash state, key forwarding, runtime logs
      editable.tsx              EditProvider + useEditable(): data-edit ids, label/style overrides, drafts
      pages.tsx                 Page kinds: Dashboard, ListPage, Workbench, ChatPage, RunPage, SettingsPage
      bits.tsx                  Pill, Avatar, FieldValue, formatValue, useTyping, AgentAnswer, PageIcon
scripts/migrate.ts              Neon migrations at build time
drizzle/                        SQL migrations (0000_init, 0001_version_plan, 0002_agents_connections)
```

---

## 6. Data model (`src/db/schema.ts`)

| Table | Key columns | Notes |
| --- | --- | --- |
| `workspaces` | id (= cookie value, 32 chars), name, email, signInMethod, role, mode `simple\|pro`, avatarHue, **githubLogin** (unused, for M5), onboardedAt | |
| `projects` | id (10-char, used in URLs), workspaceId, name, slug (unique), prompt, status `draft\|building\|live\|error`, stage `plan\|build\|ready`, source `prompt\|template\|import`, stack, settings (ProjectSettings JSON), plan (Plan JSON), **repo** (`{owner,name,branch}\|null`, unused, for M5), currentVersionId, lastOpenedAt | |
| `messages` | projectId, role `user\|assistant\|system`, kind (MessageKind), content, data JSON | see message kinds below |
| `versions` | projectId, number, summary, files (`Record<path,string>`), plan (snapshot) | a new row for every build, edit, hand edit or restore |
| `agents` | workspaceId, projectId (always null so far), name, role, framework (id), model, instructions, tools, knowledge, **published**, **apiKeyHash**, **apiKeyPrefix**, **apiKeyCreatedAt**, **widget** `{color, greeting, position}`, **config** (`AgentConfig`: memory, guardrails, tests, samples, trace, prompt), **runs** (real API/widget calls) | Standalone agents. Plan agents live in `projects.plan` |
| `connections` | workspaceId, integrationId, kind `oauth\|mcp\|http`, label, config `{scopes, url, tools, headerHint, account}` | Simulated connections. Unique (workspace, integration) for `oauth` only (partial index). M5 adds GitHub here |
| `deployments` | projectId, versionId, slug, environment, status, logs | **unused so far**; M6 |
| `env_vars` | projectId, key, valueEncrypted | **unused so far**; M6 (M5 import may write) |
| `usage` | workspaceId, projectId, step, model, input/output/cacheRead tokens, costUsd | written by build actions with simulated numbers; M6 reads it |

`ProjectSettings` = `{ themePreset?, model?, stack?, planFirst?, attachments?[{name,size,kind}], templateId?, reviewChanges?, testAfterChanges?, attachedAgents?: PlanAgent[] }`.

`PlanAgent` (in the plan JSON) = `{ id, name, role, framework (id from sim/frameworks.ts; older plans stored the label, and frameworkOf() accepts both), model, tools, instructions, samples, trace?, memory?, guardrails?, handoffs?, knowledge?[{name,size,chunks}], tests?[{id,input,expect}] }`. Tools are display names: built-ins ("Web search"), integration names ("Slack"), `mcp:<label>` and `http:<label>`. `withAgentDefaults()` fills the optional fields. Change it with `setProjectSettings(projectId, patch)`.

**Message kinds and their `data`:**
- `chat` (user): `{ mode: "plan"|"build", stage }`, optional `attachments`, optional `mentions` (Pro `@file`s)
- `chat` (assistant): `{ changes?: string[] }` or `{ examples?: string[] }`
- `questions`: `{ questions: PlanQuestion[], blueprintId, answered?: Record<qid,string[]> | "skipped" }`
- `plan`: `{ pages, agents, tables, estimate, integrations }`
- `build`: `BuildSummary`
- `edit`: `EditData` = `EditSummary & { author: "architect"|"you", previousVersionId, focusPage?, commit?, issue?, test?, review?, fixed? }`
- `proposal`: `ProposalData` (status, baseVersionId, title, changes, proposed plan, commit, files with before/after) plus optional `issue`/`test`
- `test`: `{ checks, pages, results }` (a `/test` run that found nothing)
- `chat` (assistant, client-only): `{ help: true }` for the `/help` card (id `local-…`, never saved)
- `plan-reply`: `{ ideas: string[] }`
- `event` (system): `{ resumable? }`

---

## 7. The simulation engine (`src/lib/sim/`)

Everything is **deterministic and pure** (the same input gives the same output). Server actions call it and persist the results; the client animates them.

- `types.ts`: `Plan` (the single source of truth for an app: pages, agents, data (collections with sample rows), integrations, notes, ui {theme, banner, search, compact, labels, styles}, model, issues, guards, fileOverrides, suggestions, testIssue, estimate), `Issue`, `BuildScript`/`BuildEvent`, `BuildSummary`, `EditSummary`, `ProposalData`, `TestReport`.
- `catalog.ts`: 10 `Blueprint`s (support-desk, resume-screener, lead-research, content-engine, meeting-actions, code-review, knowledge-chat, market-brief, expense-auditor, study-buddy), each with keywords, questions, pages, agents (with scripted `samples` + `trace`), data rows, integrations, suggestions and a testIssue.
- `plan.ts`:
  - `matchBlueprint(prompt, templateId?, name?)`: keyword scoring (strong keywords count 2, weak 1, threshold 2), otherwise `genericBlueprint(prompt, name)`, which derives the entity, fields and rows from the prompt.
  - `buildPlan()`: applies question answers (notes, integrations, extra pages), attachments (Knowledge base), model, theme.
  - `applyPlanInstruction()`: plan-stage chat ("add a X page", "add a X agent", "remove …", integrations, "call it …", otherwise a note).
  - `planIdeas()`, `newPage()`, `newAgent()`, `estimate()`.
- `codegen.ts`: `generateFiles(plan, stack)` for `react-vite`, `nextjs` and `fastapi-react`, plus `agents/<id>.yaml`, README and .env.example. `plan.fileOverrides` (hand edits) are applied last. **Any plan change → regenerate → diff** is how versions stay honest.
- `script.ts`: `buildScript(plan, files)` produces a ~20 s timeline of step/sub/file/preview/done events. Also `buildSummary()` and `fileChanges(before, after)` (added/removed lines per file via jsdiff).
- `edit.ts`: `applyEdit(plan, text, { pageId? })` handles build-mode requests (and reports a `trigger` when it added a page or field, for `maybeIssue`): theme and colour words, banner, search on/off, compact/roomy, "add a X field [to Y]", pages/agents/integrations/renames via the planner, and the plan's suggested next steps (these become a page or an agent). Anything else returns `{ ok:false, reply, examples }`.
- `themes.ts`: `APP_THEMES`, the five generated-app themes (paper, midnight, studio, meadow, bold). The preview and codegen both use them.
- `consultant.ts`: TIME_SINKS, TOOLS, `defaultSinks(role)`, `ideasFor()` (always returns three ideas).
- `issues.ts`: `maybeIssue(plan, trigger, seed)` (one in three page/field edits), `plantIssue`, `breakIt`, `guardPage`, `fixIssue`, `testChecks(plan)`. An open issue makes codegen write `BUGGY_LINE`; `plan.guards` keeps the fixed version.
- `visual.ts`: the `data-edit` vocabulary shared by preview, codegen and server (`editKind`, `sizePx`, `EDIT_KIND_LABEL`). `visual-edit.ts`: `applyVisualChange(plan, target, change)` (kept separate so the preview bundle stays small).
- `commit.ts`: `commitMessage(title, changes, opts?)` → `type(scope): summary`.
- `frameworks.ts`: `FRAMEWORK_LIST` (id, label, language, description, packages), `frameworkOf()`, `frameworkLabel()`.
- `agents.ts`: `GUARDRAILS`, `MEMORY_OPTIONS`, `BUILTIN_TOOLS`, tool helpers (`toolId`, `toolLabel`, `toolIntegration`, `isMcpTool`…), `simulateRun(agent, input, turn, {agents, mcp})` → `{output, trace, usage, handoff}`, `defaultExpect` / `evaluateTest` (the one test rule), `describeAgentChanges` (edit-card sentences, also used for dirty checks), `draftAgent(prompt)` for the wizard, `chunksFor(size)`.
- `agent-code.ts`: `agentFiles(agent, {appName, agents})`, `agentEntry(agent)`, `agentPackages(plan)`. Kept separate from `codegen.ts` (which re-exports it) so the editor's code preview doesn't pull in the whole generator.
- `terminal.ts`: `runCommand(input, ctx)` and `complete(input, ctx)`, a pure shell over the current version's files. `codegen.pagePath(plan, page, stack)` says where a page's file lives.

**Extending the simulator:** add pure functions here; add a server action in `src/lib/actions/*` to persist; add client playback in the workspace. Keep outputs deterministic (use `seededRandom(seed)` from `lib/seeded.ts`, never `Math.random()` in anything that must be reproducible or rendered on the server).

---

## 8. How the Workspace works

- `app/p/[id]/page.tsx` (server) loads everything and computes `arrival()` (`freshMessageId` for the questions' "thinking" beat; `autoBuild` for plan-first-off projects) **on the server**, so the first render matches the browser.
- `use-workspace.ts` holds `project, plan, messages, versions, currentVersionId, build (LiveBuild), thinking, hiddenId, planReveal, planDirty, tab, previewPage, previewVersionId, logs, codeFile, codeLine`, and derives `settings, issues, pendingProposal, previousVersion, testAfterChanges, reviewing`. Its actions are `runBuild, stop, answer, updatePlan, applyPlanChanges, send, restore, undo, saveCode, acceptProposal, discardProposal, fixIssue, visualEdit, runTests, updateSettings, openCode, addLog, addLocalMessage`. It takes the UI mode (`useWorkspace(init, mode, onShowStage)`) because review and testing depend on it. M4 added `agentId/setAgentId/openAgent`, `agentDrafts/setAgentDraft`, `saveAgent`, `saveAgentTests`, `connections/addConnection`, and `init.initialTab/initialAgentId/connections`. `setTab` from the UI also switches phones to the App view; internal tab changes use `setTabState`.
  - **Server actions that land a version** return `{ version, message, plan, focusPage }`; the client's `land()` applies them. `think(labels, minMs, work)` plays the rotating "thinking" labels.
  - **Build playback:** `startBuild` returns a script (nothing saved yet, stage → build). The client ticks every 50 ms, then `completeBuild` saves the version and message. Stop calls `stopBuild` (stage back to plan, or ready if a version exists). Reloading mid-build shows an "interrupted" card with Resume.
  - **Chat:** an optimistic user message, rotating "thinking" labels, a minimum delay so it feels deliberate, then the server messages replace the optimistic one.
- **Preview iframe protocol** (same origin, `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`). The Workspace pings on mount because the iframe can load before the parent starts listening.

| Direction | Message | Meaning |
| --- | --- | --- |
| app → workspace | `architect:ready {pages}` | App mounted (also sent in reply to a ping) |
| app → workspace | `architect:route {page}` | The user navigated inside the app |
| workspace → app | `architect:navigate {page}` | Route bar or focusPage asks for a page |
| workspace → app | `architect:ping` | "Are you there?" |
| workspace → app | `architect:select-mode {on}` | Turn select mode on or off (also clears any selection) |
| workspace → app | `architect:deselect` | Clear the selected element (panel closed) |
| workspace → app | `architect:draft-edit {draft}` | Show an unsaved text/tone/size change on the selected element (`null` clears) |
| app → workspace | `architect:selected {target: {editId, kind, pageId, text}}` | An element was clicked in select mode |
| app → workspace | `architect:select-cancel` | Esc pressed inside the app while selecting |
| app → workspace | `architect:error {issueId, pageId}` | A page with an open issue rendered its crash state |
| app → workspace | `architect:log {level, message}` | A runtime log line (page loads, agent runs, warnings) |
| app → workspace | `architect:key {key, meta}` | ⌘K / ⌘J / ⌘\ / V / ? pressed while focus is in the app; the Workspace re-dispatches it |

  Add new message types in this style: `architect:<verb>`, and always check `e.origin === window.location.origin`.

---

## 9. Design system and UI conventions

- **Tokens** (`globals.css`, `@theme inline`): background, foreground, card, popover, primary (ink), muted, accent (hover surface), border, border-strong, sunken, subtle-foreground, **brand** (#cf4318 vermilion; `bg-brand text-brand-foreground`), brand-text (a readable brand colour for text), brand-soft, success/warning/info/destructive (+ `-soft`), sidebar-*, code-* syntax colours. **Dark values are defined under `.dark`.** Never hard-code hex values in Architect UI; the generated-app preview is the exception (its own themes).
- **Fonts:** `font-sans` (Geist), `font-mono` (Geist Mono), `font-display` (Instrument Serif; use sparingly for single emphasised words in big headings, italic).
- **Utilities:** `.annotation` (mono uppercase micro-labels), `.bg-grid`, `.bg-grid-major`, `.bg-dots`, `.mask-fade-b`, `.mask-fade-radial`, `animate-rise`, `.scrollbar-thin`, `shadow-card|float|composer`.
- **One brand-coloured button per screen**: the primary next step (Build this, Deploy, Go to Home, Start building). Everything else uses default (ink), outline or ghost.
- **Component building blocks:** `PageContainer` + `PageHeader`, `EmptyState` (drafting-grid empty states with icon, title, description and action), `ProjectThumb`, `StatusBadge`, shadcn `Dialog`/`Sheet`/`DropdownMenu`/`Tooltip`, sonner `toast`.
- **⌘K:** add commands for a screen with `useRegisterCommands("workspace" | "suggestions" | "preferences", items)` while it's mounted. Items can open a nested list (`children`). The palette ranks results itself (cmdk's `defaultFilter`, `shouldFilter={false}`), because cmdk's own group reordering didn't work with our dynamic list.
- **Segmented controls** use `bg-muted/60` for the track and `bg-card shadow-card dark:bg-accent` for the active item (the `dark:bg-accent` is required, otherwise the active item is invisible in dark mode).
- **Copy:**
  - Plain, specific and friendly, in sentence case. Use contractions.
  - Simple mode has no jargon ("Building the screens" rather than "Writing files").
  - Name actions by what they do ("Build this", "Draft the plan", "Save as new version").
  - Errors say what happened and how to fix it.
- **Accessibility:** proper roles (`radiogroup`/`radio`, `tablist`/`tab`, `switch`), `aria-label` on icon buttons, visible focus rings, `prefers-reduced-motion` respected globally, labelled inputs.
- **Mobile:** every page must work at 390 px. The Workspace uses a Chat/App switch under 768 px.
- **Generated-app CSS** lives in `preview-app.tsx` (`CSS` string scoped to `.arch-app`). **Beware specificity:** `.arch-app .x { display:… }` beats Tailwind responsive utilities like `md:hidden`. Put display rules in Tailwind classes, not in the scoped CSS.

---

## 10. Next.js 16, React 19 and lint gotchas (all hit before)

- **Middleware is `src/proxy.ts`** (export `proxy`). Public routes must stay out of its `matcher` (M6's `/live/*` and M4's `/embed/*` must be public).
- **`cookies()`, `params` and `searchParams` are async.** Cookies can be set only in server actions and route handlers.
- **`"use server"` files may export only async functions** (type exports are fine). **Constants that server code needs must not live in a `"use client"` file:** importing them from a server component yields a client reference, not the value. Example: `RAIL_COOKIE` lives in `lib/constants.ts`.
- **React compiler lint rules are errors:**
  - `react-hooks/set-state-in-effect`: don't `setState` synchronously inside `useEffect`. Use lazy `useState(() => …)`, `useSyncExternalStore` (see `hooks/use-mounted.ts`), set state in a callback or timer, or (for a one-time browser read) an `eslint-disable-next-line` with a reason, as in `composer.tsx`.
  - `react-hooks/refs`: no `ref.current` reads during render.
  - `react-hooks/purity`: no `Date.now()`/`Math.random()` in a component body. Move them into a helper function (see `arrival()` in `p/[id]/page.tsx`).
  - Don't define components inside components. Use plain `draw…()` functions or hoist them (see `project-thumb.tsx`).
- **Hydration:** anything time- or random-dependent must be decided on the server and passed as a prop, or rendered only after mount (`useMounted`). A mismatch here once broke the Workspace and caused a "script tag" warning from next-themes.
- **Grid and flex children with long unbreakable content need `min-w-0`**, or they overflow.
- **`PageProps<"/p/[id]">` / `LayoutProps<"/">`** are global generated types. Run `npx next typegen` after adding routes.
- `@electric-sql/pglite` is in `serverExternalPackages`, and `devIndicators: false` is set in `next.config.ts`.
- **lucide-react 1.x has no brand icons.** Use `GithubGlyph` / `GoogleGlyph` from `components/auth/brand-icons.tsx`, or add an SVG.
- CodeMirror must be loaded with `next/dynamic` and `ssr:false` (see `stage-code.tsx`). `code-editor.tsx` takes `line={{ line, n }}` to scroll to and highlight a line.
- **xyflow reserves node type names.** A custom node type called `output` (or `input`/`default`) inherits xyflow's built-in node styles (a second border, fixed width). The flow uses `result`. Load it with `next/dynamic` + `ssr:false`; theme it through the `--xy-*` variables in `globals.css` (`.architect-flow`).
- **shadcn `SheetContent` sizes by `data-[side=…]` variants.** Override width with the same variant (`data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]`); a plain `w-full` loses.
- **`Date.now()` inside event handlers in a component body** still trips `react-hooks/purity`. Use a module-level helper (see `stopwatch()` in `test-console.tsx`).
- **Don't name plain helpers `use…`.** The hooks lint treats `useCollectionHook()` in codegen as a hook call.
- **React Compiler vs manual memo:** `react-hooks/preserve-manual-memoization` fails when a `useMemo`/`useCallback` dep is a sub-property it can't track (`ws.plan?.ui.theme`, `plan?.pages.length`). Hoist the value into a `const` first, or drop the manual memo and let the compiler do it.

---

## 11. Where the code differs from the spec

| Spec says | Reality | Why |
| --- | --- | --- |
| M2 row: "Sandpack preview" | A scripted renderer (`components/preview`) in a same-origin iframe | Sandpack depends on CodeSandbox's hosted bundler, which is an external service. Rule 2.1 applies. |
| Agent test console "tab inside the detail" or sheet | A right-side sheet in the Workspace; a tab on standalone agents. Standalone test runs go through a server action; project runs through the `/api/agents/…/run` route | The route needs a project id; standalone agents don't have one |
| Integrations: Connect + MCP servers | Also HTTP tools (`http:<label>`), since the catalog has an "HTTP tool" card | Every catalog card had to do something once the placeholder toasts went |
| Agents: runs count "simulated" | Standalone usage is simulated history for the days since creation plus today's real API/widget calls; a brand-new agent shows 0 until it's called | Keeps the numbers honest |
| Live app at `[name].architect.app` | Will be `/live/[slug]` on the same deployment (M6); the UI may *display* `slug.architect.app` as a vanity name | No custom domains or wildcard DNS on the free plan |
| "Skip planning is a quiet link in the composer" | A "Plan first" switch on the Home composer | A decision made at the moment of starting |
| Visual edit: "style controls (text, color, spacing)" | Text, Emphasis (default/accent/muted) and Size (S/M/L) | Emphasis and size map cleanly onto every theme; spacing is covered by "compact/roomier" in chat |
| Stage tabs table has no Review tab | A **Review** tab appears only while a Pro proposal is pending | Review needs room for a file list and a diff |
| Spec's Workspace sync chip "main · synced" | Not built yet | M5 |

If you change something the spec describes, update `docs/spec.md` too. If you have the Claude Docs connector, also update the doc, but only when the user asks.

---

## 12. QA recipe (do this for every milestone)

Use Playwright **outside the repo** (don't add it to package.json unless the user asks):

```bash
mkdir -p /tmp/architect-qa && cd /tmp/architect-qa && npm init -y >/dev/null && npm i playwright && npx playwright install chromium
# in another terminal, from the repo:
pnpm dev --port 3100 > /tmp/architect-qa/dev.log 2>&1
```

A starting script (save as `/tmp/architect-qa/flow.mjs`, run with `node flow.mjs`):

```js
import { chromium } from "playwright";
const BASE = "http://localhost:3100";
const errors = [];
const check = (label, ok) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const browser = await chromium.launch();

async function newSignedInPage({ scheme = "light", viewport = { width: 1440, height: 900 }, mode = "simple" } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
  await p.goto(BASE + "/login");
  await p.getByRole("button", { name: "Continue with GitHub" }).click();
  await p.getByRole("button", { name: /Alex Rivera/ }).click();
  await p.waitForURL(/\/welcome/);
  if (mode === "pro") {
    await p.getByRole("radio", { name: /Engineering/ }).click();
    await p.getByRole("button", { name: "Continue" }).click();
    await p.getByRole("radio", { name: /Yes, I do/ }).click();
    await p.getByRole("button", { name: "Continue" }).click();
    await p.getByRole("button", { name: "Go to Home" }).click();
  } else {
    await p.getByRole("button", { name: "Skip for now" }).click();
  }
  await p.waitForURL(/\/home/);
  return { ctx, p };
}

async function builtProject(p, prompt = "A habit tracker with streaks") {
  await p.fill("#composer-input", prompt);
  await p.getByRole("switch", { name: "Plan first" }).click();        // skip questions, auto-build
  await p.getByRole("button", { name: "Start project" }).click();
  await p.waitForURL(/\/p\//);
  await p.waitForSelector("text=Built and ready to try", { timeout: 45000 });
  return p.url();
}

const { p } = await newSignedInPage();
const url = await builtProject(p);
const app = p.frameLocator('iframe[title="App preview"]');           // the generated app
await p.screenshot({ path: "shot.png" });
check("preview renders", (await app.locator("main").count()) === 1);
await browser.close();
console.log("errors:", errors.length ? errors.join("\n") : "none");
```

Useful selectors: `#composer-input` (Home), `#chat-input` (Workspace), `role=tab` names (Preview, Plan, Agents, Data, Code, Versions, Settings), `role=radio` `pro`/`simple` (Workspace top bar), `role=radio` Plan/Build (composer), "Draft the plan", "Skip questions", "Build this", "Stop", "Undo".

**QA gotchas (hit in M3):**
- The Next.js route announcer is also `role="alert"`; use `[role="alert"]:not(#__next-route-announcer__)`.
- Playwright's `Shift+/` sends key `/` with Shift, not `?`. Shortcuts accept both.
- `break it` in a Build-mode message always plants an issue (hidden trigger for demos and QA). Otherwise one in three page/field edits do, deterministically from the message and version number.

**Every milestone's QA must:**
1. Run the new flows end to end in **light, dark and at 390×844**, with screenshots. **Look at them.** Design is the top judging criterion.
2. Report **zero** page errors and console errors (ignore only the Chrome warning about `allow-scripts` + `allow-same-origin`).
3. `grep -i -E "error|hydration|⨯" dev.log` shows nothing new.
4. Regression: the M1–M3 flows still work (landing → sign-in → onboarding → Home → project → questions → plan → build → edit → undo → versions → code → Consultant; then Review → accept, break it → Fix it, visual edit, ⌘J terminal, ⌘K).

---

## 13. Definition of done (per milestone)

- [ ] Every item in the milestone file's scope is built, or explicitly deferred with the user's agreement.
- [ ] The placeholders it replaces are gone (§3 table).
- [ ] `pnpm typecheck && pnpm lint && pnpm build` are clean.
- [ ] The QA script passes. Screenshots (light, dark, mobile) have been reviewed and issues fixed.
- [ ] New migrations are committed alongside the schema change, and the dev server restarted and verified.
- [ ] The README status table is updated, and `docs/spec.md` too if behaviour differs from it.
- [ ] Summarise for the user what changed, what's simulated, how it was verified, and anything left. Commit and push **only if asked**.
