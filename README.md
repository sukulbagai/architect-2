# Architect 2.0

A vibe-coding platform for agentic apps, designed for two audiences at once: builders who never want to see code,
and developers who want files, diffs, Git and a terminal. Same project underneath, two depths on top.

The product spec (research, flows, feature matrix, architecture and build plan) is in [`docs/spec.md`](docs/spec.md). Handoff notes for the remaining milestones are in [`docs/handoff/`](docs/handoff/README.md).

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
- **Terminal** (`terminal.ts`): a scripted shell over the current version's real files (`ls`, `cat`, `tree`, `git log`, `npm test`, `npm run build`…).
- **Preview** (`src/components/preview`): the generated app, rendered from its plan inside a sandboxed frame, with working tables, drawers, chat, run pipelines and settings.

## Stack

- Next.js 16 (App Router, Turbopack) and TypeScript
- Tailwind CSS v4, shadcn/ui on Radix, lucide icons, next-themes
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
| `src/lib/sim` | The simulation engine (see above) |
| `src/db` | Schema and the Neon/PGlite client |
| `src/lib/actions` | Server actions (auth, workspace, projects, build) |
| `src/proxy.ts` | Redirects signed-out visitors away from app routes |

### Identity without sign-in

Sign-in is simulated. Signing in creates a workspace and stores its random id in an httpOnly cookie; every row is
scoped to it. A workspace is never looked up by email, since an unverified email must not unlock anyone's data.

### Theme and mode

Light/dark/system is independent of Simple/Pro. Design tokens live in `src/app/globals.css`.

## Status

| Milestone | Scope | State |
| --- | --- | --- |
| 1. Foundation | Design system, app shell, database, sign-in, onboarding, Home, Projects | Done |
| 2. Plan and build | Simulated planning, streamed builds, live preview, code tab, versions, the Consultant | Done |
| 3. Iterate | Diff review, Fix it, visual edits, testing agent, terminal/logs/problems drawer, ⌘K, / commands and @ mentions | Done |
| 4. Agents | Agents panel, frameworks, test console, runtime | Next |
| 5. GitHub | Simulated connect, import, push, branches | |
| 6. Ship | Deploys, live URLs, rollback, env vars, usage | |
| 7. Polish | Remaining flows, states, mobile, demo project | |
