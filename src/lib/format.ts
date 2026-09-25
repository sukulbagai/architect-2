const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function timeAgo(date: Date | string, now = Date.now()) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size || unit === "minute") {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Until Claude names projects (milestone 2), derive a readable name from the prompt. */
export function nameFromPrompt(prompt: string) {
  const lead =
    /^(please\s+|i\s+(want|need|would like)\s+(to\s+)?|let'?s\s+|can you\s+|help me\s+)?((build|make|create|design|generate|set up|spin up)\s+)?(me\s+)?(an?\s+|the\s+|my\s+|our\s+)?/i;
  // "An app that turns meeting notes into…" is named for what it works on, not "App".
  const generic =
    /^(app|application|tool|platform|system|dashboard|website|site|bot|assistant|agent|portal)\s+(that|which|to|for)\s+((helps?|lets?)\s+(me|us|you|people|teams?)\s+)?\w+\s+/i;
  const cleaned = prompt.trim().replace(lead, "").replace(/^(simple|small|quick|basic)\s+/i, "").replace(generic, "").replace(/^(an?|the|my|our)\s+/i, "");
  const stop = new Set([
    "where", "that", "which", "who", "for", "with", "to", "so", "and", "from", "using",
    "in", "on", "by", "of", "which", "when", "it", "into",
  ]);
  const words: string[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    const w = raw.replace(/[^\p{L}\p{N}&+'-]/gu, "");
    if (!w) continue;
    if (words.length > 0 && stop.has(w.toLowerCase())) break;
    words.push(w);
    if (words.length === 4) break;
  }
  const filtered = words.filter((w, i) => !(i === words.length - 1 && /^(app|tool|platform)$/i.test(w) && words.length > 1));
  if (filtered.length === 0) return "Untitled app";
  return filtered.map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
}
