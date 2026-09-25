"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectThumb } from "@/components/common/project-thumb";
import { createProject } from "@/lib/actions/projects";
import type { Template } from "@/lib/templates";

export function TemplateCard({ template }: { template: Template }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function use() {
    startTransition(async () => {
      try {
        const { id } = await createProject({ prompt: template.prompt, templateId: template.id });
        router.push(`/p/${id}`);
      } catch {
        toast.error("Couldn't start from this template");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={use}
      disabled={pending}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-border-strong hover:shadow-float disabled:opacity-70"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border">
        <ProjectThumb seed={`tpl-${template.id}`} layout={template.layout} />
        <span className="absolute top-2.5 left-2.5 rounded-full border border-border bg-card/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
          {template.category}
        </span>
        <span className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5" />}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
        <div>
          <h3 className="text-sm font-medium">{template.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-pretty text-muted-foreground">{template.tagline}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-1">
          {template.agents.map((a) => (
            <span key={a} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              {a}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
