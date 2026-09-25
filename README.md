# Architect 2.0

A vibe-coding platform for agentic apps, designed for two audiences at once: builders who never want to see code,
and developers who want files, diffs, Git and a terminal. Same project underneath, two depths on top.

The product spec (research, flows, feature matrix, architecture and build plan) lives in a separate shared doc.

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

## Stack

- Next.js 16 (App Router, Turbopack) and TypeScript
- Tailwind CSS v4, shadcn/ui on Radix, lucide icons, next-themes
- Drizzle ORM over Neon (production) or PGlite (local)

## How it's put together

| Path | What's there |
| --- | --- |
| `src/app/page.tsx` | Landing page |
| `src/app/(auth)` | Sign in (simulated) and onboarding |
| `src/app/(app)` | Signed-in pages that share the left rail: Home, Projects, Agents, Explore, Integrations, Usage, Settings |
| `src/app/p/[id]` | The project Workspace |
| `src/db` | Schema and the Neon/PGlite client |
| `src/lib/actions` | Server actions (auth, workspace, projects) |
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
| 2. Plan and build | Simulated planning, streamed builds, live preview, code tab, versions | Next |
| 3. Iterate | Diff review, fix-it, visual edits, command palette | |
| 4. Agents | Agents panel, frameworks, test console, runtime | |
| 5. GitHub | Simulated connect, import, push, branches | |
| 6. Ship | Deploys, live URLs, rollback, env vars, usage | |
| 7. Polish | Remaining flows, states, mobile, demo project | |
