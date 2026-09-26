import { hashString } from "../seeded";

/**
 * A simulated GitHub. Nothing here talks to GitHub: the account, its repositories, commits,
 * branches, pushes, pulls and pull requests are all derived deterministically, so the same
 * workspace always sees the same repos and every version has the same commit sha.
 *
 * Commits are versions. A branch is an ordered list of version ids; "pushed" says how many of them
 * are on the (simulated) remote. Everything else, like "2 to push", is derived from that.
 */

// ---------------------------------------------------------------------------------------------
// The account
// ---------------------------------------------------------------------------------------------

/** "Alex Rivera" → "alex-rivera". The simulated GitHub login for a workspace. */
export function githubLoginFor(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 39) || "architect-user"
  );
}

export const GITHUB_SCOPES = ["Read and write code in repositories you choose", "Create repositories", "Read your profile"];

/** Every version's commit sha: 7 hex characters derived from its id. */
export function commitSha(versionId: string) {
  return hashString(versionId).toString(16).padStart(7, "0").slice(0, 7);
}

// ---------------------------------------------------------------------------------------------
// Repositories and what a scan finds in them
// ---------------------------------------------------------------------------------------------

export type RepoStack = "react-vite" | "nextjs" | "fastapi-react";

export type RepoAgent = { name: string; library: string; framework: string; path: string };

/** What Architect finds when it scans a repository. */
export type RepoProfile = {
  framework: string;
  language: string;
  files: number;
  packageManager: string;
  /** Libraries worth calling out: "Tailwind", "Prisma", "Supabase client". */
  uses: string[];
  routes: string[];
  models: string[];
  envVars: string[];
  agents: RepoAgent[];
  previewable: boolean;
  importable: boolean;
  /** Why it can't be imported or previewed, in one sentence. */
  reason?: string;
  notes: string[];
  /** The Architect stack its generated layer uses. */
  stack: RepoStack;
  /** The manifest the scan reads first. */
  manifest: string;
};

export type Repo = {
  name: string;
  fullName: string;
  private: boolean;
  language: string;
  framework: string;
  description: string;
  /** Hours since the last push, so "updated 3 days ago" renders the same everywhere. */
  updatedHoursAgo: number;
  stars: number;
  defaultBranch: string;
  branches: string[];
  /** The first pull request number a new one gets (existing repos have history). */
  nextPr: number;
  profile: RepoProfile;
};

/** Language dots, like GitHub's. Data colours, not Architect UI colours. */
export const LANGUAGE_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  "Jupyter Notebook": "#da5b0b",
  Astro: "#ff5a03",
  MDX: "#fcb32c",
};

const CODE_ONLY = "Previews need a server sandbox, which isn't available in this demo. You can still edit, version and push it.";

type Shape = Omit<Repo, "fullName">;

const SHAPES: Shape[] = [
  {
    name: "support-bot",
    private: true,
    language: "TypeScript",
    framework: "Next.js 14",
    description: "Customer support inbox with an AI agent that drafts replies from our help docs.",
    updatedHoursAgo: 5,
    stars: 3,
    defaultBranch: "main",
    branches: ["main", "develop", "feature/sla-timers"],
    nextPr: 12,
    profile: {
      framework: "Next.js 14",
      language: "TypeScript",
      files: 42,
      packageManager: "pnpm",
      uses: ["Prisma", "NextAuth", "LangChain"],
      routes: ["/", "/inbox", "/tickets/[id]", "/customers", "/chat", "/settings"],
      models: ["Ticket", "Customer", "Message"],
      envVars: ["DATABASE_URL", "OPENAI_API_KEY", "NEXTAUTH_SECRET"],
      agents: [{ name: "Support agent", library: "LangChain", framework: "langgraph", path: "lib/agent.ts" }],
      previewable: true,
      importable: true,
      notes: ["The LangChain agent becomes a LangGraph agent you can edit in the Agents tab.", "The preview uses sample tickets instead of your database."],
      stack: "nextjs",
      manifest: "package.json",
    },
  },
  {
    name: "marketing-site",
    private: false,
    language: "TypeScript",
    framework: "Next.js 15",
    description: "Our public website: landing page, pricing, blog and customer stories.",
    updatedHoursAgo: 26,
    stars: 18,
    defaultBranch: "main",
    branches: ["main", "redesign", "blog-mdx"],
    nextPr: 47,
    profile: {
      framework: "Next.js 15",
      language: "TypeScript",
      files: 58,
      packageManager: "pnpm",
      uses: ["Tailwind", "MDX", "PostHog"],
      routes: ["/", "/pricing", "/blog", "/blog/[slug]", "/customers", "/contact"],
      models: ["Post", "Story", "Lead"],
      envVars: ["NEXT_PUBLIC_POSTHOG_KEY"],
      agents: [],
      previewable: true,
      importable: true,
      notes: ["Blog posts are MDX files; the preview lists them as rows you can edit."],
      stack: "nextjs",
      manifest: "package.json",
    },
  },
  {
    name: "crm-lovable-export",
    private: true,
    language: "TypeScript",
    framework: "Vite + React",
    description: "Exported from Lovable. A small CRM for contacts, companies and deals.",
    updatedHoursAgo: 72,
    stars: 0,
    defaultBranch: "main",
    branches: ["main"],
    nextPr: 3,
    profile: {
      framework: "Vite + React",
      language: "TypeScript",
      files: 74,
      packageManager: "npm",
      uses: ["Supabase client", "Tailwind", "shadcn/ui"],
      routes: ["/", "/contacts", "/companies", "/deals", "/settings"],
      models: ["Contact", "Company", "Deal"],
      envVars: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      agents: [],
      previewable: true,
      importable: true,
      notes: ["Exported from Lovable: the Supabase calls stay in your code, and the preview uses sample data."],
      stack: "react-vite",
      manifest: "package.json",
    },
  },
  {
    name: "invoice-api",
    private: true,
    language: "Python",
    framework: "FastAPI",
    description: "Invoicing API with Stripe payments. Python only, no frontend.",
    updatedHoursAgo: 120,
    stars: 2,
    defaultBranch: "main",
    branches: ["main", "stripe-webhooks"],
    nextPr: 9,
    profile: {
      framework: "FastAPI",
      language: "Python",
      files: 31,
      packageManager: "pip",
      uses: ["SQLAlchemy", "Alembic", "Stripe"],
      routes: ["/invoices", "/invoices/{id}", "/clients", "/payments", "/health"],
      models: ["Invoice", "Client", "Payment"],
      envVars: ["DATABASE_URL", "STRIPE_SECRET_KEY"],
      agents: [],
      previewable: false,
      importable: true,
      reason: CODE_ONLY,
      notes: ["A Python API with no screens, so there's nothing to preview in the browser.", "Architect adds a React front end you can build on."],
      stack: "fastapi-react",
      manifest: "requirements.txt",
    },
  },
  {
    name: "agent-playground",
    private: false,
    language: "TypeScript",
    framework: "Mastra",
    description: "Research and writing agents built with Mastra, plus a small run viewer.",
    updatedHoursAgo: 9,
    stars: 41,
    defaultBranch: "main",
    branches: ["main", "mastra-0.20"],
    nextPr: 23,
    profile: {
      framework: "Mastra",
      language: "TypeScript",
      files: 28,
      packageManager: "pnpm",
      uses: ["Hono", "Zod"],
      routes: ["/", "/agents", "/runs"],
      models: ["Run"],
      envVars: ["ANTHROPIC_API_KEY"],
      agents: [
        { name: "Researcher", library: "Mastra", framework: "mastra", path: "src/mastra/agents/researcher.ts" },
        { name: "Writer", library: "Mastra", framework: "mastra", path: "src/mastra/agents/writer.ts" },
      ],
      previewable: true,
      importable: true,
      notes: ["Both Mastra agents keep their framework. Edit them in the Agents tab or in code."],
      stack: "react-vite",
      manifest: "package.json",
    },
  },
  {
    name: "docs-site",
    private: false,
    language: "Astro",
    framework: "Astro 5",
    description: "Product documentation and changelog.",
    updatedHoursAgo: 190,
    stars: 7,
    defaultBranch: "main",
    branches: ["main"],
    nextPr: 31,
    profile: {
      framework: "Astro 5",
      language: "TypeScript",
      files: 96,
      packageManager: "npm",
      uses: ["MDX", "Starlight"],
      routes: ["/", "/docs", "/changelog"],
      models: ["Doc", "Release"],
      envVars: [],
      agents: [],
      previewable: true,
      importable: true,
      notes: ["Content collections become tables you can browse and edit."],
      stack: "react-vite",
      manifest: "package.json",
    },
  },
  {
    name: "mobile-app",
    private: true,
    language: "TypeScript",
    framework: "Expo (React Native)",
    description: "Habit tracker for iOS and Android.",
    updatedHoursAgo: 340,
    stars: 1,
    defaultBranch: "main",
    branches: ["main", "expo-54"],
    nextPr: 6,
    profile: {
      framework: "Expo SDK 53",
      language: "TypeScript",
      files: 64,
      packageManager: "npm",
      uses: ["Expo Router", "React Native"],
      routes: ["/(tabs)", "/(tabs)/habits", "/(tabs)/profile", "/settings"],
      models: ["Habit"],
      envVars: ["EXPO_PUBLIC_API_URL"],
      agents: [],
      previewable: false,
      importable: true,
      reason: "Native screens run on a phone or simulator, which isn't available in this demo. You can still edit, version and push it.",
      notes: ["Code only: native screens can't render in a browser preview.", "Architect adds a web layer you can build on."],
      stack: "react-vite",
      manifest: "app.json",
    },
  },
  {
    name: "data-notebooks",
    private: false,
    language: "Jupyter Notebook",
    framework: "Jupyter",
    description: "Churn analysis notebooks.",
    updatedHoursAgo: 900,
    stars: 4,
    defaultBranch: "main",
    branches: ["main"],
    nextPr: 2,
    profile: {
      framework: "Jupyter",
      language: "Python",
      files: 17,
      packageManager: "pip",
      uses: ["pandas", "scikit-learn"],
      routes: [],
      models: [],
      envVars: [],
      agents: [],
      previewable: false,
      importable: false,
      reason: "Jupyter notebooks can't be imported yet. Architect imports web apps, APIs and agents.",
      notes: [],
      stack: "react-vite",
      manifest: "requirements.txt",
    },
  },
];

/** The repositories the simulated account owns, most recently pushed first. */
export function reposFor(login: string): Repo[] {
  return SHAPES.map((s) => ({ ...s, fullName: `${login}/${s.name}` })).sort((a, b) => a.updatedHoursAgo - b.updatedHoursAgo);
}

export function repoByName(login: string, name: string) {
  return reposFor(login).find((r) => r.name === name.toLowerCase().replace(/\.git$/, "")) ?? null;
}

export function updatedLabel(hours: number) {
  if (hours < 1) return "updated just now";
  if (hours < 24) return `updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `updated ${days}d ago`;
  const months = Math.round(days / 30);
  return `updated ${months}mo ago`;
}

/** An unknown repo or a ZIP: scanned as a small Vite + React app. */
export function genericProfile(): RepoProfile {
  return {
    framework: "Vite + React",
    language: "TypeScript",
    files: 24,
    packageManager: "npm",
    uses: ["React Router"],
    routes: ["/", "/items", "/settings"],
    models: ["Item"],
    envVars: [],
    agents: [],
    previewable: true,
    importable: true,
    notes: [],
    stack: "react-vite",
    manifest: "package.json",
  };
}

/** Accepts https://github.com/owner/repo(.git) and git@github.com:owner/repo(.git). */
export function parseGitUrl(raw: string): { owner: string; name: string } | { error: string } {
  const url = raw.trim();
  if (!url) return { error: "Paste the repository's URL." };
  const m =
    url.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/) ??
    url.match(/^git@github\.com:([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?$/);
  if (!m) {
    if (/^https?:\/\/(gitlab|bitbucket)\./i.test(url)) return { error: "Only GitHub URLs work in this demo. Download the code as a ZIP and use the ZIP tab instead." };
    return { error: "That doesn't look like a GitHub URL. Use https://github.com/owner/repo or git@github.com:owner/repo.git." };
  }
  return { owner: m[1], name: m[2] };
}

/** Where an import comes from. The server re-derives the profile from this, never from the browser. */
export type ImportSource = { kind: "github"; repo: string } | { kind: "url"; url: string } | { kind: "zip"; name: string; size: number };

export type ResolvedImport = {
  fullName: string;
  /** Owner and repo name, or null for a ZIP. */
  owner: string | null;
  name: string;
  branches: string[];
  defaultBranch: string;
  description: string;
  private: boolean;
  profile: RepoProfile;
  /** The GitHub repo in the connected account, when there is one. */
  repo: Repo | null;
};

export function resolveImport(source: ImportSource, login: string | null): ResolvedImport | { error: string } {
  if (source.kind === "github") {
    if (!login) return { error: "Connect GitHub first." };
    const repo = repoByName(login, source.repo);
    if (!repo) return { error: "That repository isn't in your account." };
    return { fullName: repo.fullName, owner: login, name: repo.name, branches: repo.branches, defaultBranch: repo.defaultBranch, description: repo.description, private: repo.private, profile: repo.profile, repo };
  }
  if (source.kind === "url") {
    const parsed = parseGitUrl(source.url);
    if ("error" in parsed) return parsed;
    // A URL to one of your own repos scans like the GitHub tab would.
    const mine = login && parsed.owner.toLowerCase() === login ? repoByName(login, parsed.name) : null;
    if (mine) return { fullName: mine.fullName, owner: login, name: mine.name, branches: mine.branches, defaultBranch: mine.defaultBranch, description: mine.description, private: mine.private, profile: mine.profile, repo: mine };
    return {
      fullName: `${parsed.owner}/${parsed.name}`,
      owner: parsed.owner,
      name: parsed.name,
      branches: ["main"],
      defaultBranch: "main",
      description: "",
      private: false,
      profile: genericProfile(),
      repo: null,
    };
  }
  const base = source.name.replace(/\.zip$/i, "").trim() || "project";
  return { fullName: source.name, owner: null, name: base, branches: [], defaultBranch: "main", description: "", private: true, profile: genericProfile(), repo: null };
}

/** The scan, as the lines the import page streams. About four seconds in all. */
export function scanSteps(r: ResolvedImport, branch: string | null): { at: number; text: string }[] {
  const p = r.profile;
  const found = [`${p.routes.length} ${p.routes.length === 1 ? "route" : "routes"}`, `${p.models.length} data ${p.models.length === 1 ? "model" : "models"}`];
  if (p.agents.length) found.push(`${p.agents.length} ${p.agents.length === 1 ? "agent" : "agents"} (${[...new Set(p.agents.map((a) => a.library))].join(", ")})`);
  return [
    { at: 0, text: r.owner ? `Cloning ${r.fullName} @ ${branch ?? r.defaultBranch} · ${p.files} files` : `Unpacking ${r.fullName} · ${p.files} files` },
    { at: 700, text: `Reading ${p.manifest}` },
    { at: 1400, text: `Detected ${p.framework} · ${p.language} · ${p.packageManager}` },
    { at: 2200, text: `Found ${found.join(", ")}` },
    { at: 2900, text: p.envVars.length ? `Found ${p.envVars.length} environment ${p.envVars.length === 1 ? "variable" : "variables"}` : "No environment variables needed" },
    { at: 3500, text: "Checking whether it can preview" },
  ];
}

export const SCAN_MS = 4200;

/** "Where do I find this?" for keys people often need. Unknown keys get a general hint. */
export const ENV_HELP: Record<string, string> = {
  DATABASE_URL: "Your Postgres connection string, like postgres://user:password@host/db. Neon and Supabase show it on the project dashboard.",
  OPENAI_API_KEY: "OpenAI platform → API keys. It starts with sk-.",
  ANTHROPIC_API_KEY: "Anthropic Console → Settings → API keys. It starts with sk-ant-.",
  NEXTAUTH_SECRET: "Any long random string. Run openssl rand -base64 32 to make one.",
  NEXT_PUBLIC_POSTHOG_KEY: "PostHog → Project settings → Project API key. It starts with phc_ and is safe in the browser.",
  VITE_SUPABASE_URL: "Supabase → Project settings → Data API → Project URL.",
  VITE_SUPABASE_ANON_KEY: "Supabase → Project settings → API keys → anon public. It's safe in the browser.",
  STRIPE_SECRET_KEY: "Stripe dashboard → Developers → API keys → Secret key. Use a test key (sk_test_…).",
  EXPO_PUBLIC_API_URL: "The URL of your backend, like https://api.example.com.",
};

export function envHelp(key: string) {
  return ENV_HELP[key] ?? "Check the service's dashboard or your team's password manager. The README often says where it comes from.";
}

/** A placeholder value for the demo, so nobody needs to paste a real secret. */
export function demoValue(key: string) {
  if (/URL$/.test(key)) return key.startsWith("DATABASE") ? "postgres://demo:demo@localhost:5432/app" : "https://demo.example.com";
  if (/SECRET$/.test(key)) return `demo-secret-${hashString(key).toString(36)}`;
  if (key.includes("POSTHOG")) return "phc_demo0000000000000000";
  if (key.includes("ANTHROPIC")) return "sk-ant-demo-0000";
  if (key.includes("OPENAI")) return "sk-demo-0000";
  if (key.includes("STRIPE")) return "sk_test_demo0000";
  return `demo-${key.toLowerCase().replace(/_/g, "-")}`;
}

export const ENV_KEY = /^[A-Z][A-Z0-9_]{0,63}$/;

// ---------------------------------------------------------------------------------------------
// A project's linked repository
// ---------------------------------------------------------------------------------------------

export type RepoBranch = {
  /** Version ids, oldest first. */
  commits: string[];
  /** How many of `commits` are on the remote. */
  pushed: number;
  /** Whether the branch exists on the remote at all. */
  published: boolean;
  pushedAt: string | null;
  /** A branch that exists only on GitHub, with code from outside Architect (an existing repo's main). */
  remoteOnly?: boolean;
};

export type PullRequest = {
  number: number;
  title: string;
  body: string;
  from: string;
  to: string;
  status: "open" | "merged" | "closed";
  createdAt: string;
  closedAt?: string;
  commits: number;
};

export type ProjectRepo = {
  owner: string;
  name: string;
  url: string;
  private: boolean;
  description?: string;
  /** How the link started: a repo Architect created, one you already had, or an import. */
  origin: "created" | "linked" | "imported";
  /** The branch you're on. */
  branch: string;
  /** Where pull requests go and where teammates push. */
  defaultBranch: string;
  /** Push every new version straight away. On for Simple, off for Pro. */
  autoCommit: boolean;
  branches: Record<string, RepoBranch>;
  prs: PullRequest[];
  nextPr: number;
  linkedAt: string;
  /** The one simulated change a teammate pushes to the default branch. `n` counts them. */
  teammate: { at: string; pulled: boolean; n: number } | null;
};

export const TEAMMATE_DELAY_MS = 2 * 60 * 1000;
export const TEAMMATE = { login: "maya-chen", name: "Maya Chen" };

export function repoFullName(repo: Pick<ProjectRepo, "owner" | "name">) {
  return `${repo.owner}/${repo.name}`;
}

/** Shown as text, never as a link: nothing lives at this address. */
export function repoUrl(owner: string, name: string) {
  return `github.com/${owner}/${name}`;
}

export function slugForRepo(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "app"
  );
}

export function validRepoName(name: string) {
  if (!name.trim()) return "Give the repository a name.";
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) return "Use letters, numbers, dots, dashes and underscores only.";
  if (/^\.+$/.test(name)) return "That name is reserved.";
  return null;
}

export function validBranchName(name: string, existing: string[]) {
  const n = name.trim();
  if (!n) return "Name the branch.";
  if (!/^[A-Za-z0-9._/-]{1,80}$/.test(n) || n.startsWith("/") || n.endsWith("/") || n.includes("//") || n.includes("..") || n.endsWith(".lock")) {
    return "Use letters, numbers, dashes, dots and slashes, like feature/reports.";
  }
  if (existing.includes(n)) return `${n} already exists.`;
  return null;
}

type LinkInput = {
  owner: string;
  name: string;
  private: boolean;
  description?: string;
  origin: ProjectRepo["origin"];
  branch: string;
  defaultBranch?: string;
  autoCommit: boolean;
  commits: string[];
  nextPr?: number;
  now: string;
};

/** A freshly linked repo: every version so far is pushed to the branch. */
export function linkRepo(input: LinkInput): ProjectRepo {
  const defaultBranch = input.defaultBranch ?? input.branch;
  const branches: Record<string, RepoBranch> = {
    [input.branch]: { commits: [...input.commits], pushed: input.commits.length, published: true, pushedAt: input.now },
  };
  if (defaultBranch !== input.branch) branches[defaultBranch] = { commits: [], pushed: 0, published: true, pushedAt: null, remoteOnly: true };
  return {
    owner: input.owner,
    name: input.name,
    url: repoUrl(input.owner, input.name),
    private: input.private,
    description: input.description,
    origin: input.origin,
    branch: input.branch,
    defaultBranch,
    autoCommit: input.autoCommit,
    branches,
    prs: [],
    nextPr: input.nextPr ?? 1,
    linkedAt: input.now,
    teammate: { at: new Date(Date.parse(input.now) + TEAMMATE_DELAY_MS).toISOString(), pulled: false, n: 1 },
  };
}

/** Whether the teammate's change has landed on the remote by `now`. */
export function teammateArrived(repo: ProjectRepo, now: number) {
  return !!repo.teammate && !repo.teammate.pulled && now >= Date.parse(repo.teammate.at);
}

export type RepoStatus = {
  branch: string;
  head: string | null;
  ahead: number;
  behind: number;
  published: boolean;
  pushedAt: string | null;
  lastPushedVersionId: string | null;
  unpushed: string[];
  onDefault: boolean;
  openPr: PullRequest | null;
};

/** Everything the chip, the sheet, the Code tab and the terminal show, derived from the repo. */
export function repoStatus(repo: ProjectRepo, now: number): RepoStatus {
  const b = repo.branches[repo.branch] ?? { commits: [], pushed: 0, published: false, pushedAt: null };
  const onDefault = repo.branch === repo.defaultBranch;
  return {
    branch: repo.branch,
    head: b.commits[b.commits.length - 1] ?? null,
    ahead: b.commits.length - b.pushed,
    behind: onDefault && teammateArrived(repo, now) ? 1 : 0,
    published: b.published,
    pushedAt: b.pushedAt,
    lastPushedVersionId: b.pushed ? b.commits[b.pushed - 1] : null,
    unpushed: b.commits.slice(b.pushed),
    onDefault,
    openPr: repo.prs.find((p) => p.from === repo.branch && p.status === "open") ?? null,
  };
}

function withBranch(repo: ProjectRepo, name: string, patch: Partial<RepoBranch>): ProjectRepo {
  return { ...repo, branches: { ...repo.branches, [name]: { ...repo.branches[name], ...patch } } };
}

/**
 * A new version is a new commit on the current branch. With auto-commit on it's pushed at once,
 * unless the remote has a change you haven't pulled (then it waits, like a rejected push would).
 */
export function commitVersion(repo: ProjectRepo, versionId: string, now: number): ProjectRepo {
  const b = repo.branches[repo.branch];
  if (!b || b.commits.includes(versionId)) return repo;
  const commits = [...b.commits, versionId];
  const blocked = repo.branch === repo.defaultBranch && teammateArrived(repo, now);
  if (repo.autoCommit && !blocked) return withBranch(repo, repo.branch, { commits, pushed: commits.length, published: true, pushedAt: new Date(now).toISOString() });
  return withBranch(repo, repo.branch, { commits });
}

/** Whether a push would go through, and how many commits it sends. */
export function pushCheck(repo: ProjectRepo, now: number): { ok: true; count: number; publishing: boolean } | { ok: false; error: string } {
  const s = repoStatus(repo, now);
  if (s.behind) return { ok: false, error: `The remote has ${s.behind} ${s.behind === 1 ? "commit" : "commits"} you don't have yet. Pull first, then push.` };
  if (s.ahead === 0 && s.published) return { ok: false, error: "Everything is already pushed." };
  return { ok: true, count: s.ahead, publishing: !s.published };
}

export function pushBranch(repo: ProjectRepo, now: number): ProjectRepo {
  const b = repo.branches[repo.branch];
  return withBranch(repo, repo.branch, { pushed: b.commits.length, published: true, pushedAt: new Date(now).toISOString() });
}

/**
 * Pulling lands the teammate's commit as a new version. With nothing of yours waiting it's a
 * fast-forward, so you're in sync; otherwise it's a merge commit you still have to push.
 */
export function pullRemote(repo: ProjectRepo, versionId: string, now: number): ProjectRepo {
  const b = repo.branches[repo.branch];
  const commits = [...b.commits, versionId];
  const fastForward = b.pushed === b.commits.length;
  const next: ProjectRepo = { ...repo, teammate: repo.teammate ? { ...repo.teammate, pulled: true } : null };
  if (fastForward || repo.autoCommit) return withBranch(next, repo.branch, { commits, pushed: commits.length, pushedAt: new Date(now).toISOString() });
  return withBranch(next, repo.branch, { commits });
}

/** "Simulate teammate push": the next change lands on the default branch now. */
export function teammatePush(repo: ProjectRepo, now: number): ProjectRepo {
  const n = repo.teammate?.pulled ? repo.teammate.n + 1 : repo.teammate?.n ?? 1;
  return { ...repo, teammate: { at: new Date(now).toISOString(), pulled: false, n } };
}

/** A new branch starts from the current version and is switched to straight away. */
export function createBranch(repo: ProjectRepo, name: string, now: number): ProjectRepo {
  const from = repo.branches[repo.branch];
  const commits = [...from.commits];
  const publish = repo.autoCommit;
  return {
    ...repo,
    branch: name,
    branches: {
      ...repo.branches,
      [name]: {
        commits,
        pushed: publish ? commits.length : Math.min(from.pushed, commits.length),
        published: publish,
        pushedAt: publish ? new Date(now).toISOString() : from.pushedAt,
      },
    },
  };
}

/** Why a branch can't be switched to, or null when it can. */
export function switchBlocked(repo: ProjectRepo, name: string) {
  const b = repo.branches[name];
  if (!b) return `${name} doesn't exist.`;
  if (b.remoteOnly || b.commits.length === 0) return `${name} has code from outside Architect. Merge a pull request into it first.`;
  return null;
}

export function switchBranch(repo: ProjectRepo, name: string): ProjectRepo {
  return { ...repo, branch: name };
}

/** Commits on `from` that `to` doesn't have. */
export function commitsAhead(repo: ProjectRepo, from: string, to: string) {
  const a = repo.branches[from]?.commits ?? [];
  const b = new Set(repo.branches[to]?.commits ?? []);
  return a.filter((c) => !b.has(c));
}

/** Why the current branch can't open a pull request, or null when it can. */
export function prBlocked(repo: ProjectRepo) {
  if (repo.branch === repo.defaultBranch) return `Pull requests go from a branch into ${repo.defaultBranch}. Create a branch first.`;
  if (repo.prs.some((p) => p.from === repo.branch && p.status === "open")) return "This branch already has an open pull request.";
  if (commitsAhead(repo, repo.branch, repo.defaultBranch).length === 0) return `This branch has nothing ${repo.defaultBranch} doesn't. Make a change first.`;
  return null;
}

/** Opening a pull request pushes the branch first, the way a real one needs it on the remote. */
export function openPullRequest(repo: ProjectRepo, input: { title: string; body: string }, now: number): { repo: ProjectRepo; pr: PullRequest } {
  const pushed = pushBranch(repo, now);
  const pr: PullRequest = {
    number: repo.nextPr,
    title: input.title,
    body: input.body,
    from: repo.branch,
    to: repo.defaultBranch,
    status: "open",
    createdAt: new Date(now).toISOString(),
    commits: commitsAhead(repo, repo.branch, repo.defaultBranch).length,
  };
  return { repo: { ...pushed, prs: [pr, ...repo.prs], nextPr: repo.nextPr + 1 }, pr };
}

/** A merge fast-forwards when the base hasn't moved; otherwise it needs a merge commit. */
export function canFastForward(repo: ProjectRepo, pr: PullRequest) {
  const base = repo.branches[pr.to]?.commits ?? [];
  const head = repo.branches[pr.from]?.commits ?? [];
  return base.every((c, i) => head[i] === c);
}

/**
 * Merges on the (simulated) remote and brings the base branch up to date locally. `mergeVersionId`
 * is the merge commit when the base had moved on.
 */
export function mergePullRequest(repo: ProjectRepo, number: number, now: number, mergeVersionId?: string): ProjectRepo {
  const pr = repo.prs.find((p) => p.number === number);
  if (!pr) return repo;
  const head = repo.branches[pr.from]?.commits ?? [];
  const base = repo.branches[pr.to];
  const commits = mergeVersionId ? [...(base?.commits ?? []), mergeVersionId] : [...head];
  const at = new Date(now).toISOString();
  return {
    ...repo,
    branches: { ...repo.branches, [pr.to]: { commits, pushed: commits.length, published: true, pushedAt: at } },
    prs: repo.prs.map((p) => (p.number === number ? { ...p, status: "merged", closedAt: at } : p)),
  };
}

export function closePullRequest(repo: ProjectRepo, number: number, now: number): ProjectRepo {
  return { ...repo, prs: repo.prs.map((p) => (p.number === number && p.status === "open" ? { ...p, status: "closed", closedAt: new Date(now).toISOString() } : p)) };
}

/** Turning auto-commit on pushes whatever was waiting (unless you need to pull first). */
export function setAutoCommit(repo: ProjectRepo, on: boolean, now: number): ProjectRepo {
  const next = { ...repo, autoCommit: on };
  if (!on) return next;
  const check = pushCheck(next, now);
  return check.ok ? pushBranch(next, now) : next;
}

/** A PR body from the branch's own commits: one bullet per version summary. */
export function prDraft(repo: ProjectRepo, summaries: Record<string, string>) {
  const own = commitsAhead(repo, repo.branch, repo.defaultBranch);
  const lines = own.map((id) => summaries[id]).filter(Boolean);
  const words = repo.branch.split("/").pop()!.replace(/[-_]+/g, " ").trim();
  const title = lines.length === 1 ? lines[0] : words ? words.charAt(0).toUpperCase() + words.slice(1) : "Changes from Architect";
  return { title, body: lines.map((l) => `- ${l}`).join("\n") };
}

/** The README change a teammate pushes. Each one is different, so pulling twice stays honest. */
export function teammateChange(n: number): { subject: string; section: string } {
  const variants = [
    {
      subject: "Update README",
      section: `## Contributing\n\n1. Create a branch from \`main\`.\n2. Make your change and open a pull request.\n3. Ask for a review in #eng before merging.\n`,
    },
    {
      subject: "Document the release process",
      section: `## Releasing\n\nMerges to \`main\` deploy automatically. Tag a release with \`git tag vX.Y.Z\` once it's live.\n`,
    },
    {
      subject: "Add a support contact",
      section: `## Support\n\nQuestions? Reach the team at support@example.com or in #help.\n`,
    },
  ];
  const v = variants[(n - 1) % variants.length];
  return n > variants.length ? { subject: `${v.subject} (${n})`, section: v.section } : v;
}

// ---------------------------------------------------------------------------------------------
// Merging two branches' plans
// ---------------------------------------------------------------------------------------------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The last commit both branches share: where `from` forked off `to`. */
export function forkPoint(repo: ProjectRepo, from: string, to: string) {
  const base = new Set(repo.branches[to]?.commits ?? []);
  const head = repo.branches[from]?.commits ?? [];
  for (let i = head.length - 1; i >= 0; i--) if (base.has(head[i])) return head[i];
  return null;
}

/** Three-way merge of lists keyed by id: each side's additions, removals and edits survive; the branch wins a conflict. */
function mergeById<T extends { id: string }>(base: T[], ours: T[], theirs: T[]): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const o = new Map(ours.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  const pick = (id: string): T | null => {
    const [bi, oi, ti] = [b.get(id), o.get(id), t.get(id)];
    if (!bi) return ti ?? oi ?? null; // added on one side (or both: the branch wins)
    if (!ti) return oi && !same(oi, bi) ? oi : null; // the branch removed it, unless main changed it since
    if (!oi) return !same(ti, bi) ? ti : null; // main removed it, unless the branch changed it since
    return !same(ti, bi) ? ti : oi;
  };
  const out: T[] = [];
  for (const x of theirs) {
    const v = pick(x.id);
    if (v) out.push(v);
  }
  // Main's own additions go in before a trailing Settings page, the way new pages always do.
  const extra = ours.filter((x) => !t.has(x.id) && !b.has(x.id));
  const last = out[out.length - 1] as unknown as { kind?: string } | undefined;
  const at = last?.kind === "settings" ? out.length - 1 : out.length;
  out.splice(at, 0, ...extra);
  return out;
}

function mergeRecord<V>(base: Record<string, V> = {}, ours: Record<string, V> = {}, theirs: Record<string, V> = {}) {
  const out: Record<string, V> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const changedByBranch = !same(theirs[k], base[k]);
    const v = changedByBranch ? theirs[k] : ours[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * The plan a merge commit gets: `base` is the fork point, `ours` the branch being merged into,
 * `theirs` the pull request's branch. Structural rather than line-based, since plans are data.
 */
export function mergePlans<P extends { pages: { id: string }[]; agents: { id: string }[]; data: { id: string }[]; ui: object; fileOverrides?: Record<string, string | null> }>(base: P, ours: P, theirs: P): P {
  const out = { ...ours } as P;
  for (const k of Object.keys({ ...base, ...ours, ...theirs }) as (keyof P)[]) {
    if (k === "pages" || k === "agents" || k === "data" || k === "ui" || k === "fileOverrides") continue;
    out[k] = !same(theirs[k], base[k]) ? theirs[k] : ours[k];
  }
  out.pages = mergeById(base.pages, ours.pages, theirs.pages) as P["pages"];
  out.agents = mergeById(base.agents, ours.agents, theirs.agents) as P["agents"];
  out.data = mergeById(base.data, ours.data, theirs.data) as P["data"];
  out.ui = mergeRecord(base.ui as Record<string, unknown>, ours.ui as Record<string, unknown>, theirs.ui as Record<string, unknown>) as P["ui"];
  const overrides = mergeRecord(base.fileOverrides, ours.fileOverrides, theirs.fileOverrides);
  if (Object.keys(overrides).length) out.fileOverrides = overrides;
  else delete out.fileOverrides;
  return out;
}
