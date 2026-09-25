"use client";

import { LayoutTemplate, Sparkles } from "lucide-react";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    id: "import",
    icon: GithubGlyph,
    title: "Import a repo",
    body: "Bring a GitHub project and keep building",
  },
  {
    id: "template",
    icon: LayoutTemplate,
    title: "Use a template",
    body: "Start from an app that already works",
  },
  {
    id: "consultant",
    icon: Sparkles,
    title: "Ask the Consultant",
    body: "Not sure yet? Find the best app for your role",
  },
] as const;

export function StartOptions({ className }: { className?: string }) {
  function pick(id: (typeof OPTIONS)[number]["id"]) {
    if (id === "template") {
      document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    toast(id === "import" ? "Importing arrives with the GitHub milestone" : "The Consultant arrives with the planning milestone", {
      description: "This entry point is in place so the flow is visible now.",
    });
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      <p className="annotation sm:col-span-3">Or start another way</p>
      {OPTIONS.map(({ id, icon: Icon, title, body }) => (
        <button
          key={id}
          type="button"
          onClick={() => pick(id)}
          className="group flex items-start gap-3 rounded-xl border border-border bg-card/70 px-3.5 py-3 text-left backdrop-blur transition-[border-color,background-color] hover:border-border-strong hover:bg-card"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
            <Icon className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{title}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">{body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
