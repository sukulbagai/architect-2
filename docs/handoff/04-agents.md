# Milestone 4: Agents

> Read `docs/handoff/00-context.md` first. Everything here is simulated: no model calls, no real OAuth, no API keys. Agents answer with scripted samples and realistic traces.

**Goal:** agents are the heart of an *agentic* app builder. A builder should be able to shape what each agent does in plain English. A developer should be able to pick the framework per agent, read the generated agent code, test an agent on its own with a trace, and ship an agent without an app around it (API plus embeddable widget).

**Spec references:** `docs/spec.md` → Core flows §6 "Agents", IA (`/agents`, `/integrations`), Simple vs Pro table ("Agents" row). Feature-matrix rows:

| Feature | Priority | Build |
| --- | --- | --- |
| Agents panel, detail and framework picker | P0 | Partly real: config saved and code generated per framework; nothing runs on those frameworks |
| Agent test console with trace | P1 | Dummy |
| Integrations and MCP catalog | P1 | Dummy |
| Knowledge files | P1 | Dummy (upload list only) |
| Standalone agent with API and widget | P2 | Dummy (the endpoint and widget do respond, with scripted output) |
| Agent flow diagram | P1 | Real (upgrade from the M2 row to a proper graph) |

Suggested order: 4.1 data model → 4.2 editor → 4.3 codegen → 4.5 test console → 4.4 flow → 4.7 integrations → 4.8 knowledge → 4.6 library, standalone agents and runtime.

---

## 4.1 Data model

- **Extend `PlanAgent`** in `src/lib/sim/types.ts` (these live in the plan JSON, so no migration):
  ```ts
  memory?: { mode: "off" | "conversation" | "long-term"; window?: number };
  guardrails?: string[];            // ids from a fixed list (see 4.2)
  handoffs?: string[];              // agent ids this agent can hand work to
  knowledge?: { name: string; size: number; chunks: number }[];
  tests?: { id: string; input: string; expect: string }[];
  ```
  Update `catalog.ts` blueprints with sensible defaults. For example, the support-desk Triage agent hands off to the Answer drafter and Escalation.
- **Migration** (`pnpm db:generate --name agents_connections`):
  - `agents`: add `published boolean default false`, `api_key_hash text`, `api_key_prefix text`, `widget jsonb` (`{ color, greeting, position }`), `config jsonb` (memory, guardrails, handoffs, tests, samples, trace). The table already has name, role, framework, model, instructions, tools, knowledge.
  - New `connections` table: `id, workspace_id → workspaces (cascade), integration_id text, kind text ('oauth'|'mcp'), label text, config jsonb (scopes, url, tools[], header_hint), created_at`, with a unique index on (workspace_id, integration_id) for OAuth.

---

## 4.2 Agent editor (Workspace → Agents tab)

Replace the read-only cards in `stage-panels.tsx` → `AgentsPanel`.

**Layout:** a list on the left (agent avatar, name, role, framework chip, and a warning dot if a tool isn't connected) and the detail on the right, with **List | Flow** toggles at the top (4.4). On mobile, the list navigates to the detail.

**Detail sections, in order:**
1. **Header:** editable name and role. **Test** opens the console (4.5).
2. **What it does** (Simple label) / **Instructions** (Pro label): a textarea. Simple shows plain-English guidance ("Describe the job like you would to a new teammate"). Pro shows it as the system prompt, with a token count estimate (length/4).
3. **Model:** a select from `MODELS` (Claude Opus 5 / Sonnet 5). Credits in the estimate change.
4. **Framework** (Pro; Simple shows a "Runs on Lyzr" chip with a "Change" link that reveals it):
   - Lyzr (hosted, default)
   - LangGraph
   - CrewAI
   - OpenAI Agents SDK
   - Claude Agent SDK
   - Google ADK
   - Mastra
   - GitAgent

   Each option has a one-line description and a language chip (Python/TypeScript/Files). Switching framework shows the generated code (4.3) right below, in read-only CodeMirror, with "Open in Code tab".
5. **Tools:**
   - A list of switches: built-ins (Web search, Knowledge base, Code interpreter) plus the workspace's connections (4.7), each marked connected ✓ or "Connect" (which opens the connect dialog without leaving).
   - "Add MCP server" (4.7).
   - Pro shows each tool's id.
6. **Knowledge:** the file list (4.8).
7. **Memory:** Off / Remembers this conversation (window N) / Long-term memory.
8. **Guardrails:** checkboxes:
   - "Ask before sending anything outside the app"
   - "Cite sources for facts"
   - "Redact personal data in logs"
   - "Stop if a run would cost more than 5 credits"
   - "Hand off to a person when unsure (confidence < 0.6)"
9. **Hands off to:** multi-select of the other agents.

**Saving:** dirty state shows a sticky bar, "Unsaved changes · Save" (Save is the brand button on this screen). Saving calls `saveAgent(projectId, agent)`, which updates `plan.agents`, regenerates the files and creates a version ("Updated Triage agent") with an edit card in chat. Add a "Discard" option.

Remove the placeholder footer ("…arrive with the Agents milestone") and the Plan panel hint ("Framework per agent arrives…"). The plan's agent rows should now show the framework chip and link to the agent in the Agents tab (`ws.setTab("agents")` + selected agent id).

---

## 4.3 Per-framework code generation (`src/lib/sim/codegen.ts`)

Add `agentFiles(agent, plan): Record<path, string>` and use it instead of the single YAML. Every file starts with a header comment: `// Generated by Architect · <Framework> · edit freely`. **Don't add any of these SDKs to Architect's own package.json.** They appear only in the *generated* project's `package.json` / `requirements.txt`.

| Framework | Files | Must contain (illustrative, plausible code) |
| --- | --- | --- |
| Lyzr | `agents/<id>.yaml` | The current YAML plus memory, guardrails and handoffs |
| LangGraph (Python) | `agents/<id>.py`, add `langgraph` + `langchain-anthropic` to requirements | `from langgraph.graph import StateGraph, END`; a TypedDict state; one node per tool; `graph.compile()` |
| CrewAI (Python) | `agents/<id>.py`, `crewai` | `from crewai import Agent, Task, Crew`; role/goal/backstory from the plan |
| OpenAI Agents SDK (TS) | `agents/<id>.ts`, `@openai/agents` | `import { Agent, run } from "@openai/agents"`; `new Agent({ name, instructions, tools })` |
| Claude Agent SDK (TS) | `agents/<id>.ts`, `@anthropic-ai/claude-agent-sdk` | `import { query } from "@anthropic-ai/claude-agent-sdk"`; a `run(input)` wrapper streaming messages |
| Google ADK (Python) | `agents/<id>/agent.py`, `google-adk` | `from google.adk.agents import Agent`; `root_agent = Agent(...)` |
| Mastra (TS) | `src/mastra/agents/<id>.ts`, `@mastra/core` | `import { Agent } from "@mastra/core/agent"` |
| GitAgent | `agents/<id>/SOUL.md`, `RULES.md`, `DUTIES.md`, `agent.yaml`, `skills/<skill>.md`, `memory/.gitkeep`, `knowledge/README.md` | Follows Architect's GitAgent layout (see the spec's research table) |

These imports are our best knowledge of each SDK as of mid-2026. If you have web access, sanity-check the names. If you don't, keep them; they're illustrative generated code that never runs here.

Also update `lib/agents.ts` / `agent-runtime` in the generated project so the runtime adapter mentions the chosen frameworks. Make sure `fileChanges` produces a readable diff when you switch frameworks (the old files are deleted and the new ones added).

---

## 4.4 Agent flow view

- Install `@xyflow/react` (MIT, runs locally). It's already named in the spec's stack table.
- The Agents tab **Flow** view is a read-only graph with auto-layout in columns and no extra layout dependency:
  - **Column 1:** triggers (pages that use agents, e.g. "Queue page", "New brief form").
  - **Column 2+:** agents, ordered by handoffs, each node showing name, framework badge and model.
  - **Tools:** small pill nodes attached below each agent.
  - **Last column:** outputs (integrations such as Slack or HubSpot, and "Saved to <collection>").
  - **Edges:** page→agent (`page.agent`), agent→agent (`handoffs`, animated dashed), agent→tool (thin), agent→output.
- Controls: zoom, fit view. No minimap. Clicking an agent node selects it in the list.
- Theme it with Architect tokens (card background, border-strong edges, brand for agent handoff edges), and make sure dark mode looks right.
- Optionally reuse the same component, smaller, in the Plan panel's section 4 (replacing the static row).

---

## 4.5 Test console

- Opened from the agent header's **Test** button, as a right-side sheet over the Agents tab or as a tab inside the detail.
- A chat with the one agent:
  - The greeting is the agent's role.
  - Replies cycle through `agent.samples`, typed out (reuse `useTyping` from `preview/bits.tsx` or make a shared hook).
  - Before each reply, a trace streams in (deterministic from `seededRandom(agentId + turn)`):
    - Received input · 0 ms
    - Tool call: `<tool>` · 412 ms (one per enabled tool)
    - Retrieved 4 passages (if Knowledge base is on)
    - Generated answer · 1,284 ms · 1,920 in / 310 out tokens
    - Guardrails passed (or "Handed off to Escalation" when a guardrail triggers on words like "refund" or "legal")
  - Totals: latency, tokens and credits. Pro can switch the trace to raw JSON.
- **Save as test case** stores `{input, expect}` (expect defaults to a key phrase from the reply) in `agent.tests`. **Run all tests** runs them with progress and shows pass/fail per case: pass unless the agent's instructions were changed to drop a keyword the test expects. Give it that one rule, deterministic and explainable.
- The same console component is reused on standalone agent pages (4.6).

---

## 4.6 Agents library, standalone agents and runtime

**`/agents` page** (replaces the empty state)
- The header has a **New agent** button (the brand button).
- **Standalone agents:** cards from the `agents` table (`projectId = null`), showing name, role, framework, a published state and a runs count (simulated).
- **In your apps:** agents taken from each project's current plan, grouped by project, each linking to `/p/<id>?tab=agents&agent=<agentId>`. **Add support for those query params in the Workspace** (initial tab and selected agent).
- An empty state for each group.

**`/agents/new` wizard**
1. "What should this agent do?", with a textarea and example chips (e.g. "Answer questions about our pricing from our docs", "Triage GitHub issues and label them").
2. Drafting (simulated about 1.2 s): name, role, instructions and suggested tools (keyword-based), all editable.
3. Framework and model.
4. Create → `/agents/[id]`.

**`/agents/[id]`** has four tabs:
- **Configure:** the same editor component as 4.2, saving to the `agents` table.
- **Test:** the 4.5 console.
- **Deploy:**
  - A **Publish** switch.
  - **API:** endpoint `POST {origin}/api/v1/agents/{id}/run`. **Create API key** shows `ak_live_…` exactly once, with copy. Store only a sha256 hash plus a prefix, and let the user revoke it. Snippets for curl, JavaScript (fetch) and Python (requests).
  - **Widget:** colour, greeting and position settings, a live preview of the widget, and an embed snippet (`<iframe src="{origin}/embed/agent/{id}" …>`).
- **Usage:** simulated runs per day (last 14 days), average latency and tokens.

**Runtime routes** (real HTTP, scripted output, no model calls)
- `POST /api/agents/[projectId]/[agentId]/run`: requires the workspace cookie and ownership. Returns `{ output, trace, usage }` from the samples, deterministically. The test console and (optionally) the generated preview use it.
- `POST /api/v1/agents/[agentId]/run`: public, requires `Authorization: Bearer <key>` (compared by hash) and `published = true`. Returns 401/404 JSON errors with clear messages.
- `/embed/agent/[id]`: a public page rendering the chat widget (only when published). **Add neither `/embed/*` nor `/api/v1/*` to the proxy matcher**; they must stay public.

---

## 4.7 Integrations catalog and MCP servers (simulated connections)

**Integrations page** (`/integrations`, `components/settings/integration-grid.tsx`)
- A **Connected** section at the top (cards showing account label, date and a Disconnect button with a confirm dialog), then the catalog by category as now.
- **Connect** opens a dialog playing a simulated OAuth consent:
  1. "Architect wants to access your {Service} account", with the account shown as the workspace email and a scopes list per integration (e.g. Slack: "Post messages", "Read channels you choose"). Put the scopes in `lib/integrations.ts`.
  2. **Allow** shows "Connecting…" (about 900 ms), then "Connected".
  3. Save a `connections` row.
- Include a failure path: a "Deny" button on the consent screen shows an inline "Connection cancelled".
- **GitHub stays a placeholder until M5.** Leave the GitHub card's button as "Connect in the GitHub milestone" only if M5 isn't done yet.
- **Add MCP server** (the Custom category) opens a dialog: name, URL (must be https), optional auth header (masked input, with a note that it's stored for this demo). **Connect** shows "Discovering tools…" and then lists the scripted tools by host:
  - `deepwiki` → read_wiki_structure, read_wiki_contents, ask_question
  - `parallel` → web_search, extract
  - `linear` → list_issues, create_issue, update_issue
  - anything else → search, fetch, list_resources

  Save the connection. MCP servers show as "MCP · N tools".
- Connected integrations and MCP tools become selectable in the agent editor (4.2).
- **Home composer "+ → Add existing agents":** enable it. A submenu lists standalone agents; selected ones show as chips, get stored in `settings.attachedAgents`, and `buildPlan` appends them to the plan's agents.

---

## 4.8 Knowledge files

- Agent editor → Knowledge: a drop zone and "Add files" (pdf, docx, txt, md, csv, xlsx). Store names and sizes only; never file contents.
- Each file shows **Indexing…** (a small progress bar, about 1.5 s, deterministic) and then **Ready · N chunks** (N = max(1, round(size / 2 KB))). Allow Remove.
- Simple copy: "Files this agent can read". Pro copy: "Knowledge base · N chunks · embeddings: simulated".
- Attachments from the Home composer already land on the first agent via `buildPlan`; show them here too.

---

## Placeholders to remove (from 00-context §3)

- Integrations Connect/Add toasts (all except GitHub, if M5 isn't done yet)
- The composer's disabled "Add existing agents"
- AgentsPanel footer note, and the Plan panel "Framework per agent…" hint
- The `/agents` empty state (keep a real empty state for when there are genuinely no agents)

## QA checklist

1. Built support-desk project → Agents tab → select Triage → change the instructions, turn on Web search, set Memory to "conversation", enable "Cite sources" → Save → a version appears and `agents/triage.yaml` contains the changes.
2. Pro → switch Answer drafter to LangGraph → a Python file appears in the Code tab. The version diff deletes the YAML and adds the `.py`.
3. Flow view renders page → agent → handoff → tool → output. Light and dark screenshots.
4. Test console: three messages, traces stream, "refund" triggers a handoff trace. Save as test case → Run all → pass. Then edit the instructions to break it → fail.
5. Integrations → Connect Slack (Allow) → connected card appears. Connect Notion → Deny → "Connection cancelled". Add MCP server `https://mcp.deepwiki.com/mcp` → 3 tools. In the agent editor, the Slack tool shows as connected.
6. `/agents/new` → create "Pricing FAQ" → Deploy → Publish → Create API key → `curl -X POST -H "Authorization: Bearer <key>" -d '{"input":"hi"}' localhost:3100/api/v1/agents/<id>/run` returns JSON. A wrong key returns 401. Open `/embed/agent/<id>` in a **signed-out** browser context and it works.
7. Home composer → "+" → Add existing agents → pick "Pricing FAQ" → create project → the plan includes that agent.
8. Mobile and dark screenshots of the editor, flow and test console. Zero console errors. Regression of M1–M3.
