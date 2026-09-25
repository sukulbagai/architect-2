# Milestone 7: Polish and submit

> Read `docs/handoff/00-context.md` first. This milestone finishes the remaining feature-matrix items, brings every screen to "reviewer-ready", deploys to Vercel and prepares the submission. Everything stays simulated: no API keys, no paid services.

**Goal:** a Lyzr reviewer opens the live URL, understands the product in two minutes, and finds no dead ends, broken states or rough edges. Design is the top judging criterion, so polish matters more than new features here.

**Remaining feature-matrix rows:**

| Feature | Priority | Build |
| --- | --- | --- |
| Share and preview comments | P2 | Dummy (a real read-only share link is free, so build it) |
| Data tab and query console | P1 | Dummy (a tiny in-browser SQL over sample rows) |
| Local CLI | P2 | Dummy (a docs page with commands) |
| Templates and marketplace | P1 | Partly real (add the marketplace gallery) |
| Prompt library | P2 | Real (a curated list) |
| App mockup | P2 | Dummy |
| Import from ZIP or Git URL | P2 | Dummy (only if M5 skipped it) |
| Testing agent | P2 | Dummy (only if M3 skipped it) |

---

## 7.1 Share and preview comments

- **Share** (Workspace top bar; replace the toast) opens a dialog:
  - **Invite people:** email plus role (Viewer / Editor), "Invite", and a pending list with remove. Say plainly that invites are simulated and no email is sent. Store invites in a `project_invites` table or in `projects.settings.invites`.
  - **Preview link:** a switch, "Anyone with the link can view this version". When on, generate `/share/<token>` (a random 24-char token stored on the project), with copy. `src/app/share/[token]/page.tsx` is **public** (keep it out of the proxy matcher) and renders the current version with `PreviewApp`, plus a slim top bar: "Shared preview of <App> · Built with Architect".
- **Comments on the preview:**
  - A **Comment** mode toggle next to M3's Select toggle, reusing the M3 element-selection protocol.
  - Clicking an element opens a small composer for the comment. Saved comments show as numbered pins over the element in the iframe (the app renders pins from `architect:comments { pins }`).
  - A Comments panel (a drawer or a chat-side list) shows threads with author, time, reply and resolve.
  - Stored in a new `comments` table (`project_id, version_id, edit_id, page_id, body, author_name, resolved_at, created_at`).
  - Shared-preview visitors see the pins read-only.

## 7.2 Data tab: query console (Pro) and editing

- Replace the DataPanel footer placeholder.
- **Pro:** a **Query** view next to Rows/Schema. CodeMirror with `@codemirror/lang-sql` (npm, local) above a results table.
  - Implement a tiny parser in `src/lib/sim/sql.ts` supporting `SELECT <cols|*> FROM <table> [WHERE <col> (=|!=|>|<|LIKE) <value> [AND …]] [ORDER BY <col> [ASC|DESC]] [LIMIT n]` and `SELECT COUNT(*) FROM …`.
  - It runs over the plan's sample rows. Errors show inline with the column position.
  - Keep a history of recent queries plus sample queries as chips.
- **Both modes:** inline editing of sample rows (double-click a cell) and "Add row". Saving creates a version ("Updated sample data"), because the data files change.

## 7.3 Explore: marketplace, prompt library, app mockup

- **Explore** gets three tabs: **Templates** (existing), **Marketplace**, **Prompt library**.
- **Marketplace:**
  - Community apps: about 8 seeded fake listings (with author, clones and category) plus the user's own deployments published in M6.
  - Each card has **Preview** (a read-only dialog rendering the listing's plan with `PreviewApp`) and **Clone** (creates a project from the listing's plan, already built as v1).
- **Prompt library:** about 24 curated prompts grouped by role and task, with filter chips. **Use** navigates to `/home?prompt=<encoded>` and prefills the composer (add that param support).
- **App mockup** (Plan stage): a **Mockup** sub-tab in the Plan panel renders the first page non-interactively (a `PreviewApp` `mockup` flag that disables inputs, inside an iframe or a scaled div) **before** the build, captioned "A mockup from the plan. The real app appears after Build this."

## 7.4 Local CLI docs page

- `/docs/cli` (inside the `(app)` shell) documents a fictional CLI, with a clear "concept" note:

  | Command | What it does |
  | --- | --- |
  | `npx @architect/cli login` | Uses the tokens from M6 Settings |
  | `architect pull <project>` | Gets the project locally |
  | `architect dev` | Runs it locally |
  | `architect push` | Sends local changes back |
  | `architect agents test <agent>` | Tests an agent |
  | `architect deploy --prod` | Deploys |

- Include copyable code blocks and a short "How local and cloud stay in sync" explanation.
- Link to it from Settings → CLI tokens and from ⌘K.

## 7.5 States: empty, loading, error, not-found

- Add `loading.tsx` skeletons for `(app)` pages and for `/p/[id]`. The Workspace skeleton mirrors the real layout: top bar, chat column and stage.
- Add `error.tsx` boundaries (a friendly sentence, **Try again**, and a "Go to Projects" link) at the `(app)` and `/p/[id]` levels. Add `global-error.tsx`.
- A designed global `not-found.tsx` (drafting-grid EmptyState style) at the app root.
- Audit every list and table for an empty state, and every button that triggers async work for a pending state.
- Toasts for failures should say what happened and what to do.

## 7.6 Mobile and accessibility pass

- Walk through **every** page at 390×844 and 768×1024, in light and dark. Fix overflow, tap targets (at least 40 px), sheets (bottom sheets on mobile) and the Workspace Chat/App switch.
- Keyboard: every action is reachable. Visible focus. Dialogs trap focus, and Esc closes them. `?` shows shortcuts.
- Contrast: check muted text on every surface. Use `brand-text` for brand-coloured text, never `brand`.
- `prefers-reduced-motion`: the build timeline, typing effects and landing animations degrade gracefully (the global CSS already shortens animations; check nothing depends on animation end events).

## 7.7 Seeded demo project (for reviewers)

- On Home, for a workspace with no projects, add a card: **"Explore a finished project"**. It calls `seedDemoProject()`, which creates "Support Desk Copilot" already built:
  - v1 → v4 with meaningful edits (theme change, a Reports page, a priority field, a fix)
  - the questions answered and the plan
  - linked to a simulated GitHub repo (M5)
  - a Production deployment live at `/live/support-desk-demo-<4 chars>` (M6)
  - a couple of preview comments (7.1)
- It opens the project straight away. Make it idempotent per workspace.
- Consider also offering it on the landing page as "See a finished project" (after sign-in).

## 7.8 Landing, metadata and README

- **Landing:** update the copy to reflect what's now built. Add a "What reviewers should try" strip with four chips that deep-link after sign-in (Build from a prompt, Import a repo, Test an agent, Deploy). Make sure every link works.
- **Metadata:** `app/opengraph-image.tsx` (`next/og`, local) with the logo and headline; per-page titles; `manifest.ts` (optional).
- **README.md** (for reviewers and developers):
  - What it is (3 lines)
  - **A 2-minute reviewer tour** (numbered steps with the exact buttons to press)
  - Screenshots (`docs/screenshots/*.png`, captured with the Playwright harness: landing, Home, Workspace plan, build timeline, preview, Pro code and diff, agents, GitHub sheet, deploy sheet, live app, dark mode, mobile)
  - The feature list with Real / Simulated labels
  - Architecture (keep the existing sections)
  - How to run locally and how to deploy
  - A design notes section: the principles from `docs/spec.md`, and why one project with two depths

## 7.9 Deploy to Vercel (the user does the account steps)

The agent prepares; the user clicks. Give the user this exact checklist:
1. Push `main` (with the user's permission).
2. At vercel.com → **Add New… → Project** → import `sukulbagai/architect-2`. The framework preset is auto-detected as Next.js. The build command stays `pnpm build` (it runs `scripts/migrate.ts` then `next build`).
3. Project → **Storage** → **Create Database → Neon** (free plan, no card). Connect it to the project. This injects `DATABASE_URL`.
4. Optional: add `ARCHITECT_SECRET` (any long random string; used to encrypt env var values, M6).
5. **Deploy.** In the build logs, check that `[migrate] Neon schema is up to date.` appears.
6. Smoke test the production URL in a private window: landing → sign in → create a project → build → deploy → open `/live/<slug>` signed out.
7. At submission time, make the repo public: `gh repo edit sukulbagai/architect-2 --visibility public --accept-visibility-change-consequences` (confirm with the user first).

If the user doesn't want a Neon account, the fallback is `ALLOW_EMBEDDED_DB=1`: PGlite in the serverless function's `/tmp`, where **data resets unpredictably**. Explain that trade-off before suggesting it; don't enable it silently.

## 7.10 Final QA and submission

- Run the full regression across M1–M7 (00-context §12) in light, dark and mobile. Zero console errors. No hydration errors in the logs.
- Check the production build locally with `pnpm build && pnpm start` before the Vercel deploy.
- Performance sanity: the Workspace JS isn't absurdly large (CodeMirror is already dynamically imported; do the same for React Flow and the SQL console), and images and fonts load quickly.
- **Submission** (the hiring page, https://hiring.lyzrarchitect.space → Submit tab): the live Vercel URL and the public GitHub repo URL. Draft a short cover note for the user that explains the two-depths idea and states plainly which parts are simulated and why (no paid services, by design).

## Placeholders to remove

- The Workspace Share toast
- The DataPanel footer note
- Any remaining "arrives in a later milestone" copy anywhere (`grep -rn "milestone" src` should only find code comments)

## QA checklist

1. Share → preview link → open `/share/<token>` signed out → comment pins visible read-only.
2. Comment mode → pin a comment on the Queue title → reply → resolve.
3. Data → Query: `SELECT subject, urgency FROM tickets WHERE urgency = 'Urgent' ORDER BY received DESC LIMIT 5` → correct rows. A bad column → an inline error.
4. Explore → Marketplace → Clone → a built project. Prompt library → Use → Home prefilled.
5. Plan stage → Mockup tab renders before the build.
6. A new workspace → "Explore a finished project" → the fully populated project (versions, repo, live URL, comments).
7. Every page at 390 px and 768 px, in light and dark: screenshots reviewed and fixed.
8. `pnpm build && pnpm start` smoke test. Then the user's Vercel deploy and a production smoke test.
