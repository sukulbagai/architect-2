import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { GithubGlyph } from "@/components/auth/brand-icons";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ws = await requireWorkspace();
  const db = await getDb();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      stack: projects.stack,
      source: projects.source,
      prompt: projects.prompt,
      updatedAt: projects.updatedAt,
      createdAt: projects.createdAt,
      settings: projects.settings,
    })
    .from(projects)
    .where(eq(projects.workspaceId, ws.id))
    .orderBy(desc(projects.updatedAt));

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description={
          rows.length === 1 ? "1 project in this workspace." : `${rows.length} projects in this workspace.`
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/import">
                <GithubGlyph className="size-3.5" />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/home?new=1">
                <Plus />
                New project
              </Link>
            </Button>
          </>
        }
      />
      <ProjectsView projects={rows.map(({ settings, ...r }) => ({ ...r, templateId: settings.templateId ?? null }))} isPro={ws.mode === "pro"} />
    </PageContainer>
  );
}
