# Handoff: finishing Architect 2.0

These files let a coding agent in another terminal finish the build, one milestone at a time, with no context from earlier sessions. Milestones 1 (foundation), 2 (simulated plan and build), 3 (iterate) and 4 (agents) are done and on `main`. Milestone 5 (GitHub and import) is built on top of them.

| File | What it's for |
| --- | --- |
| [`00-context.md`](00-context.md) | **Read first, every time.** Product, hard rules, current state, codebase map, simulation engine, design system, Next.js 16 gotchas, QA recipe, definition of done |
| [`03-iterate.md`](03-iterate.md) | M3: diff review, Fix it, visual edit, Pro drawer (terminal, logs, problems), ⌘K, /commands and @files, testing agent |
| [`04-agents.md`](04-agents.md) | M4: agent editor, per-framework code, flow graph, test console, standalone agents (API + widget), integrations and MCP, knowledge |
| [`05-github.md`](05-github.md) | M5: simulated GitHub connect, repo universe, import with analysis, sync chip, push, branches, PRs |
| [`06-ship.md`](06-ship.md) | M6: deploy sheet, public `/live/<slug>`, deployments and rollback, env vars, Usage, CLI tokens, team |
| [`07-polish-and-submit.md`](07-polish-and-submit.md) | M7: share and comments, query console, marketplace, prompt library, mockup, CLI docs, states, a11y, demo project, README, Vercel deploy, submission |
| [`../spec.md`](../spec.md) | The product spec (snapshot of the living doc) |

## Order and dependencies

Run them in order: **3 → 4 → 5 → 6 → 7** (3, 4 and 5 are done). Each one leaves a working app. Where a later milestone leans on an earlier one:

- **M3 → M6:** M3's issues feed the deploy pre-flight.
- **M3 → M7:** M3's element selection is reused by M7's comments.
- **M4 → M5:** M4 creates the `connections` table that GitHub uses. If you run M5 first, create the table there.
- **M5 → M6:** preview deploys per branch need M5's branches.
- **M6 → M7:** M6 deployments feed M7's marketplace and demo project.

## Standing preferences from the user

- **Dummy flows only:** no API keys, and nothing that could cost money. Ask before adding *any* external service, even a free one.
- **No Supabase.** The database is Neon (free, via Vercel) in production and PGlite locally.
- **Commit and push only when asked,** directly to `main`.
- **Light/dark is separate from Simple/Pro.**
- **Design quality comes first.** Screenshot and look at every new screen in light, dark and at phone width before calling a milestone done.

## Prompt to paste into the agent

Replace `NN-file` with the milestone file.

```
You're continuing the Architect 2.0 build in /Users/sukulbagai/Desktop/tmp_Architect2.0.

1. Read docs/handoff/00-context.md in full, then docs/handoff/NN-file.md. Use docs/spec.md for product detail.
2. Build everything in that milestone file, in its suggested order. Follow the hard rules in 00-context §2:
   no API keys, every external/paid service simulated in-app, no Supabase, sign-in stays simulated.
3. Match the existing code's patterns and the design system (00-context §9). Read the Next.js 16 docs in
   node_modules/next/dist/docs/ before using APIs you're unsure about.
4. Verify: pnpm typecheck && pnpm lint && pnpm build, then the QA recipe in 00-context §12 plus the
   milestone's QA checklist, with light, dark and 390px screenshots that you actually look at. Zero console
   errors, no hydration errors in the dev log.
5. Remove the placeholders this milestone replaces, and update the README status table.
6. Don't commit or push unless I ask. When you're done, tell me what changed, what's simulated, how you
   verified it, and anything you deferred.
```

To run several milestones in one long session, say so explicitly ("do M3 and M4, pausing after each for my review").
