/**
 * Conventional-commit messages for changes, e.g. "style(ui): switch to the Midnight theme".
 * `feat` for added things, `style` for theme and visual changes, `fix` for Fix it, `chore` otherwise.
 */

const IMPERATIVE: Record<string, string> = {
  added: "add",
  applied: "apply",
  changed: "change",
  connected: "connect",
  fixed: "fix",
  gave: "give",
  guarded: "guard",
  hid: "hide",
  made: "make",
  moved: "move",
  removed: "remove",
  renamed: "rename",
  reset: "reset",
  restored: "restore",
  rewrote: "rewrite",
  set: "set",
  switched: "switch",
  updated: "update",
};

function imperative(sentence: string) {
  return sentence
    .replace(/^Visual edit:\s*/i, "")
    .replace(/^You edited/i, "edit")
    .replace(/(^|\band )(\w+)/g, (m, lead: string, word: string) => {
      const verb = IMPERATIVE[word.toLowerCase()];
      return verb ? `${lead}${verb}` : m;
    })
    .replace(/[.!]+$/, "")
    .replace(/^./, (c) => c.toLowerCase());
}

function scopeOf(text: string) {
  if (/\b(theme|banner|search|compact|room|colou?r|look|emphasis|size|larger|smaller|stand out|quieter|visual)\b/i.test(text)) return "ui";
  if (/\bfield\b|\bcolumn\b/i.test(text)) return "data";
  if (/\bagent\b/i.test(text)) return "agents";
  if (/\bpage\b|\bnav\b|\bheading\b|\bdescription\b|\bbutton\b/i.test(text)) return "pages";
  if (/\bconnected\b/i.test(text)) return "integrations";
  if (/\brenamed the app\b/i.test(text)) return "app";
  return "app";
}

export function commitMessage(title: string, changes: string[], opts?: { type?: "fix"; scope?: string }) {
  const first = changes[0] ?? title;
  const visual = /^Visual edit/i.test(title);
  const styleish = visual || /\b(theme|banner|compact|more room|colou?r|emphasis|larger|smaller|stand out|quieter)\b/i.test(first);
  const type = opts?.type ?? (/^fix(ed)?\b/i.test(title) ? "fix" : styleish ? "style" : /^(added|connected)\b/i.test(first) ? "feat" : "chore");
  const scope = opts?.scope ?? (visual ? "ui" : scopeOf(first));
  const summary = imperative(first);
  const message = `${type}(${scope}): ${summary}`;
  return message.length > 72 ? `${message.slice(0, 71).trimEnd()}…` : message;
}
