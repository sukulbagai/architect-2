"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { APP_THEMES } from "@/lib/sim/themes";
import type { Plan } from "@/lib/sim/types";
import { PageIcon } from "./bits";
import { PageBody } from "./pages";

/**
 * Renders a generated app from its plan. It runs inside an iframe in the Workspace (and later on
 * live URLs), talks to the parent with postMessage, and never calls anything outside this app.
 */
export function PreviewApp({ plan, initialPage, embedded }: { plan: Plan; initialPage?: string; embedded?: boolean }) {
  const theme = APP_THEMES[plan.ui.theme] ?? APP_THEMES.studio;
  const [pageId, setPageId] = useState(initialPage && plan.pages.some((p) => p.id === initialPage) ? initialPage : plan.pages[0]?.id);
  const [navOpen, setNavOpen] = useState(false);
  const page = plan.pages.find((p) => p.id === pageId) ?? plan.pages[0];

  useEffect(() => {
    if (!embedded) return;
    window.parent.postMessage({ type: "architect:route", page: page?.id }, window.location.origin);
  }, [page?.id, embedded]);

  useEffect(() => {
    if (!embedded) return;
    const ready = () =>
      window.parent.postMessage({ type: "architect:ready", pages: plan.pages.map((p) => ({ id: p.id, name: p.name })) }, window.location.origin);
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "architect:navigate" && typeof e.data.page === "string") setPageId(e.data.page);
      // The Workspace may start listening after this frame is already up, so it can ask again.
      if (e.data?.type === "architect:ping") ready();
    }
    window.addEventListener("message", onMessage);
    ready();
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, plan.pages]);

  if (!page) return null;
  const collection = plan.data.find((c) => c.id === page.collection);
  const agent = plan.agents.find((a) => a.id === page.agent);
  const v = theme.vars;
  const initials = plan.appName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

  const nav = (
    <nav className="space-y-0.5">
      {plan.pages.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            setPageId(p.id);
            setNavOpen(false);
          }}
          aria-current={p.id === page.id ? "page" : undefined}
          className="a-nav-item"
        >
          <PageIcon name={p.icon} className="size-4 shrink-0" />
          <span className="truncate">{p.name}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="arch-app" data-theme={theme.id} style={style}>
      <style>{CSS}</style>
      <aside className="a-sidebar hidden md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <span className="a-logo">{initials}</span>
          <span className="a-heading truncate text-[15px] font-semibold">{plan.appName}</span>
        </div>
        {nav}
        <p className="a-muted mt-auto px-2 text-[11px]">Built with Architect</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="a-topbar flex md:hidden">
          <span className="flex items-center gap-2">
            <span className="a-logo">{initials}</span>
            <span className="a-heading text-sm font-semibold">{plan.appName}</span>
          </span>
          <button type="button" className="a-icon-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">
            {navOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {navOpen && <div className="a-mobile-nav md:hidden">{nav}</div>}

        {plan.ui.banner && <div className="a-banner">{plan.ui.banner}</div>}

        <main className={plan.ui.compact ? "px-4 py-4 md:px-6" : "px-4 py-5 md:px-8 md:py-7"}>
          <header className="mb-5">
            <h1 className="a-heading text-2xl font-semibold md:text-[28px]">{page.name}</h1>
            <p className="a-muted mt-1 text-sm">{page.purpose}</p>
          </header>
          <PageBody key={page.id} plan={plan} page={page} collection={collection} agent={agent} />
        </main>
      </div>
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
`;
