# Submission note

Paste into the hiring page's Submit tab, alongside the live URL and the repo URL.

---

**Architect 2.0 — one project, two depths**

Architect 2.0 is one workspace that takes an agentic app from a sentence to a live URL. The bet is that
non-technical builders and developers want the same product at different depths, not two products: a builder
never has to see code, and a developer can open files, diffs, a terminal and Git in the same project without
switching tools. The Simple/Pro toggle in the Workspace top bar is that idea in one control — same project, same
events, told two ways.

**What to try (about two minutes).** Sign in with GitHub (simulated, no account needed) → describe an app on Home
→ watch the build timeline → ask for a change in plain English → press **Deploy** and open the public URL. The
README has a fuller tour.

**What's real.** The database and everything in it (workspaces, projects, versions, messages), the generated code
and its diffs, version restore, the public `/live/<slug>` URL and rollback, the standalone agent endpoint and its
embeddable widget, and AES-256-GCM encryption of imported environment values.

**What's simulated, and why.** Sign-in, AI planning and code generation, GitHub, integrations and the hosting side
of a deploy are all simulated. That was a deliberate constraint: no API keys and nothing that can cost money, so
the whole thing runs on free tiers and a reviewer can click every flow without a card. The simulations are
built to behave like the real thing — streaming progress, realistic output, and failure states, not just happy
paths. A deploy is the interesting case: no hosting provider is called, but the URL it produces is genuinely
public and serves the frozen version, so the payoff is real even though the plumbing is not.

**What I left out.** Custom domains, env var editing, billing, the SQL console, preview comments, the marketplace
and the local CLI are out of scope, and the UI says so where you'd look for them rather than hiding it. I'd
rather ship a complete journey with honest edges than a wider surface with dead ends.
