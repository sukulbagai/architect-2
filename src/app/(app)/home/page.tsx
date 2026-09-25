import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { firstName } from "@/lib/format";
import { ROLES } from "@/lib/constants";
import { templatesForRole } from "@/lib/templates";
import { PageContainer } from "@/components/common/page-header";
import { Composer } from "@/components/home/composer";
import { StartOptions } from "@/components/home/start-options";
import { Greeting } from "@/components/home/greeting";
import { TemplateCard } from "@/components/home/template-card";
import { ProjectCard } from "@/components/projects/project-card";

export const metadata = { title: "Home" };

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const db = await getDb();
  const recent = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, ws.id))
    .orderBy(desc(projects.updatedAt))
    .limit(3);
  const templates = templatesForRole(ws.role, 6);
  const roleLabel = ROLES.find((r) => r.id === ws.role)?.label;
  const isPro = ws.mode === "pro";

  return (
    <div className="relative">
      <div className="bg-grid-major mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
      <PageContainer className="relative">
        <section className="mx-auto max-w-[760px] pt-6 md:pt-14">
          <p className="annotation">
            <Greeting name={firstName(ws.name)} />
          </p>
          <h1 className="mt-2.5 text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance md:text-[44px]">
            What should we <span className="font-display font-normal italic tracking-[-0.01em]">build</span> today?
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-pretty text-muted-foreground">
            {isPro
              ? "Describe it, or pick a stack and model from the + menu. You'll see every file as it's written."
              : "Describe it in plain words. Architect asks a few questions and shows you a plan before it builds anything."}
          </p>
          <Composer mode={ws.mode} autoFocus={sp.new === "1"} className="mt-7" />
          <StartOptions className="mt-5" role={ws.role} openConsultant={sp.consultant === "1"} />
        </section>

        {recent.length > 0 && (
          <section className="mt-16" aria-labelledby="recent-heading">
            <div className="mb-4 flex items-end justify-between">
              <h2 id="recent-heading" className="text-base font-semibold tracking-tight">
                Pick up where you left off
              </h2>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                All projects <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((p) => (
                <ProjectCard key={p.id} project={{ ...p, templateId: p.settings.templateId ?? null }} showStack={isPro} />
              ))}
            </div>
          </section>
        )}

        <section id="templates" className="mt-16 scroll-mt-8" aria-labelledby="templates-heading">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="templates-heading" className="text-base font-semibold tracking-tight">
                Start from a template
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {roleLabel && ws.role !== "other"
                  ? `Picked for ${roleLabel.toLowerCase()}. Each one is a working app you can reshape.`
                  : "Each one is a working app you can reshape."}
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Explore all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}
