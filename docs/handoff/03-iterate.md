# Milestone 3: Iterate

> Read `docs/handoff/00-context.md` first. Everything here is simulated: no API keys, no paid services.

**Goal:** after the first build, changing the app should feel safe and powerful for both audiences. Builders point at things and click Fix it. Developers review diffs before anything lands, use a terminal and logs, and drive everything from the keyboard.

**Spec references:** `docs/spec.md` → Core flows §5 "Iterate", Workspace anatomy (bottom drawer, Simple vs Pro table), Design principles 4, 6 and 9. Feature-matrix rows covered here:

| Feature | Priority | Build |
| --- | --- | --- |
| Diff review before applying | P1 | Real |
| Error banner and Fix it | P1 | Dummy |
| Visual edit (click to edit) | P1 | Dummy |
| Terminal, logs and problems drawer | P1 | Dummy |
| Command palette (Cmd+K) | P1 | Real |
| Testing agent | P2 | Dummy |
| Simple vs Pro differences (composer @file, /commands, model; expandable build steps) | from Workspace anatomy | Real |

Suggested order: 3.5 (Cmd+K, independent) → 3.2 (issues, because 3.4 and 3.7 depend on it) → 3.1 → 3.3 → 3.4 → 3.6 → 3.7 → 3.8.

---

## 3.1 Diff review before applying (Pro)

**UX**
- A **"Review changes"** toggle, Pro only. It lives in two places: an icon toggle in the chat composer toolbar (`GitCompare` icon, tooltip: "Review each change as a diff before it's applied"), and Workspace → Settings tab. It defaults to off and is stored per project.
- With it on, a Build-mode chat request does **not** create a version. Instead a **Proposal card** appears in chat with the title, the change bullets, the files with +/− counts and three buttons: **Review**, **Accept all**, **Discard**.
- A new stage tab, **Review**, appears only while a proposal is pending (show a count badge). It contains:
  - a file list with a checkbox per file (all checked by default), its status letter (A/M/D) and +/− counts;
  - the selected file's `DiffView` (already exists in `workspace/diff-view.tsx`);
  - a **commit message** input, prefilled in conventional-commit style (e.g. `feat(ui): switch to the Midnight theme`);
  - the actions **Accept selected** (brand button, the one primary action) and **Discard**.
  - Keyboard: `j`/`k` move between files, `x` toggles the current file, `⌘↵` accepts.
- Accepting creates the version and an edit card ("You accepted 2 of 3 files · v5"). Discarding leaves an event line ("Change discarded. The app is unchanged.").
- Simple mode never sees proposals. Decide on the server using the mode sent with the request: review applies only when `mode === "pro"` **and** the setting is on.
- If the app changed after the proposal was made (the current version ≠ the proposal's base version), accepting fails with a friendly message: "The app changed since this was proposed. Ask again and I'll redo it against the latest version."

**Data and server**
- `ProjectSettings.reviewChanges?: boolean`.
- Add `"proposal"` to `MessageKind`. The message `data`:
  ```ts
  { status: "pending" | "accepted" | "partial" | "discarded", baseVersionId: string, title: string,
    changes: string[], plan: Plan /* proposed */, commit: string,
    files: { path: string; status: "added"|"modified"|"deleted"; before: string|null; after: string|null; added: number; removed: number }[] }
  ```
- `sendMessage(projectId, text, mode, opts?: { uiMode: "simple"|"pro" })`: for a build-mode edit with review on, run `applyEdit`, regenerate the files, diff them against the current version, and insert the proposal message. **Don't** touch `currentVersionId`.
- New actions in `src/lib/actions/build.ts`:
  - `acceptProposal(projectId, messageId, acceptedPaths: string[], commitMessage: string)`
    - Accepting everything: the new version's plan is the proposed plan.
    - Accepting part of it: the plan is the proposed plan plus `fileOverrides` that pin each **rejected** path to its base content (a rejected deletion re-adds the file). Files come from `generateFiles(plan)`, as everywhere else.
    - Set the message status and add an `edit` message (`author: "you"`, title = commit message).
  - `discardProposal(projectId, messageId)`.
  - `setProjectSettings(projectId, patch: Partial<ProjectSettings>)`, a general setter you'll reuse for 3.7 and later milestones.
- Put the commit message helper in a new `src/lib/sim/commit.ts` (it's pure): `commitMessage(title, changes)` → `type(scope): summary`. Use `feat` for added things, `style` for theme and visual changes, `fix` for Fix it, and `chore` otherwise.

**Client**
- `use-workspace.ts` gains `pendingProposal` (derived from messages), `acceptProposal`, `discardProposal` and `settings`.
- New `src/components/workspace/review-panel.tsx`, plus `ProposalCard` in `chat-messages.tsx`.

**Acceptance**
- [ ] Pro with review on: "use the Midnight theme" produces a proposal and no new version. The preview stays unchanged until you accept.
- [ ] Accepting all creates a version, the preview updates and Versions shows it. Partial acceptance (uncheck `README.md`) keeps README unchanged in the new version.
- [ ] Discard changes nothing. A stale proposal fails gracefully.
- [ ] In Simple mode, the same project applies changes directly.

---

## 3.2 Error banner, Fix it and issues

**Idea:** some changes "break" something in a deterministic way, so the Fix it flow is visible. The bug is real in the generated code, so the fix shows up as a real diff.

**Simulation** (`src/lib/sim/issues.ts`, pure)
```ts
type Issue = {
  id: string; pageId: string; severity: "error" | "warning";
  plain: string;          // Simple: "The Reports page can't load its data yet."
  title: string;          // Pro: "TypeError: Cannot read properties of undefined (reading 'map')"
  file: string; line: number; stack: string[];
  fix: string;            // "Guarded the empty list and added a loading state"
};
```
- `maybeIssue(plan, change, seed)`: returns an issue for roughly **1 in 3** edits that add a page or a field, chosen deterministically from `hashString(seed)`. It returns nothing for theme, banner or rename edits. Also expose a debug trigger: a chat message containing "break it" always creates an issue. This is useful for QA and for demos, but don't advertise it in the UI.
- Add `issues?: Issue[]` to `Plan`, so versions snapshot them.
- `codegen.ts`: for a page with an open issue, emit the buggy line at `issue.line`. For example, `const rows = data.items.map(...)` without a guard in that page component. Fixing the issue removes it and adds the guard. The diff should read like a real fix.
- `fixIssue(plan, issueId)`: removes the issue and adds a note.

**Preview**
- `PreviewApp` renders a page that has an issue as the app's own crash state: an in-theme card saying "Something went wrong on this page" with a "Details" disclosure that shows `issue.title`. It posts `architect:error { issueId, pageId }` to the Workspace.

**Workspace**
- An issue banner above the iframe in the Preview tab:
  - **Simple:** warning-soft background, the plain sentence and one **Fix it** button.
  - **Pro:** destructive-soft background, a monospace `title`, a `file:line` link (opens the Code tab scrolled to that line; add a `line` prop to `code-editor.tsx` using `EditorView.scrollIntoView` plus a line highlight), a collapsible stack and **Fix it**.
- The first time an issue appears after an edit, the edit card shows a small warning row: "This change broke the Reports page. Fix it?"
- **Fix it** calls `fixIssue(projectId, issueId)` (a server action). The chat shows thinking ("Reading the error" → "Fixing src/pages/Reports.tsx" → "Checking the preview"), then a new version "Fixed: {plain}" and an edit card with the file diff (commit type `fix`). The preview reloads on the same page.

**Acceptance**
- [ ] "add a reports page" or "add a priority field" eventually produces an issue (and "break it" always does). The page crashes in the preview and the banner appears.
- [ ] In Simple mode the plain sentence shows. In Pro, the stack and file link show, and the link opens the right line.
- [ ] Fix it creates a version whose diff removes the bug. The banner disappears.

---

## 3.3 Visual edit (click to edit)

**UX**
- A **Select** toggle in the Preview toolbar (`MousePointerClick` icon, shortcut `V` while the preview is focused), in both modes.
- In select mode, hovering editable elements inside the app draws a dashed accent outline with a tiny kind label ("Heading", "Button", "Nav item"). Clicking selects the element (solid outline) and blocks its normal action.
- A **Visual edit panel** floats over the right side of the preview (about 300 px wide). It shows:
  - the element kind and the page;
  - **Text** (an input, for text elements);
  - **Emphasis** chips (Default · Accent · Muted);
  - **Size** chips (S · M · L), for headings and buttons;
  - a prompt field, "Or describe a change to this element…";
  - **Apply** and **Cancel**.
- `Esc` exits select mode. Applying creates a version and an edit card ("Visual edit: renamed Queue to Inbox"). The preview reloads and stays on the page.

**Protocol** (add to the table in 00-context §8)
- Workspace → app: `architect:select-mode { on: boolean }`.
- App → Workspace: `architect:selected { target: { editId, kind, pageId, text } }` and `architect:select-cancel`.

**Renderer changes** (`components/preview/*`)
- Add `data-edit="<editId>"` to editable elements:
  - `app-name`
  - `nav-<pageId>`
  - `title-<pageId>`
  - `purpose-<pageId>`
  - `cta-<pageId>` (run button, "New X" button)
  - `stat-<pageId>-<n>`
  - `banner`
  - `card-<pageId>-<n>` (card headings)
- In select mode, render the overlay behaviour inside the app. Use a capture-phase click listener that `preventDefault`s and posts the selection.
- Read overrides from the plan: `plan.ui.labels?: Record<editId, string>` and `plan.ui.styles?: Record<editId, { tone?: "accent"|"muted"; size?: "s"|"m"|"l" }>`.

**Server** (`applyVisualEdit(projectId, target, change)`)
- Map text changes to real plan fields where they exist:
  - `app-name` → `appName`
  - `nav-*` / `title-*` → `page.name`
  - `purpose-*` → `page.purpose`
  - `cta-*` → `page.input.cta`
  - `banner` → `ui.banner`
  - anything else → `ui.labels[editId]`
- Styles go to `ui.styles[editId]`.
- The prompt falls back to `applyEdit(plan, prompt)`, plus element-aware shortcuts: "bigger" means size L, "highlight" or "make it stand out" means tone accent, "hide" means label "".
- `codegen.ts`: text changes already flow into the code. Also emit `ui.styles` as CSS rules in `theme.css` (for example `[data-edit="title-queue"] { color: var(--accent); font-size: 2rem; }`), and add `data-edit` attributes to the generated JSX for the headings it emits.

**Acceptance**
- [ ] Rename a nav item: the sidebar, the page title, the Plan tab and the generated code all change, and a new version is created.
- [ ] Make a heading Accent + L: the preview shows it and `theme.css` contains the rule.
- [ ] Select mode never triggers the app's own actions, and `Esc` leaves it.

---

## 3.4 Bottom drawer: Terminal, Logs and Problems (Pro only)

**UX**
- A toggle in the stage toolbar (`PanelBottom` icon) and **⌘J**. It's resizable (160–480 px, remembered in `localStorage`) and has three tabs, Terminal · Logs · Problems, with an issue count badge on Problems. Hidden in Simple mode.

**Terminal** (`src/lib/sim/terminal.ts`: a pure interpreter over `{ files, plan, versions, projectName }` → `{ output: Line[], cwd }`)
- Prompt: `~/<slug> (main) $`.
- Commands:

  | Command | Output |
  | --- | --- |
  | `help` | Lists these commands |
  | `ls [dir]`, `tree`, `pwd`, `cat <file>` | Answers from the current version's files |
  | `clear` | Clears the terminal |
  | `echo …` | Echoes its arguments |
  | `whoami` | The workspace name |
  | `git status` | "nothing to commit, working tree clean" until M5 |
  | `git log --oneline` | Versions as commits, with the short SHA = `hashString(version.id).toString(16).slice(0,7)` |
  | `npm install` | "added 214 packages in 3s" |
  | `npm run dev` | A Vite banner: "VITE v7 ready in 312 ms", "➜ Local: http://localhost:5173/" |
  | `npm run build` | Per-file sizes computed from the file lengths |
  | `npm test` | N passing, N = pages × 3. Fails naming the file if an issue is open. |
  | `architect deploy` | "Use the Deploy button, or run this again after the Ship milestone" (update in M6) |
  | anything else | `zsh: command not found: <cmd>` |

- ↑/↓ history. Tab completes commands and file paths. Output streams line by line (about 15 ms per line) for commands that "run".

**Logs**
- Runtime log lines from the preview. The app posts `architect:log { level, message }` when agents run or pages load, for example:
  - `GET /queue 200 · 38ms`
  - `POST /api/agents/triage/run 200 · 842ms · 1,240 tokens`
  - `WARN escalation: confidence 0.58 < 0.6, routed to #support-leads`
- The latest build's log, generated from the build summary.
- Level filter (All/Info/Warn/Error), Clear, and "Follow" (autoscroll).

**Problems**
- Open issues from 3.2: severity icon, plain title, `file:line` (clicking opens the Code tab at that line) and Fix it. Empty state: "No problems. Nice."

**Acceptance**
- [ ] `cat src/App.tsx` prints the real file. `npm test` fails while an issue is open and passes after Fix it.
- [ ] Clicking around the preview (running an agent, navigating) produces log lines.
- [ ] ⌘J toggles the drawer. It never shows in Simple mode.

---

## 3.5 Command palette (⌘K), everywhere

**UX**
- **⌘K / Ctrl+K** opens it on every signed-in page and in the Workspace. The shadcn `command.tsx` (cmdk) is already installed; check whether it exports `CommandDialog`.
- The rail gets a search button above the nav: "Search… ⌘K" (collapsed rail: icon with tooltip). The Workspace top bar gets a small ⌘K icon button.
- Groups, in this order:
  1. **Suggestions**, depending on context: in a project with no build, "Build this"; with an open issue, "Fix it"; otherwise "New project".
  2. **Navigate:** Home, Projects, Agents, Explore, Integrations, Usage, Settings.
  3. **Projects:** the 8 most recent. Typing filters all projects.
  4. **Create:** New project, Start from a template, Ask the Consultant (opens the dialog; it needs a query-param hook such as `/home?consultant=1`).
  5. **Workspace** (on `/p/[id]` only):
     - Go to a stage tab
     - Toggle chat (⌘\)
     - Toggle drawer (⌘J, Pro only)
     - Undo last change
     - Restore a version…
     - Open file… (Pro): a nested page with a fuzzy list of files that opens the Code tab
     - Switch to Plan / Build mode
  6. **Preferences:** Switch to Simple/Pro, Theme: Light/Dark/System.
  7. **Account:** Sign out.
- Show shortcut hints with the `Kbd` component. `?` opens a **Keyboard shortcuts** dialog listing every shortcut.

**Implementation**
- `src/components/command/command-palette.tsx`, plus a small context `CommandProvider` with `useRegisterCommands(group, items)` so the Workspace can register its actions while it's mounted.
- Mount the provider in `app/layout.tsx` (it's client-only, so wrap it) or in both `(app)/layout.tsx` and `p/[id]`. Projects data: pass recent projects from the server layout (AppShell already receives `recent`). The Workspace passes its own.

**Acceptance**
- [ ] ⌘K works on Home, Projects and the Workspace. Typing a project name opens it. Theme and mode switches work.
- [ ] In the Workspace, "Open file…" (Pro) jumps to the file. "Undo last change" restores the previous version.

---

## 3.6 Pro composer: /commands, @file mentions, model

**Slash commands** (the chat composer, both modes; the list highlights Pro-only entries)
- Typing `/` at the start opens a menu (cmdk-style popover above the composer):

  | Command | Effect |
  | --- | --- |
  | `/plan`, `/build` | Switch the chat mode |
  | `/undo` | Restore the previous version |
  | `/theme <name>` | Sends "use the <name> theme" |
  | `/page <name>` | Sends "add a <name> page" |
  | `/agent <name>` | Sends "add a <name> agent" |
  | `/field <name>` | Sends "add a <name> field" |
  | `/fix` | Fixes the first open issue |
  | `/test` | Runs the testing agent once (3.7) |
  | `/deploy` | Opens Deploy (M6; until then, a hint) |
  | `/help` | Lists everything |

**@ mentions** (Pro)
- `@` opens a file picker over the current version's files and inserts `@src/pages/Queue.tsx`.
- Server side: when a Build-mode message mentions a page file, `applyEdit` treats that page as the target. "@src/pages/Queue.tsx add a priority field" adds the field to that page's collection, and `focusPage` becomes that page. Mentioned files are listed on the user bubble as chips.

**Model chip** (Pro)
- Shows the project's model (Claude Opus 5 / Claude Sonnet 5, from `MODELS`). Changing it updates `settings.model`, and the simulated credits change: Sonnet costs 0.4× in `recordUsage` and the estimate. Display only; nothing calls a model.

---

## 3.7 Testing agent (P2)

- A **Test** toggle in the composer: "Test after each change: a testing agent checks the app in a browser and fixes what it finds. Adds a few seconds."
- Stored in `settings.testAfterChanges`. Default: **on in Simple, off in Pro** (Pro users see issues surface and can use the drawer).
- When on, build-mode edits add thinking steps ("Opening the app in a browser" → "Clicking through 5 pages"). If `maybeIssue` would have created an issue, it's caught and fixed inside the same change: the edit card gets a success row, "Caught and fixed: {plain}. {fix}.", and no banner appears.
- `/test` runs a one-off check that either reports "12 checks passed" or finds and fixes something scripted.

---

## 3.8 Pro depth on the build card

- In `chat-messages.tsx`, give `BuildDone` a Pro-only **"Show steps"** disclosure that lists each step with its detail: which files the agents step wrote (`agents/*.yaml`), which data files, the UI files with line counts, and the checks the test step ran. Keep Simple exactly as it is.
- The live build card in Pro should also let each finished step expand to its files (the UI step already lists files).

---

## Files you'll probably touch or create

- `src/lib/sim/`: `issues.ts`, `terminal.ts`, `commit.ts` (new); `types.ts` (Plan.issues, ui.labels, ui.styles); `codegen.ts` (buggy/guarded lines, style rules, data-edit attrs); `edit.ts` (element-aware edits, @file targeting)
- `src/lib/actions/build.ts`: acceptProposal, discardProposal, fixIssue, applyVisualEdit, setProjectSettings; `sendMessage` review mode and options
- `src/db/schema.ts`: extend the `MessageKind` and `ProjectSettings` types (JSON only, no migration needed)
- `src/components/workspace/`: `review-panel.tsx`, `visual-edit-panel.tsx`, `bottom-drawer.tsx` (+ `terminal-view.tsx`, `logs-view.tsx`, `problems-view.tsx`), updates to `workspace.tsx`, `use-workspace.ts`, `chat-composer.tsx`, `chat-messages.tsx`, `stage-preview.tsx`, `code-editor.tsx` (line prop)
- `src/components/preview/`: data-edit attributes, select mode, error state, log messages, label/style overrides
- `src/components/command/`: palette and provider, a shortcuts dialog; `components/shell/app-shell.tsx` search button

## QA checklist for this milestone

Use the harness in 00-context §12. Suggested script beats:
1. Pro user → built project → toggle Review → "use the Midnight theme" → proposal card → Review tab → uncheck README → Accept → the version exists and README is unchanged.
2. "break it" → crash state in the app + banner (check Simple and Pro) → Pro file link opens the Code tab at the line → Fix it → a new version whose diff removes the bug.
3. Select mode → click the "Queue" nav item → rename to "Inbox" → Apply → nav/title/plan/code updated.
4. ⌘J → Terminal: `ls`, `cat src/App.tsx`, `npm test` (fails with an issue, passes after the fix), history ↑ → Logs show agent runs after using the app → Problems lists issues.
5. ⌘K from Home → type a project name → Enter opens it. In the Workspace: "Open file…" and "Undo last change".
6. `/theme bold` and `@src/pages/…` in the composer.
7. Light, dark and 390 px screenshots of: proposal card and Review tab, issue banner (both modes), visual edit panel, drawer, ⌘K. Look at every one.
8. Regression of the M1/M2 flows. Zero console errors. No hydration errors in the dev log.
