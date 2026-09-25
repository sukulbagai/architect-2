"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { yaml } from "@codemirror/lang-yaml";

/** Editor chrome and syntax colours come from CSS variables, so light and dark just work. */
const chrome = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--foreground)", fontSize: "12.5px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", lineHeight: "1.65" },
  ".cm-content": { caretColor: "var(--brand-text)", padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--subtle-foreground)", border: "none", paddingLeft: "8px" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--foreground) 4%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--brand) 22%, transparent) !important",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--brand-text)" },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--subtle-foreground)" },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: "var(--code-keyword)" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "var(--code-string)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--code-comment)", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--code-number)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--code-function)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--code-type)" },
  { tag: [t.tagName], color: "var(--code-tag)" },
  { tag: [t.attributeName, t.propertyName], color: "var(--code-attr)" },
  { tag: [t.heading], color: "var(--foreground)", fontWeight: "600" },
  { tag: [t.link, t.url], color: "var(--code-number)", textDecoration: "underline" },
  { tag: [t.punctuation, t.bracket, t.operator], color: "var(--muted-foreground)" },
]);

function languageFor(path: string) {
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) return [javascript({ jsx: true, typescript: /\.tsx?$/.test(path) })];
  if (/\.json$/.test(path)) return [json()];
  if (/\.md$/.test(path)) return [markdown()];
  if (/\.py$/.test(path)) return [python()];
  if (/\.html$/.test(path)) return [html()];
  if (/\.css$/.test(path)) return [css()];
  if (/\.ya?ml$/.test(path)) return [yaml()];
  return [];
}

export default function CodeEditor({
  path,
  value,
  onChange,
  readOnly,
}: {
  path: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  const extensions = useMemo(() => [chrome, syntaxHighlighting(highlight), EditorView.lineWrapping, ...languageFor(path)], [path]);
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      theme="none"
      height="100%"
      className="h-full"
      extensions={extensions}
      basicSetup={{ foldGutter: true, highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly, autocompletion: false }}
    />
  );
}
