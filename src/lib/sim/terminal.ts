import { hashString } from "../seeded";
import { commitSha, validBranchName } from "./github";
import type { Issue } from "./types";

/**
 * A scripted shell for the Pro drawer. It reads the current version's real files, so `ls`, `cat`
 * and `tree` tell the truth; `npm` and `git` print what they would print for this project.
 * Pure: the same input and context always give the same output.
 */

export type Tone = "muted" | "error" | "success" | "accent" | "warning" | "info" | "strong";
export type Segment = { text: string; tone?: Tone };
/** One output line. `wait` is a pause (ms) before it appears, for commands that take a moment. */
export type TermLine = { segs: Segment[]; wait?: number };

export type TermContext = {
  files: Record<string, string>;
  pages: { id: string; name: string; file: string }[];
  issues: Issue[];
  versions: { id: string; number: number; summary: string; current: boolean }[];
  projectName: string;
  slug: string;
  user: string;
  stack: string;
  cwd: string;
  /** The linked repo's state, when there is one. Commits are the current branch's, newest first. */
  git?: TermGit;
};

export type TermGit = {
  remote: string;
  connected: boolean;
  branch: string;
  defaultBranch: string;
  branches: { name: string; current: boolean; remoteOnly: boolean; switchable: boolean }[];
  ahead: number;
  behind: number;
  published: boolean;
  commits: { id: string; number: number; subject: string; pushed: boolean }[];
};

/** Something the terminal asks the Workspace to really do after printing its output. */
export type TermEffect = { kind: "push" } | { kind: "pull" } | { kind: "switch"; branch: string } | { kind: "branch"; name: string };

export type TermResult = { lines: TermLine[]; cwd?: string; clear?: boolean; effect?: TermEffect };

export const COMMANDS: { name: string; usage: string; about: string }[] = [
  { name: "help", usage: "help", about: "List these commands" },
  { name: "ls", usage: "ls [dir]", about: "List files" },
  { name: "tree", usage: "tree [dir]", about: "Show the file tree" },
  { name: "cd", usage: "cd <dir>", about: "Change directory" },
  { name: "pwd", usage: "pwd", about: "Print the current directory" },
  { name: "cat", usage: "cat <file>", about: "Print a file" },
  { name: "echo", usage: "echo <text>", about: "Print text" },
  { name: "whoami", usage: "whoami", about: "Who you're signed in as" },
  { name: "clear", usage: "clear", about: "Clear the terminal" },
  { name: "git", usage: "git status | log | branch | push | pull | switch", about: "Versions as commits, synced to GitHub" },
  { name: "npm", usage: "npm install | npm run dev | npm run build | npm test", about: "Install, run, build and test" },
  { name: "architect", usage: "architect deploy", about: "Deploy from the terminal" },
];

const line = (text: string, tone?: Tone, wait?: number): TermLine => ({ segs: [{ text, tone }], wait });
const blank = (wait?: number): TermLine => ({ segs: [{ text: "" }], wait });

function userSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "you";
}

export const shortSha = commitSha;

function norm(cwd: string, arg: string | undefined) {
  if (!arg || arg === "~" || arg === "/") return arg ? "" : cwd;
  const parts = (arg.startsWith("~/") ? arg.slice(2) : arg.startsWith("/") ? arg.slice(1) : cwd ? `${cwd}/${arg}` : arg).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function dirs(files: Record<string, string>) {
  const set = new Set<string>([""]);
  for (const path of Object.keys(files)) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"));
  }
  return set;
}

function entries(files: Record<string, string>, dir: string) {
  const prefix = dir ? `${dir}/` : "";
  const names = new Map<string, boolean>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const [head, ...tail] = rest.split("/");
    names.set(head, tail.length > 0 || names.get(head) === true);
  }
  return [...names.entries()].sort(([a, ad], [b, bd]) => Number(bd) - Number(ad) || a.localeCompare(b));
}

function kb(chars: number) {
  return (chars / 1000).toFixed(2);
}

function ms(seed: string, min: number, spread: number) {
  return min + (hashString(seed) % spread);
}

export function prompt(ctx: Pick<TermContext, "slug" | "cwd">) {
  return `~/${ctx.slug}${ctx.cwd ? `/${ctx.cwd}` : ""}`;
}

export function runCommand(input: string, ctx: TermContext): TermResult {
  const raw = input.trim();
  if (!raw) return { lines: [] };
  const [cmd, ...args] = raw.split(/\s+/);
  const allDirs = dirs(ctx.files);
  const pkg = ctx.slug.replace(/-[a-z0-9]{4}$/, "");
  const home = `/home/${userSlug(ctx.user)}/${ctx.slug}`;

  switch (cmd) {
    case "help":
      return {
        lines: [
          line("Commands in this demo terminal:", "muted"),
          ...COMMANDS.map((c) => ({ segs: [{ text: c.usage.padEnd(44), tone: "accent" as Tone }, { text: c.about, tone: "muted" as Tone }] })),
          line("↑ and ↓ go through history. Tab completes commands and paths.", "muted"),
        ],
      };

    case "clear":
      return { lines: [], clear: true };

    case "pwd":
      return { lines: [line(`${home}${ctx.cwd ? `/${ctx.cwd}` : ""}`)] };

    case "whoami":
      return { lines: [line(ctx.user)] };

    case "echo":
      return { lines: [line(args.join(" ").replace(/^["']|["']$/g, ""))] };

    case "cd": {
      const target = norm(ctx.cwd, args[0] ?? "~");
      if (!allDirs.has(target)) {
        return { lines: [line(`cd: ${ctx.files[target] !== undefined ? "not a directory" : "no such file or directory"}: ${args[0]}`, "error")] };
      }
      return { lines: [], cwd: target };
    }

    case "ls": {
      const flags = args.filter((a) => a.startsWith("-"));
      const target = norm(ctx.cwd, args.find((a) => !a.startsWith("-")));
      if (ctx.files[target] !== undefined) return { lines: [line(target.split("/").pop()!)] };
      if (!allDirs.has(target)) return { lines: [line(`ls: ${args.find((a) => !a.startsWith("-"))}: No such file or directory`, "error")] };
      const list = entries(ctx.files, target);
      const hidden = flags.some((f) => f.includes("a"));
      const shown = list.filter(([name]) => hidden || !name.startsWith("."));
      if (flags.some((f) => f.includes("l"))) {
        return {
          lines: shown.map(([name, isDir]) => {
            const size = isDir ? 4096 : (ctx.files[target ? `${target}/${name}` : name] ?? "").length;
            return { segs: [{ text: `${isDir ? "drwxr-xr-x" : "-rw-r--r--"}  ${String(size).padStart(6)}  `, tone: "muted" }, { text: isDir ? `${name}/` : name, tone: isDir ? "accent" : undefined }] };
          }),
        };
      }
      return { lines: [{ segs: shown.flatMap(([name, isDir]) => [{ text: isDir ? `${name}/` : name, tone: isDir ? ("accent" as Tone) : undefined }, { text: "   " }]) }] };
    }

    case "tree": {
      const root = norm(ctx.cwd, args[0]);
      if (!allDirs.has(root)) return { lines: [line(`${args[0]} [error opening dir]`, "error")] };
      const out: TermLine[] = [line(root ? root.split("/").pop()! : ".", "accent")];
      let fileCount = 0;
      let dirCount = 0;
      const walk = (dir: string, indent: string) => {
        const list = entries(ctx.files, dir);
        list.forEach(([name, isDir], i) => {
          const last = i === list.length - 1;
          out.push({ segs: [{ text: `${indent}${last ? "└── " : "├── "}`, tone: "muted" }, { text: name, tone: isDir ? "accent" : undefined }] });
          if (isDir) {
            dirCount++;
            walk(dir ? `${dir}/${name}` : name, `${indent}${last ? "    " : "│   "}`);
          } else fileCount++;
        });
      };
      walk(root, "");
      out.push(blank(), line(`${dirCount} directories, ${fileCount} files`, "muted"));
      return { lines: out };
    }

    case "cat": {
      if (!args[0]) return { lines: [line("usage: cat <file>", "muted")] };
      return {
        lines: args.flatMap((a) => {
          const path = norm(ctx.cwd, a);
          if (ctx.files[path] !== undefined) return ctx.files[path].replace(/\n$/, "").split("\n").map((l) => line(l));
          return [line(`cat: ${a}: ${allDirs.has(path) ? "Is a directory" : "No such file or directory"}`, "error")];
        }),
      };
    }

    case "git":
      return git(args, ctx);

    case "npm":
    case "pnpm":
      return npm(args, ctx, pkg, cmd);

    case "architect":
      if (args[0] === "deploy") {
        return {
          lines: [
            line("Deploying from the terminal arrives with the Ship milestone.", "warning", 200),
            line("For now, use the Deploy button in the top bar. Every version is ready to ship.", "muted"),
          ],
        };
      }
      return { lines: [line("usage: architect deploy", "muted")] };

    default:
      return { lines: [line(`zsh: command not found: ${cmd}`, "error")] };
  }
}

function git(args: string[], ctx: TermContext): TermResult {
  const sub = args[0];
  const g = ctx.git;
  const branch = g?.branch ?? "main";
  const remote = g ? `${g.remote.replace(/^github\.com\//, "github.com:")}.git` : "";
  // Without a linked repo, every version is still a commit on a local main.
  const commits =
    g?.commits ??
    [...ctx.versions].sort((a, b) => b.number - a.number).map((v) => ({ id: v.id, number: v.number, subject: v.summary, pushed: false }));
  const s = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (sub === "status") {
    const out: TermLine[] = [line(`On branch ${branch}`)];
    if (!g) out.push(line("No remote yet. Link a repository from the GitHub button in the top bar.", "muted"));
    else if (!g.published) out.push(line(`Your branch isn't on GitHub yet.`), line(`  (use "git push -u origin ${branch}" to publish it)`, "muted"));
    else if (g.behind && g.ahead) out.push(line(`Your branch and 'origin/${branch}' have diverged,`), line(`and have ${g.ahead} and ${g.behind} different commits each, respectively.`), line(`  (use "git pull" to merge the remote branch into yours)`, "muted"));
    else if (g.behind) out.push(line(`Your branch is behind 'origin/${branch}' by ${s(g.behind, "commit")}, and can be fast-forwarded.`), line(`  (use "git pull" to update your local branch)`, "muted"));
    else if (g.ahead) out.push(line(`Your branch is ahead of 'origin/${branch}' by ${s(g.ahead, "commit")}.`), line(`  (use "git push" to publish your local commits)`, "muted"));
    else out.push(line(`Your branch is up to date with 'origin/${branch}'.`));
    out.push(blank(), line("nothing to commit, working tree clean"));
    return { lines: out };
  }

  if (sub === "log") {
    if (commits.length === 0) return { lines: [line(`fatal: your current branch '${branch}' does not have any commits yet`, "error")] };
    const originAt = g?.published ? commits.find((c) => c.pushed)?.id : undefined;
    return {
      lines: commits.map((c, i) => {
        const refs = [...(i === 0 ? [`HEAD -> ${branch}`] : []), ...(c.id === originAt ? [`origin/${branch}`] : [])];
        return {
          segs: [
            { text: `${commitSha(c.id)} `, tone: "warning" as Tone },
            ...(refs.length ? [{ text: `(${refs.join(", ")}) `, tone: "info" as Tone }] : []),
            { text: c.subject },
            { text: ` · v${c.number}`, tone: "muted" as Tone },
          ],
        };
      }),
    };
  }

  if (sub === "branch") {
    if (!g) return { lines: [{ segs: [{ text: "* " }, { text: "main", tone: "success" }] }] };
    return {
      lines: g.branches.map((b) =>
        b.remoteOnly
          ? line(`  remotes/origin/${b.name}`, "error")
          : { segs: [{ text: b.current ? "* " : "  " }, { text: b.name, tone: b.current ? ("success" as Tone) : undefined }] },
      ),
    };
  }

  if (sub === "remote") {
    if (!g) return { lines: [] };
    return { lines: [line(`origin\tgit@${remote} (fetch)`), line(`origin\tgit@${remote} (push)`)] };
  }

  if (sub === "push") {
    if (!g) return { lines: [line("fatal: No configured push destination.", "error"), line("Link a repository from the GitHub button in the top bar, then push.", "muted")] };
    if (!g.connected) return { lines: [line(`fatal: Authentication failed for 'https://${g.remote}.git/'`, "error"), line("GitHub is disconnected. Reconnect it from the GitHub button in the top bar.", "muted")] };
    if (g.behind) {
      return {
        lines: [
          line(`To ${remote}`, undefined, 600),
          { segs: [{ text: " ! [rejected]        ", tone: "error" }, { text: `${branch} -> ${branch} (fetch first)` }] },
          line(`error: failed to push some refs to '${remote}'`, "error"),
          line("hint: Updates were rejected because the remote contains work that you do not", "warning"),
          line('hint: have locally. Run "git pull" first, then push again.', "warning"),
        ],
      };
    }
    if (g.published && g.ahead === 0) return { lines: [line("Everything up-to-date", undefined, 300)] };
    const objects = 3 + g.ahead * 4;
    const from = commits.find((c) => c.pushed)?.id;
    const to = commits[0]?.id;
    return {
      effect: { kind: "push" },
      lines: [
        line(`Enumerating objects: ${objects}, done.`, "muted", 300),
        line(`Counting objects: 100% (${objects}/${objects}), done.`, "muted", 150),
        line(`Writing objects: 100% (${objects - 2}/${objects - 2}), ${(1.2 + g.ahead * 0.8).toFixed(2)} KiB | 2.1 MiB/s, done.`, "muted", 450),
        line(`To ${remote}`),
        g.published && from && to
          ? line(`   ${commitSha(from)}..${commitSha(to)}  ${branch} -> ${branch}`)
          : { segs: [{ text: " * [new branch]      ", tone: "success" }, { text: `${branch} -> ${branch}` }] },
        ...(g.published ? [] : [line(`branch '${branch}' set up to track 'origin/${branch}'.`, "muted")]),
      ],
    };
  }

  if (sub === "pull") {
    if (!g) return { lines: [line("fatal: No remote repository specified.", "error"), line("Link a repository from the GitHub button in the top bar first.", "muted")] };
    if (!g.connected) return { lines: [line(`fatal: Authentication failed for 'https://${g.remote}.git/'`, "error")] };
    if (!g.behind) return { lines: [line("Already up to date.", undefined, 500)] };
    const head = commits[0]?.id ?? "0";
    const incoming = commitSha(`${head}:remote`);
    return {
      effect: { kind: "pull" },
      lines: [
        line("remote: Enumerating objects: 5, done.", "muted", 500),
        line("remote: Total 3 (delta 1), reused 0 (delta 0)", "muted", 150),
        line(`From ${remote.replace(/\.git$/, "")}`),
        line(`   ${commitSha(head)}..${incoming}  ${branch}     -> origin/${branch}`),
        ...(g.ahead ? [line("Merge made by the 'ort' strategy.", undefined, 300)] : [line(`Updating ${commitSha(head)}..${incoming}`, undefined, 300), line("Fast-forward")]),
        { segs: [{ text: " README.md | 7 " }, { text: "+++++++", tone: "success" }] },
        line(" 1 file changed, 7 insertions(+)"),
      ],
    };
  }

  if (sub === "checkout" || sub === "switch") {
    const create = args[1] === "-b" || args[1] === "-c";
    const target = create ? args[2] : args[1];
    if (!target) return { lines: [line(`usage: git ${sub} ${sub === "switch" ? "[-c] " : "[-b] "}<branch>`, "muted")] };
    if (!g) return { lines: [line("Link a repository from the GitHub button in the top bar to use branches.", "muted")] };
    if (create) {
      const bad = validBranchName(target, g.branches.map((b) => b.name));
      if (bad) return { lines: [line(`fatal: ${bad.replace(/\.$/, "")}`, "error")] };
      return { effect: { kind: "branch", name: target }, lines: [line(`Switched to a new branch '${target}'`)] };
    }
    const b = g.branches.find((x) => x.name === target);
    if (!b) return { lines: [line(`error: pathspec '${target}' did not match any file(s) known to git`, "error")] };
    if (b.current) return { lines: [line(`Already on '${target}'`)] };
    if (!b.switchable) return { lines: [line(`error: '${target}' has code from outside Architect. Merge a pull request into it first.`, "error")] };
    return { effect: { kind: "switch", branch: target }, lines: [line(`Switched to branch '${target}'`)] };
  }

  if (sub === "diff") return { lines: [] };
  if (!sub) return { lines: [line("usage: git status | log | branch | push | pull | switch <branch> | switch -c <branch> | remote -v", "muted")] };
  return { lines: [line(`git: '${sub}' is not a git command. See 'git --help'.`, "error")] };
}

function npm(args: string[], ctx: TermContext, pkg: string, bin: string): TermResult {
  const script = args[0] === "run" ? args[1] : args[0];
  const next = ctx.stack === "nextjs";
  const header = (name: string, cmd: string) => [line(`> ${pkg}@0.1.0 ${name}`, "muted", 120), line(`> ${cmd}`, "muted"), blank()];

  if (args[0] === "install" || args[0] === "i" || args.length === 0) {
    return {
      lines: [
        line(`added 214 packages, and audited 215 packages in 3s`, undefined, 1400),
        blank(),
        line("41 packages are looking for funding", "muted"),
        line(`  run \`${bin} fund\` for details`, "muted"),
        blank(),
        { segs: [{ text: "found " }, { text: "0", tone: "success" }, { text: " vulnerabilities" }] },
      ],
    };
  }

  if (script === "dev") {
    if (next) {
      return {
        lines: [
          ...header("dev", "next dev"),
          line("   ▲ Next.js 16.0.0 (Turbopack)", "strong", 300),
          line("   - Local:        http://localhost:3000"),
          line("   - Network:      http://192.168.1.24:3000", "muted"),
          blank(),
          { segs: [{ text: " ✓ ", tone: "success" }, { text: "Ready in 1.1s" }], wait: 500 },
        ],
      };
    }
    return {
      lines: [
        ...header("dev", "vite"),
        { segs: [{ text: "  VITE v7.1.3", tone: "success" }, { text: "  ready in " }, { text: "312 ms", tone: "strong" }], wait: 400 },
        blank(),
        { segs: [{ text: "  ➜  ", tone: "success" }, { text: "Local:   " }, { text: "http://localhost:5173/", tone: "info" }] },
        { segs: [{ text: "  ➜  ", tone: "success" }, { text: "Network: use --host to expose", tone: "muted" }] },
      ],
    };
  }

  if (script === "build") {
    const source = Object.entries(ctx.files).filter(([p]) => /\.(tsx?|css)$/.test(p) && !p.startsWith("backend/"));
    const css = source.filter(([p]) => p.endsWith(".css")).reduce((n, [, c]) => n + c.length, 0);
    const pages = ctx.pages.map((p) => ({ name: p.file.split("/").pop()!.replace(/\.tsx$/, ""), size: (ctx.files[p.file] ?? "").length * 0.72 }));
    const rest = source.filter(([p]) => !p.endsWith(".css") && !ctx.pages.some((pg) => pg.file === p)).reduce((n, [, c]) => n + c.length, 0);
    const main = 186_400 + rest * 0.72;
    const hash = (s: string) => hashString(`${ctx.slug}:${s}:${Object.keys(ctx.files).length}`).toString(36).slice(0, 8);
    const row = (path: string, size: number) => ({
      segs: [
        { text: "dist/", tone: "muted" as Tone },
        { text: path.padEnd(34), tone: path.endsWith(".css") ? ("info" as Tone) : path.endsWith(".html") ? undefined : ("accent" as Tone) },
        { text: `${kb(size).padStart(8)} kB`, tone: "strong" as Tone },
        { text: ` │ gzip: ${kb(size * 0.36).padStart(6)} kB`, tone: "muted" as Tone },
      ],
    });
    if (next) {
      return {
        lines: [
          ...header("build", "next build"),
          line("   ▲ Next.js 16.0.0 (Turbopack)", "strong", 300),
          line("   Creating an optimized production build ...", undefined, 900),
          { segs: [{ text: " ✓ ", tone: "success" }, { text: `Compiled successfully in ${(1.2 + source.length * 0.04).toFixed(1)}s` }], wait: 700 },
          { segs: [{ text: " ✓ ", tone: "success" }, { text: `Generating static pages (${ctx.pages.length + 2}/${ctx.pages.length + 2})` }], wait: 400 },
          blank(),
          line("Route (app)                         Size  First Load JS", "muted"),
          ...ctx.pages.map((p, i) => line(`${i === ctx.pages.length - 1 ? "└" : "├"} ○ /${i === 0 ? "" : p.id}`.padEnd(36) + `${kb((ctx.files[p.file] ?? "").length * 0.72)} kB`.padStart(9) + `${kb(main * 0.55 + i * 90)} kB`.padStart(15))),
          blank(),
          line("○  (Static)  prerendered as static content", "muted"),
        ],
      };
    }
    return {
      lines: [
        ...header("build", "tsc -b && vite build"),
        { segs: [{ text: "vite v7.1.3 ", tone: "info" }, { text: "building for production..." }], wait: 500 },
        { segs: [{ text: "✓ ", tone: "success" }, { text: `${source.length + 31} modules transformed.` }], wait: 800 },
        row("index.html", 460),
        row(`assets/index-${hash("css")}.css`, css * 0.8),
        ...pages.map((p) => row(`assets/${p.name}-${hash(p.name)}.js`, p.size)),
        row(`assets/index-${hash("js")}.js`, main),
        { segs: [{ text: "✓ built in ", tone: "success" }, { text: `${(0.9 + source.length * 0.03).toFixed(2)}s` }], wait: 200 },
      ],
    };
  }

  if (script === "test" || args[0] === "t") {
    const failing = new Map(ctx.issues.map((i) => [i.file, i]));
    const out: TermLine[] = [...header("test", "vitest run"), { segs: [{ text: " RUN ", tone: "info" }, { text: ` v3.2.4 /home/${userSlug(ctx.user)}/${ctx.slug}`, tone: "muted" }], wait: 300 }, blank()];
    let failedFiles = 0;
    ctx.pages.forEach((p, i) => {
      const testFile = p.file.replace(/\.tsx$/, ".test.tsx");
      const issue = failing.get(p.file);
      const time = ms(`${p.file}:${i}`, 24, 60);
      if (issue) {
        failedFiles++;
        out.push(
          { segs: [{ text: " ❯ ", tone: "error" }, { text: testFile }, { text: ` (3 tests | 1 failed) ${time}ms`, tone: "muted" }], wait: 160 },
          { segs: [{ text: "   × ", tone: "error" }, { text: `${p.name} > renders without crashing` }] },
          line(`     → ${issue.title.replace(/^TypeError: /, "")}`, "error"),
          line(`       ❯ ${issue.file}:${issue.line}`, "muted"),
        );
      } else {
        out.push({ segs: [{ text: " ✓ ", tone: "success" }, { text: testFile }, { text: ` (3 tests) ${time}ms`, tone: "muted" }], wait: 160 });
      }
    });
    const total = ctx.pages.length * 3;
    out.push(blank());
    out.push({
      segs: [
        { text: " Test Files  ", tone: "muted" },
        ...(failedFiles ? [{ text: `${failedFiles} failed`, tone: "error" as Tone }, { text: " | " }] : []),
        { text: `${ctx.pages.length - failedFiles} passed`, tone: "success" },
        { text: ` (${ctx.pages.length})`, tone: "muted" },
      ],
    });
    out.push({
      segs: [
        { text: "      Tests  ", tone: "muted" },
        ...(failedFiles ? [{ text: `${failedFiles} failed`, tone: "error" as Tone }, { text: " | " }] : []),
        { text: `${total - failedFiles} passed`, tone: "success" },
        { text: ` (${total})`, tone: "muted" },
      ],
    });
    out.push(line(`   Duration  ${(0.6 + ctx.pages.length * 0.14).toFixed(2)}s`, "muted"));
    return { lines: out };
  }

  if (script) return { lines: [line(`npm error Missing script: "${script}"`, "error"), line("npm error To see a list of scripts, run:", "muted"), line("npm error   npm run", "muted")] };
  return { lines: [line("usage: npm install | npm run dev | npm run build | npm test", "muted")] };
}

/** Tab completion: commands first, then paths relative to the current directory. */
export function complete(input: string, ctx: TermContext): { value: string; options: string[] } {
  const parts = input.split(" ");
  if (parts.length === 1) {
    const options = COMMANDS.map((c) => c.name).filter((n) => n.startsWith(parts[0]));
    return { value: options.length === 1 ? `${options[0]} ` : commonPrefix(options) || input, options: options.length > 1 ? options : [] };
  }
  const token = parts[parts.length - 1];
  const slash = token.lastIndexOf("/");
  const dirPart = slash >= 0 ? token.slice(0, slash) : "";
  const base = slash >= 0 ? token.slice(slash + 1) : token;
  const dir = norm(ctx.cwd, dirPart || undefined);
  if (!dirs(ctx.files).has(dir)) return { value: input, options: [] };
  const matches = entries(ctx.files, dir)
    .filter(([name]) => name.startsWith(base))
    .map(([name, isDir]) => (isDir ? `${name}/` : name));
  const prefix = matches.length === 1 ? matches[0] : commonPrefix(matches);
  const completed = `${dirPart ? `${dirPart}/` : ""}${prefix || base}`;
  const value = [...parts.slice(0, -1), completed].join(" ") + (matches.length === 1 && !matches[0].endsWith("/") ? " " : "");
  return { value, options: matches.length > 1 ? matches : [] };
}

function commonPrefix(xs: string[]) {
  if (xs.length === 0) return "";
  let p = xs[0];
  for (const x of xs) while (!x.startsWith(p)) p = p.slice(0, -1);
  return p;
}
