"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Menu, X } from "lucide-react";
import { hashString } from "@/lib/seeded";
import { APP_THEMES } from "@/lib/sim/themes";
import { EDIT_KIND_LABEL, editKind } from "@/lib/sim/visual";
import type { Issue, Plan } from "@/lib/sim/types";
import { AppLogContext, PageIcon, type AppLog } from "./bits";
import { EditProvider, useEditable, type EditDraft } from "./editable";
import { PageBody } from "./pages";

type Box = { top: number; left: number; width: number; height: number; label: string };

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  const id = (el as HTMLElement).dataset.edit ?? "";
  return { top: r.top, left: r.left, width: r.width, height: r.height, label: EDIT_KIND_LABEL[editKind(id)] };
}

/** The text a visual edit changes: the element's labelled part if it has one, else all of it. */
function textOf(el: HTMLElement) {
  return (el.querySelector("[data-edit-text]")?.textContent ?? el.textContent ?? "").trim();
}

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Renders a generated app from its plan. It runs inside an iframe in the Workspace (and later on
 * live URLs), talks to the parent with postMessage, and never calls anything outside this app.
 */
export function PreviewApp({ plan, initialPage, embedded }: { plan: Plan; initialPage?: string; embedded?: boolean }) {
  const theme = APP_THEMES[plan.ui.theme] ?? APP_THEMES.studio;
  const [pageId, setPageId] = useState(initialPage && plan.pages.some((p) => p.id === initialPage) ? initialPage : plan.pages[0]?.id);
  const [navOpen, setNavOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hover, setHover] = useState<Box | null>(null);
  const [picked, setPicked] = useState<Box | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const pickedEl = useRef<HTMLElement | null>(null);
  const page = plan.pages.find((p) => p.id === pageId) ?? plan.pages[0];
  const issue = plan.issues?.find((i) => i.pageId === page?.id);

  const post = useCallback(
    (data: Record<string, unknown>) => {
      if (embedded) window.parent.postMessage(data, window.location.origin);
    },
    [embedded],
  );
  const log = useCallback<AppLog>((level, message) => post({ type: "architect:log", level, message }), [post]);

  useEffect(() => {
    post({ type: "architect:route", page: page?.id });
    if (!page) return;
    const route = page.id === plan.pages[0]?.id ? "/" : `/${page.id}`;
    log("info", `GET ${route} 200 · ${18 + (hashString(page.id) % 40)}ms`);
    const c = plan.data.find((d) => d.id === page.collection);
    if (c && page.kind !== "settings") log("info", `GET /api/collections/${c.id} ${issue ? "200 · still loading on first render" : `200 · ${12 + (hashString(c.id) % 30)}ms · ${c.rows.length} rows`}`);
    if (issue) post({ type: "architect:error", issueId: issue.id, pageId: page.id });
  }, [page, plan.pages, plan.data, issue, post, log]);

  useEffect(() => {
    if (!embedded) return;
    const ready = () =>
      window.parent.postMessage({ type: "architect:ready", pages: plan.pages.map((p) => ({ id: p.id, name: p.name })) }, window.location.origin);
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (d?.type === "architect:navigate" && typeof d.page === "string") setPageId(d.page);
      // The Workspace may start listening after this frame is already up, so it can ask again.
      if (d?.type === "architect:ping") ready();
      if (d?.type === "architect:select-mode") {
        setSelecting(!!d.on);
        setHover(null);
        setPicked(null);
        setDraft(null);
        pickedEl.current = null;
      }
      if (d?.type === "architect:deselect") {
        setPicked(null);
        setDraft(null);
        pickedEl.current = null;
      }
      if (d?.type === "architect:draft-edit") setDraft(d.draft ?? null);
    }
    window.addEventListener("message", onMessage);
    ready();
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, plan.pages]);

  // Workspace shortcuts keep working while focus is inside the app.
  useEffect(() => {
    if (!embedded) return;
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && ["k", "j", "\\"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        post({ type: "architect:key", key: e.key, meta: true });
      } else if (!meta && !e.altKey && !isTyping(e.target) && (e.key === "v" || e.key === "?" || (e.key === "/" && e.shiftKey))) {
        post({ type: "architect:key", key: e.key === "v" ? "v" : "?", meta: false });
      } else if (e.key === "Escape" && selecting) {
        post({ type: "architect:select-cancel" });
        setSelecting(false);
        setHover(null);
        setPicked(null);
        setDraft(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded, post, selecting]);

  // Select mode: hovering outlines editable elements; a click selects one and never reaches the app.
  useEffect(() => {
    if (!selecting) return;
    const find = (t: EventTarget | null) => (t instanceof Element ? (t.closest("[data-edit]") as HTMLElement | null) : null);
    const over = (e: PointerEvent) => {
      const el = find(e.target);
      setHover(el ? boxOf(el) : null);
    };
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const click = (e: MouseEvent) => {
      block(e);
      const el = find(e.target);
      if (!el || !page) return;
      pickedEl.current = el;
      setPicked(boxOf(el));
      setDraft(null);
      const id = el.dataset.edit!;
      post({ type: "architect:selected", target: { editId: id, kind: editKind(id), pageId: page.id, text: textOf(el) } });
    };
    const reflow = () => {
      setHover(null);
      if (pickedEl.current?.isConnected) setPicked(boxOf(pickedEl.current));
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("click", click, true);
    document.addEventListener("mousedown", block, true);
    document.addEventListener("submit", block, true);
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("mousedown", block, true);
      document.removeEventListener("submit", block, true);
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  }, [selecting, page, post]);

  // A draft can change the selected element's size, so measure it again after it renders.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (pickedEl.current?.isConnected) setPicked(boxOf(pickedEl.current));
    });
    return () => cancelAnimationFrame(id);
  }, [draft]);

  if (!page) return null;
  const collection = plan.data.find((c) => c.id === page.collection);
  const agent = plan.agents.find((a) => a.id === page.agent);
  const v = theme.vars;

  const style = {
    "--a-bg": v.bg,
    "--a-surface": v.surface,
    "--a-sunken": v.sunken,
    "--a-text": v.text,
    "--a-muted": v.muted,
    "--a-border": v.border,
    "--a-accent": v.accent,
    "--a-accent-text": v.accentText,
    "--a-accent-soft": v.accentSoft,
    "--a-sidebar": v.sidebar,
    "--a-success": v.success,
    "--a-warning": v.warning,
    "--a-danger": v.danger,
    "--a-info": v.info,
    "--a-radius": `${theme.radius}px`,
    "--a-bw": `${theme.borderWidth}px`,
    "--a-shadow": theme.shadow,
    "--a-heading-font": theme.headingFont === "serif" ? "var(--font-instrument-serif), Georgia, serif" : "var(--font-geist-sans), system-ui, sans-serif",
    "--a-heading-case": theme.headingCase === "upper" ? "uppercase" : "none",
    colorScheme: theme.dark ? "dark" : "light",
  } as React.CSSProperties;

  return (
    <EditProvider plan={plan} draft={draft}>
      <AppLogContext.Provider value={log}>
        <div className="arch-app" data-theme={theme.id} data-selecting={selecting ? "" : undefined} style={style}>
          <style>{CSS}</style>
          <Shell plan={plan} page={page} navOpen={navOpen} setNavOpen={setNavOpen} setPageId={setPageId}>
            {issue ? <CrashState issue={issue} /> : <PageBody key={page.id} plan={plan} page={page} collection={collection} agent={agent} />}
          </Shell>
          {selecting && hover && !(picked && hover.top === picked.top && hover.left === picked.left) && <Outline box={hover} kind="hover" />}
          {picked && <Outline box={picked} kind="picked" />}
        </div>
      </AppLogContext.Provider>
    </EditProvider>
  );
}

function Outline({ box, kind }: { box: Box; kind: "hover" | "picked" }) {
  return (
    <div
      className={kind === "hover" ? "a-edit-hover" : "a-edit-picked"}
      style={{ top: box.top - 3, left: box.left - 3, width: box.width + 6, height: box.height + 6 }}
      data-below={box.top < 24 ? "" : undefined}
      aria-hidden="true"
    >
      <span>{box.label}</span>
    </div>
  );
}

function Shell({
  plan,
  page,
  navOpen,
  setNavOpen,
  setPageId,
  children,
}: {
  plan: Plan;
  page: Plan["pages"][number];
  navOpen: boolean;
  setNavOpen: (fn: (o: boolean) => boolean) => void;
  setPageId: (id: string) => void;
  children: React.ReactNode;
}) {
  const ed = useEditable();
  const name = ed("app-name", plan.appName);
  const banner = ed("banner", plan.ui.banner ?? "");
  const title = ed(`title-${page.id}`, page.name);
  const purpose = ed(`purpose-${page.id}`, page.purpose);
  const initials = plan.appName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <nav className="space-y-0.5">
      {plan.pages.map((p) => {
        const item = ed(`nav-${p.id}`, p.name);
        if (item.hidden) return null;
        return (
          <button
            key={p.id}
            type="button"
            {...item.attrs}
            onClick={() => {
              setPageId(p.id);
              setNavOpen(() => false);
            }}
            aria-current={p.id === page.id ? "page" : undefined}
            className="a-nav-item"
            style={{ ...item.style, opacity: item.faded ? 0.4 : undefined }}
          >
            <PageIcon name={p.icon} className="size-4 shrink-0" />
            <span className="truncate" data-edit-text="">
              {item.text || p.name}
            </span>
          </button>
        );
      })}
    </nav>
  );

  const brand = (className: string) =>
    name.hidden ? null : (
      <span {...name.attrs} className={className} style={name.style}>
        {name.text || plan.appName}
      </span>
    );

  return (
    <>
      <aside className="a-sidebar hidden md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="a-logo">{initials}</span>
          {brand("a-heading truncate text-[15px] font-semibold")}
        </div>
        {nav}
        <p className="a-muted mt-auto px-2 text-[11px]">Built with Architect</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="a-topbar flex md:hidden">
          <span className="flex items-center gap-2">
            <span className="a-logo">{initials}</span>
            {brand("a-heading text-sm font-semibold")}
          </span>
          <button type="button" className="a-icon-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">
            {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {navOpen && <div className="a-mobile-nav md:hidden">{nav}</div>}

        {plan.ui.banner && !banner.hidden && (
          <div {...banner.attrs} className="a-banner" style={banner.style}>
            {banner.text || plan.ui.banner}
          </div>
        )}

        <main className={plan.ui.compact ? "px-4 py-4 md:px-6" : "px-4 py-5 md:px-8 md:py-7"}>
          <header className="mb-5">
            {!title.hidden && (
              <h1 {...title.attrs} className="a-heading w-fit max-w-full text-2xl font-semibold md:text-[28px]" style={{ ...title.style, opacity: title.faded ? 0.4 : undefined }}>
                {title.text || page.name}
              </h1>
            )}
            {!purpose.hidden && (
              <p {...purpose.attrs} className="a-muted mt-1 w-fit max-w-full text-sm" style={{ ...purpose.style, opacity: purpose.faded ? 0.4 : undefined }}>
                {purpose.text || page.purpose}
              </p>
            )}
          </header>
          {children}
        </main>
      </div>
    </>
  );
}

/** The generated app's own error boundary: what a visitor would see when a page crashes. */
function CrashState({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="a-card mx-auto max-w-lg px-6 py-8 text-center">
      <span className="a-crash-icon">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="a-heading mt-4 text-lg font-semibold">Something went wrong on this page</h2>
      <p className="a-muted mx-auto mt-1 max-w-sm text-sm">The page stopped while loading its data. Everything else in the app still works.</p>
      <button type="button" className="a-btn a-btn-ghost mt-5" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Details
        <ChevronDown className="size-3.5" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && (
        <pre className="a-sunken mt-4 overflow-x-auto p-3 text-left font-mono text-[11.5px] leading-relaxed" style={{ color: "var(--a-danger)" }}>
          {issue.title}
          {"\n"}
          <span className="a-muted">    {issue.stack[0]}</span>
        </pre>
      )}
    </div>
  );
}

const CSS = `
.arch-app { display:flex; min-height:100dvh; background:var(--a-bg); color:var(--a-text); font-family:var(--font-geist-sans), system-ui, sans-serif; font-size:14px; -webkit-font-smoothing:antialiased; }
.arch-app .a-heading { font-family:var(--a-heading-font); text-transform:var(--a-heading-case); letter-spacing:-0.02em; }
.arch-app[data-theme="paper"] .a-heading { font-weight:400; letter-spacing:-0.01em; }
.arch-app[data-theme="paper"] h1.a-heading { font-size:32px; }
.arch-app .a-muted { color:var(--a-muted); }
.arch-app .a-sidebar { width:232px; flex-shrink:0; flex-direction:column; padding:18px 12px; background:var(--a-sidebar); border-right:var(--a-bw) solid var(--a-border); position:sticky; top:0; height:100dvh; }
.arch-app .a-topbar { align-items:center; justify-content:space-between; padding:10px 16px; background:var(--a-sidebar); border-bottom:var(--a-bw) solid var(--a-border); }
.arch-app .a-mobile-nav { padding:8px 12px; background:var(--a-sidebar); border-bottom:var(--a-bw) solid var(--a-border); }
.arch-app .a-logo { display:inline-flex; width:28px; height:28px; border-radius:calc(var(--a-radius) - 2px); align-items:center; justify-content:center; background:var(--a-accent); color:var(--a-accent-text); font-size:11px; font-weight:700; flex-shrink:0; }
.arch-app .a-nav-item { display:flex; width:100%; align-items:center; gap:10px; height:34px; padding:0 10px; border-radius:calc(var(--a-radius) - 2px); color:var(--a-muted); font-size:13.5px; text-align:left; }
.arch-app .a-nav-item:hover { color:var(--a-text); background:color-mix(in oklab, var(--a-text) 5%, transparent); }
.arch-app .a-nav-item[aria-current="page"] { background:var(--a-accent-soft); color:var(--a-accent); font-weight:600; }
.arch-app[data-theme="bold"] .a-nav-item[aria-current="page"] { background:var(--a-accent); color:var(--a-accent-text); border:2px solid var(--a-border); }
.arch-app .a-card { background:var(--a-surface); border:var(--a-bw) solid var(--a-border); border-radius:var(--a-radius); box-shadow:var(--a-shadow); }
.arch-app .a-sunken { background:var(--a-sunken); border-radius:calc(var(--a-radius) - 2px); }
.arch-app .a-banner { padding:9px 20px; background:var(--a-accent); color:var(--a-accent-text); font-size:13px; font-weight:600; text-align:center; }
.arch-app .a-btn { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 14px; border-radius:calc(var(--a-radius) - 2px); background:var(--a-accent); color:var(--a-accent-text); font-size:13px; font-weight:600; border:var(--a-bw) solid transparent; white-space:nowrap; }
.arch-app .a-btn:disabled { opacity:.5; cursor:not-allowed; }
.arch-app[data-theme="bold"] .a-btn { border-color:var(--a-border); box-shadow:2px 2px 0 var(--a-border); }
.arch-app .a-btn-ghost { background:transparent; color:var(--a-text); border-color:var(--a-border); }
.arch-app .a-icon-btn { display:inline-flex; width:30px; height:30px; align-items:center; justify-content:center; border-radius:8px; color:var(--a-muted); }
.arch-app .a-icon-btn:hover { background:var(--a-sunken); color:var(--a-text); }
.arch-app .a-input { height:34px; padding:0 12px; border-radius:calc(var(--a-radius) - 2px); background:var(--a-surface); border:var(--a-bw) solid var(--a-border); color:var(--a-text); font-size:13px; outline:none; }
.arch-app textarea.a-input { height:auto; }
.arch-app .a-input:focus-within, .arch-app .a-input:focus { border-color:var(--a-accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--a-accent) 18%, transparent); }
.arch-app .a-chip { height:28px; padding:0 11px; border-radius:999px; border:var(--a-bw) solid var(--a-border); background:var(--a-surface); color:var(--a-muted); font-size:12.5px; }
.arch-app .a-chip[aria-pressed="true"] { background:var(--a-text); color:var(--a-bg); border-color:var(--a-text); }
.arch-app .a-pill { display:inline-flex; align-items:center; height:21px; padding:0 8px; border-radius:999px; font-size:11.5px; font-weight:600; white-space:nowrap; background:color-mix(in oklab, var(--a-muted) 14%, transparent); color:var(--a-muted); }
.arch-app .a-pill[data-tone="danger"] { background:color-mix(in oklab, var(--a-danger) 14%, transparent); color:var(--a-danger); }
.arch-app .a-pill[data-tone="success"] { background:color-mix(in oklab, var(--a-success) 15%, transparent); color:var(--a-success); }
.arch-app .a-pill[data-tone="warning"] { background:color-mix(in oklab, var(--a-warning) 16%, transparent); color:var(--a-warning); }
.arch-app .a-pill[data-tone="info"] { background:color-mix(in oklab, var(--a-info) 14%, transparent); color:var(--a-info); }
.arch-app .a-tag { display:inline-flex; height:21px; align-items:center; padding:0 7px; border-radius:6px; background:var(--a-sunken); font-size:12px; }
.arch-app .a-avatar { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; font-weight:700; flex-shrink:0; background:oklch(0.9 0.06 var(--h)); color:oklch(0.35 0.1 var(--h)); }
.arch-app[data-theme="midnight"] .a-avatar { background:oklch(0.36 0.07 var(--h)); color:oklch(0.92 0.05 var(--h)); }
.arch-app .a-meter { display:inline-block; height:6px; width:64px; border-radius:999px; background:var(--a-sunken); overflow:hidden; }
.arch-app .a-meter > span { display:block; height:100%; border-radius:999px; background:var(--a-accent); }
.arch-app .a-table { border-collapse:collapse; font-size:13px; }
.arch-app .a-table th { text-align:left; font-weight:500; font-size:11.5px; color:var(--a-muted); padding:10px 14px; border-bottom:var(--a-bw) solid var(--a-border); background:var(--a-sunken); white-space:nowrap; }
.arch-app .a-table td { padding:11px 14px; border-bottom:1px solid var(--a-border); white-space:nowrap; max-width:280px; overflow:hidden; text-overflow:ellipsis; }
.arch-app .a-table[data-compact] td { padding:7px 14px; }
.arch-app .a-table tbody tr { cursor:pointer; }
.arch-app .a-table tbody tr:hover { background:color-mix(in oklab, var(--a-accent) 5%, transparent); }
.arch-app .a-table tbody tr:last-child td { border-bottom:0; }
.arch-app .a-drawer { position:fixed; top:0; right:0; bottom:0; width:min(380px, 92vw); background:var(--a-surface); border-left:var(--a-bw) solid var(--a-border); box-shadow:-12px 0 32px -12px rgba(0,0,0,.18); padding:20px; overflow-y:auto; z-index:20; animation:a-slide .22s ease-out; }
@keyframes a-slide { from { transform:translateX(16px); opacity:0; } to { transform:none; opacity:1; } }
.arch-app .a-list-item { display:block; width:100%; text-align:left; padding:11px 14px; border-bottom:1px solid var(--a-border); }
.arch-app .a-list-item:last-child { border-bottom:0; }
.arch-app .a-list-item[aria-current="true"] { background:var(--a-accent-soft); }
.arch-app .a-trace { display:inline-flex; max-width:100%; align-items:center; gap:6px; height:24px; padding:0 9px; border-radius:999px; background:var(--a-surface); border:1px solid var(--a-border); font-size:11.5px; font-weight:500; white-space:nowrap; overflow:hidden; }
.arch-app .a-trace > * { flex-shrink:0; }
.arch-app .a-trace > .a-muted { flex-shrink:1; overflow:hidden; text-overflow:ellipsis; }
.arch-app .a-caret { display:inline-block; width:7px; height:14px; margin-left:2px; vertical-align:-2px; background:var(--a-accent); animation:a-blink 1s steps(1) infinite; }
@keyframes a-blink { 50% { opacity:0; } }
.arch-app .a-bot { display:inline-flex; width:26px; height:26px; flex-shrink:0; align-items:center; justify-content:center; border-radius:999px; background:var(--a-accent-soft); color:var(--a-accent); }
.arch-app .a-bubble { padding:9px 13px; border-radius:14px 14px 4px 14px; background:var(--a-accent); color:var(--a-accent-text); }
.arch-app .a-step { display:inline-flex; width:22px; height:22px; flex-shrink:0; align-items:center; justify-content:center; border-radius:999px; font-size:11px; font-weight:600; border:1px solid var(--a-border); color:var(--a-muted); }
.arch-app .a-step[data-status="done"] { background:var(--a-accent); border-color:var(--a-accent); color:var(--a-accent-text); }
.arch-app .a-step[data-status="active"] { border-color:var(--a-accent); color:var(--a-accent); }
.arch-app .a-switch { position:relative; width:34px; height:20px; border-radius:999px; background:var(--a-border); flex-shrink:0; transition:background .15s; }
.arch-app .a-switch > span { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:999px; background:#fff; transition:transform .15s; box-shadow:0 1px 2px rgba(0,0,0,.2); }
.arch-app .a-switch[aria-checked="true"] { background:var(--a-accent); }
.arch-app .a-switch[aria-checked="true"] > span { transform:translateX(14px); }
.arch-app .a-crash-icon { display:inline-flex; width:44px; height:44px; align-items:center; justify-content:center; border-radius:999px; background:color-mix(in oklab, var(--a-danger) 12%, transparent); color:var(--a-danger); }
.arch-app[data-selecting] [data-edit] { cursor:pointer; }
.arch-app .a-edit-hover, .arch-app .a-edit-picked { position:fixed; z-index:60; pointer-events:none; border-radius:6px; }
.arch-app .a-edit-hover { outline:1.5px dashed #cf4318; background:rgba(207,67,24,.04); }
.arch-app .a-edit-picked { outline:2px solid #cf4318; }
.arch-app .a-edit-hover > span, .arch-app .a-edit-picked > span { position:absolute; left:-2px; top:-21px; height:17px; padding:0 6px; border-radius:4px; background:#cf4318; color:#fff; font:500 10.5px/17px var(--font-geist-mono), ui-monospace, monospace; letter-spacing:.02em; white-space:nowrap; }
.arch-app [data-below] > span { top:auto; bottom:-21px; }
`;
