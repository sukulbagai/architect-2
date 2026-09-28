# Architect 2.0

A vibe-coding platform for agentic apps, designed for two audiences at once: builders who never want to see code,
and developers who want files, diffs, Git and a terminal. Same project underneath, two depths on top.

The product spec (research, flows, feature matrix, architecture and build plan) is in [`docs/spec.md`](docs/spec.md). Build notes are in [`docs/handoff/`](docs/handoff/README.md).

## A two-minute tour

Nothing below needs an account, a key or a card. Sign-in is simulated, so "Continue with GitHub" just works.

1. **Sign in.** Landing page → **Start building** → *Continue with GitHub* → pick the suggested account. On the
   onboarding screen, choose **Engineering** and *Yes, I do* to land in **Pro**; pick **Skip for now** to see the
   Simple depth instead. You can switch at any time from the toggle in the Workspace top bar.
2. **Build an app from a sentence.** On Home, type *"A support desk copilot that triages tickets"* and press
   **Start project**. Answer the clarifying questions (or turn **Plan first** off to skip straight to the build).
   Watch the timeline: agents, pages and data appear, and the preview turns on part-way through.
3. **Change it in plain English.** In the composer, ask for *"add a Reports page"*. In Pro, the change arrives as a
   diff you accept or reject per file. Type *"break it"* to plant a real bug, then press **Fix it**.
4. **Look underneath (Pro).** The **Code** tab has the real generated files; **Versions** shows every turn with a
   one-click restore; ⌘J opens the terminal, logs and problems; ⌘K is the command palette.
5. **Agents.** The **Agents** tab opens any agent's editor: framework (Lyzr, LangGraph, CrewAI, OpenAI, Claude,
   ADK, Mastra, GitAgent), tools, knowledge and guardrails, with the matching source generated live and a test
   console that shows the trace.
6. **GitHub.** The top-bar chip connects a simulated account, links a repo, and does commits, pushes, branches and
   pull requests over the real version history.
7. **Deploy — the payoff.** Press **Deploy**. Pre-flight runs (the build, a real secret scan over the generated
   files, agents, security), pick an address, and deploy. You get a **public URL at `/live/<slug>` that works
   signed out, in any browser** — that part is genuinely real, not simulated. **Share** copies that link, and
   older deployments can be rolled back from the same panel.

## Run it locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. No accounts or keys are needed for local development: without `DATABASE_URL`, the app
uses an embedded Postgres ([PGlite](https://pglite.dev)) stored in `.data/`, and migrates it on first use.

## Simulated by design

Every flow that would normally call a paid or external service is simulated: sign-in, AI planning and code
generation, GitHub, deploys and integrations. They behave like the real thing (streaming progress, realistic
output, success and error states), but there are no API keys and nothing can cost money. The only real backend is
the database, which runs on free tiers.

## Deploy to Vercel

1. Import the repo into Vercel.
2. In the project's **Storage** tab, add a **Neon** database. Vercel creates the Neon account and injects
   `DATABASE_URL` (free plan, no card).
3. Deploy. `pnpm build` applies migrations to Neon before `next build`.

### How the simulation works

`src/lib/sim/` is a small, deterministic engine that stands in for the model:

- **Blueprints** (`catalog.ts`): ten app types with pages, agents, sample data, clarifying questions and scripted agent outputs. Prompts that match no blueprint get a generic one shaped from the prompt itself (`plan.ts`).
- **Plans** (`plan.ts`): answers to the clarifying questions shape the plan; chat messages in the planning stage edit it.
- **Code** (`codegen.ts`): the plan becomes a React + Vite, Next.js or FastAPI + React project. Output is deterministic, so version diffs show exactly what a change touched.
- **Builds** (`script.ts`): a timed script the Workspace plays back: steps tick, files stream into the Code tab, and the preview switches on after the first screen.
- **Edits** (`edit.ts`): recognised requests (theme, pages, agents, fields, search, banner, name, suggested next steps) change the plan and produce a new version. In Pro, `@src/pages/Queue.tsx add a priority field` points a change at one page.
- **Issues** (`issues.ts`): about one in three edits that add a page or a field leave a real bug in the generated code (typing "break it" always does). The preview shows the page's crash state, Fix it saves a version whose diff adds the guard, and the testing agent can catch it inside the change instead.
- **Review** (Pro): with diff review on, a change waits as a proposal with per-file diffs and a conventional-commit message (`commit.ts`) until you accept some or all of it.
- **Visual edits** (`visual.ts`, `visual-edit.ts`): click an element in the preview, change its text, emphasis or size; text lands on real plan fields and styles become CSS in `theme.css`.
- **Agents** (`agents.ts`, `frameworks.ts`, `agent-code.ts`): each agent's framework, tools, knowledge, memory, guardrails and handoffs are saved and generated as real source for Lyzr, LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK, Google ADK, Mastra or GitAgent (the SDKs only appear in the generated project). A run replies from the agent's scripted samples (the one that best matches the question) with a trace built from its config: tool calls, retrieval, tokens, guardrails, or a handoff when a request mentions a refund or something legal.
- **Standalone agents**: `/agents/new` drafts one from a sentence. Its Deploy tab publishes a real endpoint, `POST /api/v1/agents/<id>/run`, checked against a hashed API key, plus an embeddable chat widget at `/embed/agent/<id>`. Replies are scripted, so calling it costs nothing.
- **Connections**: the Integrations page plays a simulated OAuth consent (Allow or Deny) and adds MCP servers and HTTP tools by URL. Nothing contacts the service and no token is stored; connected tools become switches in the agent editor.
- **GitHub** (`github.ts`): a simulated account (`@<your-name>`) with eight sample repositories. Every version is a commit (its sha comes from the version id); a linked repo keeps each branch as a list of versions plus how many are pushed, so "2 to push", pushes, auto-commit, new branches, pull requests and merges (a fast-forward, or a three-way merge of the two plans) are all real state. About two minutes after linking, a teammate pushes a README change you can pull (or trigger it with "Simulate a teammate pushing" in Pro).
- **Import** (`import.ts`, `repo-files.ts`): `/import` takes a GitHub repo, a Git URL or a ZIP (name and size only), streams a scan, and shows what it found: framework, routes, data models, agents, environment variables and whether it can preview. The project opens with the repo's own files, a plan derived from its routes and models, and three first changes the edit engine can really make. Python, Expo and Jupyter repos are honest about what the demo can't run. Environment values are encrypted at rest (AES-256-GCM).
- **Terminal** (`terminal.ts`): a scripted shell over the current version's real files (`ls`, `cat`, `tree`, `npm test`, `npm run build`…). `git status`, `log`, `branch`, `push`, `pull` and `switch` read and change the linked repo.
- **Preview** (`src/components/preview`): the generated app, rendered from its plan inside a sandboxed frame, with working tables, drawers, chat, run pipelines and settings.

## Stack

- Next.js 16 (App Router, Turbopack) and TypeScript
- Tailwind CSS v4, shadcn/ui on Radix, lucide icons, next-themes
- React Flow (`@xyflow/react`) for the agent flow graph
- Drizzle ORM over Neon (production) or PGlite (local)
- CodeMirror 6 for the code editor, jsdiff for version diffs

## How it's put together

| Path | What's there |
| --- | --- |
| `src/app/page.tsx` | Landing page |
| `src/app/(auth)` | Sign in (simulated) and onboarding |
| `src/app/(app)` | Signed-in pages that share the left rail: Home, Projects, Agents, Explore, Integrations, Usage, Settings |
| `src/app/p/[id]` | The project Workspace |
| `src/app/p/[id]/preview` | The generated app, rendered from a version's plan |
| `src/app/(app)/agents` | Agents library, the New agent wizard and each standalone agent (Configure, Test, Deploy, Usage) |
| `src/app/(app)/import` | Import a project from a GitHub repo, a Git URL or a ZIP |
| `src/app/api/agents`, `src/app/api/v1/agents` | Agent runs: the test console's (signed in) and the public API (API key) |
| `src/app/embed/agent/[id]` | The public chat widget |
| `src/lib/sim` | The simulation engine (see above) |
| `src/db` | Schema and the Neon/PGlite client |
| `src/lib/actions` | Server actions (auth, workspace, projects, build, agents, connections, GitHub and import, the widget) |
| `src/proxy.ts` | Redirects signed-out visitors away from app routes |

### Identity without sign-in

Sign-in is simulated. Signing in creates a workspace and stores its random id in an httpOnly cookie; every row is
scoped to it. A workspace is never looked up by email, since an unverified email must not unlock anyone's data.

### Theme and mode

Light/dark/system is independent of Simple/Pro. Design tokens live in `src/app/globals.css`.

## What's real, what's simulated, what's out of scope

**Real** (actually works, and persists): the database and every workspace, project, version and message in it;
the generated code and its diffs; version restore; the public `/live/<slug>` URL and rollback; the standalone
agent endpoint `POST /api/v1/agents/<id>/run` with a hashed API key, and the `/embed/agent/<id>` widget;
AES-256-GCM encryption of imported environment values; light/dark and Simple/Pro.

**Simulated** (deliberately — no API keys, nothing that can cost money): sign-in, AI planning and code generation,
GitHub, integrations and MCP, agent replies, and the hosting side of a deploy (no provider is called; the app
serves the frozen version itself).

**Out of scope for this build**, and marked as such in the UI rather than hidden: custom domains and DNS,
editing environment variables from Settings, billing and plans, the SQL query console and sample-row editing,
preview comments, the marketplace and prompt library, and the local CLI.

| Area | State |
| --- | --- |
| Design system, app shell, sign-in, onboarding, Home, Projects | Built |
| Planning, streamed builds, live preview, Code tab, versions, the Consultant | Built |
| Diff review, Fix it, visual edits, testing agent, terminal/logs/problems, ⌘K, / and @ | Built |
| Agents: editor, 8 frameworks, flow graph, test console, standalone agents, integrations, MCP | Built |
| GitHub: connect, import (repo, Git URL, ZIP), sync, push, pull, branches, pull requests | Built |
| Deploy: pre-flight, public live URL, deployment history, rollback | Built |
| Custom domains, env var editing, billing, query console, comments, marketplace, CLI | Out of scope |
