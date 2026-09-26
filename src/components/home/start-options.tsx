"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { cn } from "@/lib/utils";
import { ConsultantDialog } from "@/components/home/consultant-dialog";

const OPTIONS = [
  {
    id: "import",
    icon: GithubGlyph,
    title: "Import a repo",
    body: "Bring a repo, a Git URL or a ZIP and keep building",
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

export function StartOptions({ className, role, openConsultant = false }: { className?: string; role: string | null; openConsultant?: boolean }) {
  const router = useRouter();
  const [consultant, setConsultant] = useState(false);
  // "Ask the Consultant" in the command palette links here with ?consultant=1.
  const open = consultant || openConsultant;
  function onOpenChange(o: boolean) {
    setConsultant(o);
    if (!o && openConsultant) router.replace("/home", { scroll: false });
  }

  function pick(id: (typeof OPTIONS)[number]["id"]) {
    if (id === "template") {
      document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (id === "consultant") {
      setConsultant(true);
      return;
    }
    router.push("/import");
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      <ConsultantDialog open={open} onOpenChange={onOpenChange} role={role} />
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
