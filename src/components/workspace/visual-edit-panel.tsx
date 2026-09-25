"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MousePointerClick, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EDIT_KIND_LABEL, editKind, sizable, type EditTarget, type VisualChange } from "@/lib/sim/visual";
import type { EditSize, EditTone, Plan } from "@/lib/sim/types";
import type { EditDraft } from "@/components/preview/editable";

function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; name?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex items-center rounded-lg bg-muted/70 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            aria-label={o.name ?? o.label}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-6 min-w-8 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              value === o.id && "bg-card text-foreground shadow-card dark:bg-accent",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Floats over the preview once an element is selected. Changes show in the app as a live draft;
 * Apply saves them as a version.
 */
export function VisualEditPanel({
  target,
  plan,
  onDraft,
  onApply,
  onCancel,
}: {
  target: EditTarget;
  plan: Plan;
  onDraft: (draft: EditDraft | null) => void;
  onApply: (change: VisualChange) => Promise<boolean>;
  onCancel: () => void;
}) {
  const kind = editKind(target.editId);
  const saved = plan.ui.styles?.[target.editId] ?? {};
  const [text, setText] = useState(target.text ?? "");
  const [tone, setTone] = useState<EditTone | "default">(saved.tone ?? "default");
  const [size, setSize] = useState<EditSize>(saved.size ?? "m");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);
  const page = plan.pages.find((p) => p.id === target.pageId);
  const hasText = kind !== "banner" || !!plan.ui.banner;

  const change: VisualChange = {};
  if (text !== (target.text ?? "")) change.text = text;
  if (tone !== (saved.tone ?? "default")) change.tone = tone === "default" ? null : tone;
  if (size !== (saved.size ?? "m")) change.size = size === "m" ? null : size;
  if (prompt.trim()) change.prompt = prompt.trim();
  const dirty = Object.keys(change).length > 0;

  useEffect(() => {
    textRef.current?.select();
  }, []);

  function draft(next: { text?: string; tone?: EditTone | "default"; size?: EditSize }) {
    const t = next.tone ?? tone;
    onDraft({
      editId: target.editId,
      text: next.text ?? text,
      tone: t === "default" ? null : t,
      size: next.size ?? size,
    });
  }

  async function apply() {
    if (!dirty || busy) return;
    setBusy(true);
    const ok = await onApply(change);
    if (!ok) setBusy(false);
  }

  return (
    <div
      className="absolute inset-x-3 bottom-3 z-20 animate-rise rounded-xl border border-border-strong bg-popover shadow-float md:inset-x-auto md:top-3 md:right-3 md:bottom-auto md:w-[300px]"
      role="dialog"
      aria-label="Edit element"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <MousePointerClick className="size-4 shrink-0 text-brand-text" />
          <span className="truncate">{EDIT_KIND_LABEL[kind]}</span>
          {page && <span className="truncate text-xs font-normal text-muted-foreground">on {page.name}</span>}
        </span>
        <Button size="icon-xs" variant="ghost" aria-label="Close" onClick={onCancel}>
          <X />
        </Button>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {hasText && (
          <div className="space-y-1.5">
            <label htmlFor="ve-text" className="text-xs text-muted-foreground">
              Text
            </label>
            <input
              id="ve-text"
              ref={textRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                draft({ text: e.target.value });
              }}
              onKeyDown={(e) => e.key === "Enter" && void apply()}
              maxLength={120}
              className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {text === "" && target.text && <p className="text-[11px] text-muted-foreground">Leaving it empty hides this element.</p>}
          </div>
        )}
        <Chips
          label="Emphasis"
          value={tone}
          options={[
            { id: "default", label: "Default" },
            { id: "accent", label: "Accent" },
            { id: "muted", label: "Muted" },
          ]}
          onChange={(v) => {
            setTone(v);
            draft({ tone: v });
          }}
        />
        {sizable(kind) && (
          <Chips
            label="Size"
            value={size}
            options={[
              { id: "s", label: "S", name: "Small" },
              { id: "m", label: "M", name: "Medium" },
              { id: "l", label: "L", name: "Large" },
            ]}
            onChange={(v) => {
              setSize(v);
              draft({ size: v });
            }}
          />
        )}
      </div>

      <div className="border-t border-border px-3.5 py-3">
        <label htmlFor="ve-prompt" className="sr-only">
          Describe a change to this element
        </label>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background pr-1 pl-2.5 focus-within:border-ring">
          <input
            id="ve-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void apply()}
            placeholder="Or describe a change to this element…"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {prompt.trim() && (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ArrowUp className="size-3.5" />
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void apply()} disabled={!dirty || busy}>
            {busy && <Loader2 className="animate-spin" />}
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
