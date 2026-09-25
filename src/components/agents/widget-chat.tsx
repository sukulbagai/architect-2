"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useTyping } from "@/components/preview/bits";

/**
 * The embeddable chat widget. It sits on other people's sites, so it has its own small palette
 * (like the generated-app preview) instead of Architect's theme tokens: white, ink and the
 * colour the owner picked.
 */

type Msg = { id: number; role: "agent" | "user"; text: string; typing?: boolean };

/** Black or white, whichever reads better on the accent colour. */
export function onAccent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
}

let seq = 0;

function Typed({ text, onDone }: { text: string; onDone: () => void }) {
  const t = useTyping(text, true);
  const done = t.done;
  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);
  return <>{t.text}</>;
}

export function WidgetChat({
  name,
  greeting,
  color,
  send,
  preview = false,
  className = "",
}: {
  name: string;
  greeting: string;
  color: string;
  /** Omitted in the Deploy tab's preview, where the input is only for show. */
  send?: (text: string, turn: number) => Promise<{ ok: true; output: string } | { ok: false; error: string }>;
  preview?: boolean;
  className?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const fg = onAccent(color);
  const turns = messages.filter((m) => m.role === "user").length;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = text.trim();
    if (!input || busy || !send) return;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { id: ++seq, role: "user", text: input }]);
    try {
      const res = await send(input, turns);
      setMessages((m) => [...m, { id: ++seq, role: "agent", text: res.ok ? res.output : res.error, typing: res.ok }]);
    } catch {
      setMessages((m) => [...m, { id: ++seq, role: "agent", text: "Something went wrong. Please try again in a moment." }]);
    }
    setBusy(false);
  }

  return (
    <div className={`flex h-full flex-col overflow-hidden bg-white text-[#17160f] ${className}`} style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}>
      <div className="flex shrink-0 items-center gap-2.5 px-4 py-3" style={{ background: color, color: fg }}>
        <span className="flex size-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: fg === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)" }} aria-hidden="true">
          {name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-[11px] opacity-80">Usually replies in a few seconds</p>
        </div>
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[#f7f7f5] px-3.5 py-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[13px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.06)]">{greeting}</div>
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ background: color, color: fg }}>
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              {m.typing ? <Typed text={m.text} onDone={() => setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, typing: false } : x)))} /> : m.text}
            </div>
          ),
        )}
        {busy && (
          <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-white px-3 py-2 text-[12px] text-[#6b6a62] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" role="status">
            <Loader2 className="size-3 animate-spin" />
            {name} is typing…
          </div>
        )}
      </div>
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-[#e7e6e0] bg-white p-2.5">
        <label htmlFor={`widget-${name}`} className="sr-only">
          Message {name}
        </label>
        <input
          id={`widget-${name}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question…"
          disabled={preview}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-full border border-[#e7e6e0] bg-[#fafaf8] px-3.5 text-[13px] text-[#17160f] outline-none placeholder:text-[#9a998f] focus:border-[#b9b8ae]"
        />
        <button
          type="submit"
          disabled={preview || busy || !text.trim()}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
          style={{ background: color, color: fg }}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      <p className="shrink-0 bg-white pb-2 text-center text-[10px] text-[#9a998f]">Built with Architect</p>
    </div>
  );
}
