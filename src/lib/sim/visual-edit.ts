import { applyEdit } from "./edit";
import { EDIT_KIND_LABEL, editKind, editPage, sizable, type EditTarget, type VisualChange } from "./visual";
import type { EditStyle, Plan } from "./types";

export type VisualResult =
  | { ok: true; plan: Plan; title: string; changes: string[]; focusPage?: string }
  | { ok: false; reply: string };

/**
 * Applies a visual edit. Text lands on the real plan field where one exists (a page's name, the
 * app name, a button label), so the Plan tab and the generated code change too. Emphasis and size
 * are stored per element and become CSS in theme.css.
 */
export function applyVisualChange(plan: Plan, target: EditTarget, change: VisualChange): VisualResult {
  const next = structuredClone(plan);
  const kind = editKind(target.editId);
  const pageId = editPage(target.editId, next) ?? target.pageId;
  const page = next.pages.find((p) => p.id === pageId);
  const changes: string[] = [];
  const label = EDIT_KIND_LABEL[kind].toLowerCase();
  let style: EditStyle = { ...(next.ui.styles?.[target.editId] ?? {}) };
  let text = change.text;
  let tone = change.tone;
  let size = change.size;
  let focusPage = pageId;

  // Element-aware shortcuts in the prompt, then anything else goes to the regular edit engine.
  const prompt = change.prompt?.trim();
  if (prompt) {
    const rename = prompt.match(/\b(?:rename(?: it)? to|call it|change (?:it|the text) to|say|should say|read)\s+["“]?([^"”]+?)["”]?[.!]?$/i);
    const shortcuts: [boolean, () => void][] = [
      [/\b(bigger|larger|huge|increase)\b/i.test(prompt), () => (size = "l")],
      [/\b(smaller|tiny|decrease)\b/i.test(prompt), () => (size = "s")],
      [/\b(highlight|stand out|pop|accent|emphasi[sz]e)\b/i.test(prompt), () => (tone = "accent")],
      [/\b(mute|muted|subtle|quieter|tone it down|grey|gray)\b/i.test(prompt), () => (tone = "muted")],
      [/\b(hide|remove it|get rid of it)\b/i.test(prompt), () => (text = "")],
      [!!rename, () => (text = rename![1].trim())],
    ];
    const matched = shortcuts.filter(([hit]) => hit);
    for (const [, apply] of matched) apply();
    if (matched.length === 0) {
      const res = applyEdit(next, prompt);
      if (!res.ok) return { ok: false, reply: res.reply };
      return { ok: true, plan: res.plan, title: `Visual edit: ${lower(res.title)}`, changes: res.changes, focusPage: res.focusPage ?? focusPage };
    }
  }

  if (text !== undefined && text !== (target.text ?? "")) {
    const before = target.text ?? "";
    const t = text.trim();
    if (t === "") {
      next.ui.labels = { ...(next.ui.labels ?? {}), [target.editId]: "" };
      changes.push(`Hid the ${before ? `“${before}” ` : ""}${label}`);
    } else if (kind === "app-name") {
      next.appName = t;
      changes.push(`Renamed the app to ${t}`);
    } else if ((kind === "nav" || kind === "heading") && page) {
      changes.push(`Renamed ${page.name} to ${t}`);
      page.name = t;
    } else if (kind === "text" && page && target.editId.startsWith("purpose-")) {
      page.purpose = t;
      changes.push(`Rewrote the ${page.name} description`);
    } else if (kind === "button" && page?.input) {
      changes.push(`Changed the button from “${page.input.cta}” to “${t}”`);
      page.input.cta = t;
    } else if (kind === "banner") {
      next.ui.banner = t;
      changes.push(`Changed the banner to “${t}”`);
    } else {
      next.ui.labels = { ...(next.ui.labels ?? {}), [target.editId]: t };
      changes.push(before ? `Changed “${before}” to “${t}”` : `Set the ${label} text to “${t}”`);
    }
    // Showing a hidden element again: its text lives on the plan field, so drop the empty label.
    if (t !== "" && next.ui.labels?.[target.editId] === "" && kind !== "stat" && kind !== "card") {
      next.ui.labels = Object.fromEntries(Object.entries(next.ui.labels).filter(([id]) => id !== target.editId));
    }
  }

  // Emphasis and size read as one change: "Made the “Queue” heading larger and accent-coloured".
  const looks: string[] = [];
  if (tone !== undefined && (tone ?? undefined) !== style.tone) {
    style = { ...style, tone: tone ?? undefined };
    looks.push(tone === "accent" ? "accent-coloured" : tone === "muted" ? "quieter" : "default colour");
  }
  if (size !== undefined && (size ?? "m") !== (style.size ?? "m") && sizable(kind)) {
    style = { ...style, size: size ?? undefined };
    looks.push(size === "l" ? "larger" : size === "s" ? "smaller" : "default size");
  }
  if (looks.length) {
    const shown = text !== undefined && text.trim() ? text.trim() : target.text;
    const what = shown ? `the “${shown.length > 28 ? `${shown.slice(0, 27)}…` : shown}” ${label}` : `the ${label}`;
    changes.push(`Made ${what} ${looks.join(" and ")}`);
  }
  const styles = { ...(next.ui.styles ?? {}) };
  if (style.tone || style.size) styles[target.editId] = { ...(style.tone ? { tone: style.tone } : {}), ...(style.size && style.size !== "m" ? { size: style.size } : {}) };
  else delete styles[target.editId];
  if (styles[target.editId] && !styles[target.editId].tone && !styles[target.editId].size) delete styles[target.editId];
  next.ui.styles = styles;

  if (changes.length === 0) return { ok: false, reply: "That element already looks like that." };
  if (kind === "nav" && page) focusPage = page.id;
  return { ok: true, plan: next, title: `Visual edit: ${lower(changes[0])}${changes.length > 1 ? ` and ${changes.length - 1} more` : ""}`, changes, focusPage };
}

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
