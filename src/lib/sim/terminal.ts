import { hashString } from "../seeded";
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
};

export type TermResult = { lines: TermLine[]; cwd?: string; clear?: boolean };

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
  { name: "git", usage: "git status | git log --oneline", about: "Versions as commits" },
  { name: "npm", usage: "npm install | npm run dev | npm run build | npm test", about: "Install, run, build and test" },
  { name: "architect", usage: "architect deploy", about: "Deploy from the terminal" },
];

const line = (text: string, tone?: Tone, wait?: number): TermLine => ({ segs: [{ text, tone }], wait });
const blank = (wait?: number): TermLine => ({ segs: [{ text: "" }], wait });

function userSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "you";
}

export function shortSha(id: string) {
  return hashString(id).toString(16).padStart(8, "0").slice(0, 7);
}

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
  const sorted = [...ctx.versions].sort((a, b) => b.number - a.number);
  if (sub === "status") {
    return { lines: [line("On branch main"), line("nothing to commit, working tree clean")] };
  }
  if (sub === "log") {
    if (sorted.length === 0) return { lines: [line("fatal: your current branch 'main' does not have any commits yet", "error")] };
    return {
      lines: sorted.map((v) => ({
        segs: [
          { text: `${shortSha(v.id)} `, tone: "warning" },
          ...(v.current ? [{ text: "(HEAD -> main) ", tone: "info" as Tone }] : []),
          { text: `v${v.number} · ${v.summary}` },
        ],
      })),
    };
  }
  if (sub === "branch") return { lines: [{ segs: [{ text: "* " }, { text: "main", tone: "success" }] }] };
  if (sub === "diff") return { lines: [] };
  if (!sub) return { lines: [line("usage: git status | git log --oneline | git branch", "muted")] };
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
