"use client";

import { createContext, useContext } from "react";
import { editKind, sizePx } from "@/lib/sim/visual";
import type { EditStyle, Plan } from "@/lib/sim/types";

/**
 * Visual-edit overrides for the generated app. Every editable element gets a `data-edit` id; its
 * text and look come from the plan, or from the draft the Workspace sends while you're editing.
 */

export type EditDraft = { editId: string; text?: string; tone?: EditStyle["tone"] | null; size?: EditStyle["size"] | null };

type Ctx = { labels: Record<string, string>; styles: Record<string, EditStyle>; draft: EditDraft | null };

const EditContext = createContext<Ctx>({ labels: {}, styles: {}, draft: null });

export function EditProvider({ plan, draft, children }: { plan: Plan; draft: EditDraft | null; children: React.ReactNode }) {
  return <EditContext.Provider value={{ labels: plan.ui.labels ?? {}, styles: plan.ui.styles ?? {}, draft }}>{children}</EditContext.Provider>;
}

/** The inline style for an element's tone and size. Buttons and stats style their own parts. */
export function toneStyle(id: string, s: EditStyle): React.CSSProperties {
  const kind = editKind(id);
  const out: React.CSSProperties = {};
  if (kind === "button") {
    if (s.tone === "muted") Object.assign(out, { background: "var(--a-sunken)", color: "var(--a-text)", borderColor: "var(--a-border)" });
    if (s.tone === "accent") out.boxShadow = "0 0 0 3px var(--a-accent-soft)";
    if (s.size) Object.assign(out, { fontSize: sizePx(kind, s.size), height: s.size === "l" ? 40 : s.size === "s" ? 28 : undefined });
    return out;
  }
  if (kind === "banner") {
    // A banner is already accent-coloured; "muted" makes it a quiet strip instead.
    if (s.tone === "muted") Object.assign(out, { background: "var(--a-sunken)", color: "var(--a-text)", borderBottom: "var(--a-bw) solid var(--a-border)" });
    return out;
  }
  if (s.tone) out.color = s.tone === "accent" ? "var(--a-accent)" : "var(--a-muted)";
  if (s.size && kind !== "stat") out.fontSize = sizePx(kind, s.size);
  return out;
}

/**
 * `ed(id, fallback)` gives an element its edit attributes, the text to show (a label override, or
 * the draft while editing) and its style. `hidden` is true when a visual edit hid it.
 */
export function useEditable() {
  const ctx = useContext(EditContext);
  return (id: string, fallback: string) => {
    const draft = ctx.draft?.editId === id ? ctx.draft : null;
    const text = draft?.text !== undefined ? draft.text : ctx.labels[id] ?? fallback;
    const saved = ctx.styles[id] ?? {};
    const style: EditStyle = {
      tone: draft && draft.tone !== undefined ? draft.tone ?? undefined : saved.tone,
      size: draft && draft.size !== undefined ? draft.size ?? undefined : saved.size,
    };
    return {
      attrs: { "data-edit": id },
      text,
      hidden: text === "" && !draft,
      /** When a draft empties the text, keep the element selectable but faded. */
      faded: text === "" && !!draft,
      style: toneStyle(id, style),
      raw: style,
    };
  };
}
