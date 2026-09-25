# Milestone 6: Ship

> Read `docs/handoff/00-context.md` first. Deploys are simulated in the sense that **no hosting provider is called**, but they're partly real. A deploy freezes a version, and `/live/<slug>` on this same Next.js app serves it **publicly**, so reviewers get a real, shareable URL for free. Custom domains, DNS and billing are simulated.

**Goal:** the moment of truth. One button takes a version live behind a pre-flight checklist. Every deploy is logged and can be rolled back. Secrets live in env vars. Usage shows what each build cost.

**Spec references:** `docs/spec.md` → Core flows §9 "Deploy", IA (Usage, Settings, Live app), Design principle 8 (cost), Simple vs Pro table ("Deploy" row). Feature-matrix rows:

| Feature | Priority | Build |
| --- | --- | --- |
| Deploy sheet with checklist and logs | P0 | Partly real: a real snapshot URL; custom domains are faked |
| Deployment history and rollback | P1 | Real |
| Env vars and secrets | P1 | Real: stored per project, masked in the UI |
| Usage and credits | P1 | Dummy: simulated token counts and billing (already recorded in the `usage` table) |
| Settings, theme and mode | P0 | Real (add CLI tokens and a team section) |

Suggested order: 6.1 data → 6.3 live route → 6.2 deploy sheet → 6.4 Deployments tab → 6.5 env vars → 6.6 Usage → 6.7 Settings.

---

## 6.1 Data model (migration `pnpm db:generate --name ship`)

- `deployments`: add
  - `url text`
  - `version_number integer`
  - `custom_domain text`
  - `domain_status text` (`pending|verified|failed`)
  - `analytics boolean default false`
  - `views integer default 0`
  - `marketplace jsonb` (`{ category, short, description, tags[] } | null`)
  - `duration_ms integer`
  - a unique index on `(slug, environment)` for the *active* deployment. Or keep history rows and mark one `active boolean`; choose one approach and document it.
- `env_vars`: add `environment text default 'all'` (`all|production|preview`) and `updated_at`. The unique index becomes `(project_id, key, environment)`.
- New `plans` concept (simulated billing): add `plan text default 'free'` to `workspaces` (`free|starter|pro|scale|enterprise`).
- New table `cli_tokens` (`id, workspace_id, name, prefix, hash, created_at, last_used_at`) for 6.7.

## 6.2 Deploy sheet

Opened by the top-bar **Deploy** button (replace the toast), by ⌘K "Deploy", and by `/deploy` in the composer. It's a right-side `Sheet` (a bottom sheet on mobile).

**Step 1: Pre-flight** (auto-runs on open; each row animates spinner → ✓/✕, about 300 ms apart):

| Check | Passes when | Failure copy and fix link |
| --- | --- | --- |
| Build passes | No open issues (M3 `plan.issues`) | "The Reports page has an error." → **Fix it** |
| Environment variables set | Every key in the generated `.env.example` (or detected on import) has a value for Production | "STRIPE_KEY has no value." → opens Settings tab › Environment variables |
| No secrets in client code | No file contains `sk_live`, `ghp_`, `-----BEGIN PRIVATE KEY` or `API_KEY="…"` literals | "Found a secret in src/lib/agents.ts:12." → opens Code at the line |
| Agents reachable | Always ✓ (show a ms figure per agent) | — |
| Security scan | Always ✓ "0 issues" (Lovable-style) | — |

Deploy is blocked while a check fails (the button is disabled, with a reason in its tooltip). Pro gets a subtle "Deploy anyway" for the secrets check only, with a confirm dialog.

**Step 2: Settings**
- **Address:**
  - An input for `slug`. The display shows `slug.architect.app` as the vanity name; the real URL is `/live/slug`, shown underneath in muted text.
  - A debounced availability check (server action) against other projects' deployment slugs plus reserved words (`admin`, `api`, `app`, `www`, `live`, `embed`). Show ✓ available / ✕ taken, with a suggestion.
- **Environment:** Production or Preview (Pro also offers "Preview for branch <x>" if M5 is done). Preview deploys use the slug `<slug>--preview-<4 chars>`.
- **Custom domain** (collapsible):
  - A domain input, then a DNS records table (`CNAME www → cname.architect.app`, `A @ → 76.76.21.21`).
  - **Verify** runs a simulated check: pending (2 s), then verified. Or "failed" if the domain contains "example", to show the failure state.
  - Stored on the deployment. A note says it's simulated.
- **Analytics:** a switch (enables the views counter).
- **Publish to Marketplace:** a switch. When on, it reveals category (select), short description (160-character counter), description and tags (up to 8, as chips). Listings appear in Explore (M7).

**Step 3: Deploy** (the brand button, "Deploy v7 to Production")
- Stream the logs in a mono box, about 6–8 s:
  - `Building v7 · 23 files`
  - `Compiled in 2.1s`
  - `Uploading static assets (412 KB)`
  - `Starting 3 agents: triage, drafter, escalation`
  - `Assigning slug.architect.app`
  - `Ready`
- A failure path: if the network flag `?fail=1` is on, or a secrets check was overridden, fail at "Uploading" with a retry.
- Server action `deployVersion(projectId, { slug, environment, versionId, analytics, marketplace, customDomain })` writes the deployment (status ready, logs, duration) and sets the project `status` to `live` (production only).

**Success state:**
- The URL (copy + open), the vanity name, a **QR code** (use the `qrcode` npm package to render SVG locally; don't use an image API), share buttons (copy link, email via `mailto:`, X/LinkedIn share *intent URLs*, which are just links), "v7 is live on Production" and **View deployments**.
- A chat event: "Deployed v7 to Production · slug.architect.app".

## 6.3 Live URL route (real, public)

- `src/app/live/[slug]/page.tsx`: **no workspace needed**. Keep `/live` out of the proxy matcher and out of `(app)`.
- Look up the active ready deployment by slug, load its version's plan and render `<PreviewApp plan={plan} />` (not embedded).
  - If analytics is on, increment `views` in a non-blocking way (it's fine to use `after()` from `next/server`; check the Next 16 docs).
  - Add a small floating "Built with Architect" badge (bottom right) linking to `/`. Hide it on paid simulated plans.
- `generateMetadata`: title = appName, description = tagline, plus an OG image (optional; `opengraph-image.tsx` with `next/og` is free and local).
- Unknown slug: a designed not-found page ("Nothing's deployed here yet").
- Rolling back changes which version the slug serves, immediately.

## 6.4 Deployments tab (Workspace stage)

- A new stage tab, **Deployments**, between Versions and Settings. It shows a dot when something is live.
- A list, newest first: environment badge (Production = success, Preview = info), version (v7), status, the URL (copy/open), who ("You"), time, duration and views (if analytics is on).
- Row actions:
  - **View logs** (expand; the stored lines)
  - **Rollback to this** (production rows that aren't active). A confirm dialog: "Serve v4 at slug.architect.app again? v7 stays in history." It creates a new deployment record pointing at the old version (reason: rollback).
  - **Promote to Production** (preview rows)
  - **Redeploy**
- An empty state with **Deploy** as the action.
- The Workspace's top-bar Deploy button shows a small green "Live" dot once production is live.
- **Projects list / rail:** status Live (green) now actually appears.

## 6.5 Environment variables and secrets

In Workspace → Settings tab, add an **Environment variables** section (replacing the placeholder note):
- A table: key, a masked value (`••••••••` plus the last 4 characters), environment (All/Production/Preview), updated, and actions (Reveal, Edit, Delete).
- **Add variable:** key (uppercase, validated as `[A-Z0-9_]+`), value, environment.
- **Paste .env:** a bulk import that parses `KEY=value` lines and previews them before saving.
- Suggestions: keys from the generated `.env.example` that have no value show up as "Missing" rows with **Add value**.
- **Storage:** encrypt values at rest with `node:crypto` AES-256-GCM, using a key derived from `process.env.ARCHITECT_SECRET` when set, or a fixed development key otherwise. `ARCHITECT_SECRET` is an optional random string and **not** a third-party key. Values only reach the browser on **Reveal** (a server action returning one value). Never put values in `plan`, `files` or generated code.
- Simple copy: "Secrets your app needs, like API keys. They're kept on the server and never shown in your app's code."

## 6.6 Usage page (replace the static tiles)

Read the real `usage` rows (simulated tokens written by build/edit actions since M2):
- **KPI tiles:**
  - Credits used this month (1 credit = $0.01 of simulated cost), shown against the plan allowance (Free 100, Starter 2,000, Pro 4,000, Scale 9,900)
  - AI turns today (count of usage rows)
  - Live apps (active production deployments)
  - Average credits per build
- **Chart:** credits per day for the last 30 days, as a bar chart (hand-rolled SVG with Architect tokens, accessible labels, and a clear hover tooltip showing date and credits). Keep it visually consistent with the rest of the product.
- **Breakdown by step** (plan, agents, ui, build, test): a horizontal bar list with credits and percentages.
- **By project:** a table (project, builds, edits, credits, last activity), sortable.
- **Plan card:** the current simulated plan with **Change plan**, a dialog listing Free/Starter $20/Pro $40/Scale $99/Enterprise with their features.
  - Choosing one shows a confirmation: "Plans are simulated in this demo. No payment is taken." Then update `workspaces.plan`.
  - **Never render card or payment fields.**
- Empty state for new workspaces (keep the current copy).

## 6.7 Settings additions

- **CLI tokens:** generate a named token → show `arch_…` once with copy → list with prefix, created and last-used dates, and revoke. Store hash + prefix only. (M7's CLI docs page refers to this.)
- **Team:** invite by email with role Viewer/Editor. Show pending invites (simulated; no email is sent, and the UI says "Invites are simulated in this demo") and allow Revoke. Show the workspace owner.
- Keep the existing Profile, Mode, Appearance and Session sections.

---

## Placeholders to remove

- The Workspace Deploy toast
- The Usage static tiles
- The "Environment variables… arrive…" note in the Workspace Settings tab
- The terminal's `architect deploy` hint (M3), which should now run a CLI-style deploy log and point to the Deployments tab
- The composer's `/deploy` toast (M3, `chat-composer.tsx`), which should open the deploy sheet

## QA checklist

1. A built project → Deploy → pre-flight all ✓ → slug availability (try "api" → reserved) → Production → Deploy → logs stream → success with URL and QR code.
2. Open `/live/<slug>` in a **signed-out** browser context: the app renders, with the badge.
3. `break it` (M3) → Deploy → "Build passes" fails with a Fix link → fix → deploy works.
4. Add a hand edit containing `sk_live_123` → the secrets check fails with a file link.
5. An edit → deploy v2 → Deployments shows two rows → Rollback to v1 → `/live/<slug>` serves v1 → the Projects page shows Live.
6. Preview deploy → Promote to Production.
7. Env vars: add, reveal, edit, delete, paste a .env. A missing key from `.env.example` blocks the deploy.
8. Usage shows non-zero numbers after builds and edits. The chart renders in light and dark. Change plan → confirmation → plan updated.
9. CLI token create/revoke. Team invite and revoke.
10. Light, dark and mobile screenshots (the deploy sheet as a bottom sheet on mobile). Zero console errors. Regression of M1–M5.
