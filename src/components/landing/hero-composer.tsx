"use client";

import { useState } from "react";
import { Composer } from "@/components/home/composer";

const CHIPS = [
  { label: "Support desk copilot", prompt: "A support desk where an agent drafts replies from our help docs and escalates tricky tickets to Slack" },
  { label: "Resume screener", prompt: "A recruiting app that scores resumes against a job description and books interviews with the best fits" },
  { label: "Market research brief", prompt: "A research tool that gathers sources on any market and writes a two-page brief with citations" },
  { label: "Meeting notes → actions", prompt: "An app that turns meeting transcripts into action items with owners and posts them to Slack" },
];

export function HeroComposer() {
  const [seed, setSeed] = useState<{ key: number; prompt: string }>({ key: 0, prompt: "" });
  return (
    <div>
      <Composer key={seed.key} variant="landing" initialPrompt={seed.prompt} />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="annotation mr-1">Try</span>
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setSeed((s) => ({ key: s.key + 1, prompt: c.prompt }))}
            className="h-8 rounded-full border border-border bg-card/80 px-3 text-sm text-muted-foreground backdrop-blur transition-colors hover:border-border-strong hover:text-foreground"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
