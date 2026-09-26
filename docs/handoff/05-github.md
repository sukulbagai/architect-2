# Milestone 5: GitHub and import

> **Status: built.** What exists, and where it differs from this brief, is in `00-context.md` §3 (Milestone 5) and §11.

> Read `docs/handoff/00-context.md` first. **Nothing here talks to GitHub.** There's no OAuth app, no token and no API call. Connecting, repos, commits, branches, pull requests and imports are all simulated, deterministically, in `src/lib/sim/github.ts`.

**Goal:** developers must feel they own their code. The project lives in "their" repo, changes become commits, and there are branches and pull requests. Builders get auto-sync without having to think about it. Existing projects can be imported and continued in Architect.

**Spec references:** `docs/spec.md` → Core flows §7 "Import" and §8 "GitHub", Workspace anatomy (top-bar sync chip; GitHub row in the Simple vs Pro table), Research ("Import opens up beyond Next.js"). Feature-matrix rows:

| Feature | Priority | Build |
| --- | --- | --- |
| Import a GitHub repo, with analysis | P0 | Dummy |
| GitHub connect, create repo, push | P0 | Dummy |
| Branches, pull, Open PR | P1 | Dummy |
| Import from ZIP or Git URL | P2 | Dummy |

Suggested order: 5.1 → 5.2 → 5.4 → 5.5 → 5.3 → 5.6.

---

## 5.1 Simulated GitHub account and connect flow

- **The connect dialog** (`components/github/connect-github-dialog.tsx`) is reused from four places: onboarding step 3, the Integrations GitHub card, the Workspace top-bar GitHub button, and the import flow.
  1. **Authorize Architect** (a GitHub-like, but not GitHub-branded, consent screen using `GithubGlyph`). Account: `@<login>`. Permissions list: "Read and write code in repositories you choose", "Create repositories", "Read your profile". **Authorize** / **Cancel**.
  2. "Connecting…" (about 900 ms), then "Connected as @login".
- `login`: a slug of the workspace name (e.g. "Alex Rivera" → `alex-rivera`). Store it in `workspaces.githubLogin` (the column already exists) and add a `connections` row with `integration_id = "github"` (the table comes from M4; create it here if M4 wasn't done).
- **Disconnect** lives in Integrations and Settings. Disconnecting doesn't unlink projects; they show "GitHub disconnected · Reconnect".
- Server actions (`src/lib/actions/github.ts`): `connectGithub()`, `disconnectGithub()`.

## 5.2 A simulated repository universe (`src/lib/sim/github.ts`, pure)

- `reposFor(login)`: a deterministic list of about 8 repos, each with `{ name, fullName, private, language, framework, updatedAt, stars, defaultBranch, branches[], description, profile }`. Cover these shapes:
  - `marketing-site`: Next.js 15 + Tailwind, 58 files, needs `NEXT_PUBLIC_POSTHOG_KEY`
  - `crm-lovable-export`: Vite + React + Supabase client (an "exported from Lovable" example), needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `support-bot`: Next.js 14 + Prisma + a LangChain agent, needs `DATABASE_URL`, `OPENAI_API_KEY`, `NEXTAUTH_SECRET`
  - `invoice-api`: FastAPI + SQLAlchemy (Python only, **no preview**, the honest "needs a server sandbox" case)
  - `data-notebooks`: Jupyter (not importable; show why)
  - `docs-site`: Astro
  - `mobile-app`: Expo React Native (importable as code-only; preview not supported)
  - `agent-playground`: TypeScript + Mastra
- `profile`: the analysis result, `{ framework, language, files: number, packageManager, routes: string[], models: string[], envVars: string[], agents: string[], previewable: boolean, notes: string[] }`, plus a small `files` map (5–10 real-looking files: package.json, a page or two, schema.prisma if relevant, README).
- `planFromRepo(profile, name)` → `Plan`. Pages come from routes, collections from `models` (with generated sample rows, like `genericBlueprint`), agents from `agents` (or a single "Assistant"), theme `studio`. Imported projects then flow through the normal preview, edits and versions.
- `commitSha(versionId)` = `hashString(versionId).toString(16).padStart(7,"0").slice(0,7)`. Commits are **derived from versions**; there's no separate commit store.

## 5.3 Import flow (P0)

**Entry points**
- Home → "Import a repo" (replace the toast)
- Projects page header → "Import" (secondary button next to New project)
- ⌘K → "Import a repository"

**Route:** `/import` (inside the `(app)` shell) as a focused multi-step page, not a modal. It's a real journey, and the URL lets reviewers deep-link it.

1. **Source**, as three tabs:
   - **GitHub:** if not connected, show a Connect card. Otherwise a searchable repo list: name, language dot, private lock, "updated 3d ago", and a disabled row with a reason for non-importable repos ("Jupyter notebooks can't be imported yet").
   - **Git URL:** an input validated as `https://github.com/<owner>/<repo>(.git)` or `git@…`. Unknown repos map to a generic profile (Vite + React, 24 files).
   - **ZIP:** a drop zone (store name and size only; never read the contents). It maps to a generic profile named after the file.
   - Plus a hint line: "Built this in Lovable, v0 or Bolt? Export it to GitHub first, then import it here."
2. **Branch:** a select from `branches` (default preselected), then **Scan repository**.
3. **Analysis** (streamed, about 4 s):
   - Cloning `owner/repo` @ main · 58 files
   - Reading package.json
   - Detected Next.js 15 · TypeScript · pnpm
   - Found 6 routes, 3 data models
   - Found 3 environment variables
   - Checking whether it can preview

   Then an **Analysis card** with those facts as chips, the routes list, the models, the agents found, and a verdict:
   - "Ready to preview", or
   - "Code only: previews need a server sandbox, which isn't available in this demo. You can still edit, version and push it." (for the Python, Expo and Jupyter cases)
4. **Environment variables:** a form, one row per detected key (masked inputs, with a "Where do I find this?" helper link text per well-known key). **Skip for now** or **Save**. Values go to `env_vars` (see M6 for masking and the environment column; if M6 isn't done, store them plainly with a TODO for masking).
5. **Open in Architect** (the brand button) calls `importRepository(input)`, which creates:
   - a project with `source: "import"` and `repo` linked (connected, synced, branch);
   - v1 = the repo's files, merged with generated files so the Code tab isn't empty;
   - the plan from `planFromRepo`;
   - a first assistant message: "I've read **owner/repo**. It's a Next.js 15 app with 6 routes and 3 data models. Here's how it's organised: … What should we change first?", with three suggestion chips that are real `applyEdit`-able requests.
6. Redirect to `/p/<id>`. Non-previewable projects show the honest "needs a server sandbox" state in the Preview tab, with a link to the Code tab.

## 5.4 Workspace GitHub panel and sync status (P0/P1)

**Top bar:** replace the icon button with a **sync chip** next to the GitHub glyph.

| State | Chip |
| --- | --- |
| Not connected | "Connect GitHub" (opens 5.1) |
| Connected, repo not linked | "Link repository" |
| Linked, up to date | `main · synced 2m ago` (success dot) |
| Ahead | `main · 2 to push` (warning dot) |
| Pushing | `Pushing…` |
| Remote has changes | `main · 1 to pull` |

Clicking it opens the **GitHub sheet** (right side):
- **Link repository:** Create a new one (name prefilled from the slug, Private/Public radio, description), or link an existing one (from `reposFor`). Progress: "Creating owner/name" → "Pushing 23 files" → "Done", with a failure path (the name already exists → inline error and a suggestion `name-2`).
- **Branch switcher:** `main` plus created branches, and **New branch** (from the current version). Store it in `projects.repo`:
  ```ts
  repo: { owner, name, url, private, branch, autoCommit: boolean,
          lastPushedVersionId: string | null,
          branches: Record<string, { head: string /* versionId */ }>,
          prs: { number: number; title: string; body: string; from: string; to: string; status: "open"|"merged"|"closed"; createdAt: string }[],
          remoteAhead?: number }
  ```
  Extend the `repo` column's TS type; it's JSON, so no migration is needed. Switching branch moves `currentVersionId` to that branch's head, and every new version advances the current branch's head.
- **Changes:** unpushed versions listed as commits (sha · message · time). **Push** plays "Pushing 3 commits…" and updates `lastPushedVersionId`.
  - **Auto-commit** (switch): on by default for Simple users, off for Pro. When it's on, each new version is pushed automatically after a 1 s simulated delay, and the chip flickers "Pushing…".
- **Pull:** a deterministic "remote change" appears once, about 2 minutes after linking (or via a "Simulate teammate push" link in Pro, for demos). Pulling creates a version "Merged 1 commit from origin/main: Update README", which changes README.md.
- **Pull requests:**
  - **Open PR** (from a non-main branch): the title and body are prefilled from the branch's commits (body = a bulleted list of the edit titles).
  - The PR appears in a list (`#12 · Open`) with **Merge** (fast-forwards main to the branch head, status merged) and **Close**.
  - The link text looks like `github.com/owner/name/pull/12`, but **don't** render it as a clickable link to github.com. Show it as copyable text with a tooltip: "Simulated in this demo".
- **Disconnect repository:** unlink, with a confirm dialog.

## 5.5 Git everywhere else

- **Versions tab:** when linked, each version shows its commit sha chip and whether it's pushed (a cloud icon) or local.
- **Code tab (Pro):** git decorations in the file tree (M/A/D letters, coloured) for files changed since `lastPushedVersionId`, plus a "3 files changed since last push" header with **Push**.
- **Terminal (M3):** `git status`, `git log`, `git branch`, `git push` and `git pull` now read the real simulated state.
- **Workspace Settings tab:** a GitHub section (repo name, visibility, default branch, auto-commit switch, Disconnect). Remove the placeholder note.
- **Onboarding step 3:** Connect GitHub works (replace the toast). After connecting, the card shows "Connected as @login".
- **Integrations page:** the GitHub card shows the connected state and repo count.

## 5.6 Composer "Pro" review integration (if M3 is done)

When Review changes (M3) and GitHub are both on, accepting a proposal uses the commit message typed in the Review tab as the commit subject, and the chip goes to "1 to push" (or auto-pushes).

---

## Placeholders to remove

- The Home "Import a repo" toast
- The onboarding GitHub toast
- The Workspace GitHub toast
- The Integrations GitHub toast
- The "…GitHub settings arrive…" part of the Workspace Settings note

## QA checklist

1. Onboarding → Connect GitHub → Authorize → "Connected as @alex-rivera".
2. Home → Import a repo → GitHub tab → `support-bot` → branch main → Scan → the analysis streams → the env form shows 3 keys → Skip → Open → the Workspace has a first message, preview, Code tab and plan.
3. Import `invoice-api` → the "Code only" verdict → the Preview tab shows the honest sandbox state.
4. Git URL tab with a garbage URL → validation error. A valid unknown URL → generic profile. ZIP tab → a named project.
5. Built project → chip "Link repository" → Create (public) → push progress → chip `main · synced`.
6. Pro (auto-commit off) → two edits → chip "2 to push" → Push → synced. Versions show sha chips. The Code tree shows M markers before pushing.
7. New branch `feature/reports` → an edit → Open PR → the PR is listed → Merge → main advances.
8. Simulate teammate push → "1 to pull" → Pull → README version.
9. Terminal: `git log --oneline` matches the Versions tab.
10. Light, dark and mobile screenshots of the import steps, the GitHub sheet and the chips. Zero console errors. Regression of M1–M4.
