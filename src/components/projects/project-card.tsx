import Link from "next/link";
import { ProjectThumb } from "@/components/common/project-thumb";
import { StatusBadge } from "@/components/common/status-badge";
import { ProjectMenu } from "@/components/projects/project-menu";
import { stackLabel } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { ProjectStatus } from "@/db/schema";
import { layoutForTemplate } from "@/lib/templates";

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  stack: string;
  source: string;
  prompt: string;
  updatedAt: Date;
  createdAt: Date;
  templateId?: string | null;
};

export function ProjectCard({ project, showStack }: { project: ProjectSummary; showStack?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-border-strong hover:shadow-float">
      <Link href={`/p/${project.id}`} className="block" aria-label={`Open ${project.name}`}>
        <div className="aspect-[16/10] overflow-hidden border-b border-border">
          <ProjectThumb seed={project.id} layout={layoutForTemplate(project.templateId)} className="transition-transform duration-500 group-hover:scale-[1.02]" />
        </div>
        <div className="space-y-1 px-4 pt-3 pb-3.5">
          <h3 className="truncate pr-8 text-sm font-medium">{project.name}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={project.status} />
            <span aria-hidden="true">·</span>
            <span className="truncate">Edited {timeAgo(project.updatedAt)}</span>
            {showStack && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate font-mono text-[11px]">{stackLabel(project.stack)}</span>
              </>
            )}
          </div>
        </div>
      </Link>
      <div className="absolute right-2.5 bottom-3">
        <ProjectMenu id={project.id} name={project.name} className="text-muted-foreground opacity-70 group-hover:opacity-100" />
      </div>
    </div>
  );
}
