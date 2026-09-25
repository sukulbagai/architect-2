import type { EditSize, EditTone, Plan } from "./types";

/**
 * Visual edits: click an element in the preview, change its text, emphasis or size. Every
 * editable element carries a `data-edit` id; this module is the shared vocabulary for the preview,
 * the code generator and the server.
 *
 *   app-name · nav-<page> · title-<page> · purpose-<page> · cta-<page> · stat-<page>-<n>
 *   banner · card-<page>-<n>
 */

export type EditKind = "app-name" | "nav" | "heading" | "text" | "button" | "stat" | "banner" | "card";

export type EditTarget = { editId: string; kind?: string; pageId?: string; text?: string };

export type VisualChange = { text?: string; tone?: EditTone | null; size?: EditSize | null; prompt?: string };

export function editKind(editId: string): EditKind {
  if (editId === "app-name") return "app-name";
  if (editId === "banner") return "banner";
  const prefix = editId.split("-")[0];
  return (
    ({ nav: "nav", title: "heading", purpose: "text", cta: "button", stat: "stat", card: "card" } as const)[prefix as "nav"] ?? "text"
  );
}

export const EDIT_KIND_LABEL: Record<EditKind, string> = {
  "app-name": "App name",
  nav: "Nav item",
  heading: "Heading",
  text: "Text",
  button: "Button",
  stat: "Stat",
  banner: "Banner",
  card: "Card heading",
};

/** Headings, buttons and stats can change size; the rest only change text and emphasis. */
export function sizable(kind: EditKind) {
  return kind === "heading" || kind === "button" || kind === "stat" || kind === "card" || kind === "app-name";
}

/** Font sizes in px for each size step, by kind. `m` is the default look. */
export function sizePx(kind: EditKind, size: EditSize) {
  const scale: Record<string, [number, number, number]> = {
    heading: [22, 28, 36],
    button: [12, 13, 15],
    stat: [18, 24, 32],
    card: [13, 14, 17],
    "app-name": [13, 15, 18],
  };
  const [s, m, l] = scale[kind] ?? [12.5, 14, 16];
  return size === "s" ? s : size === "l" ? l : m;
}

/** The page an edit id belongs to, when it names one. */
export function editPage(editId: string, plan: Plan) {
  const rest = editId.replace(/^(nav|title|purpose|cta|stat|card)-/, "");
  return plan.pages.find((p) => rest === p.id || rest.startsWith(`${p.id}-`))?.id;
}
