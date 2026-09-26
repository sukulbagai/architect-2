import { requireWorkspace } from "@/lib/session";
import { PageContainer } from "@/components/common/page-header";
import { ImportFlow } from "@/components/import/import-flow";

export const metadata = { title: "Import a project" };

/** /import, /import?repo=support-bot (straight to its branch) or /import?tab=url|zip. */
export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const tab = sp.tab === "url" || sp.tab === "zip" || sp.tab === "github" ? sp.tab : null;
  return (
    <PageContainer>
      <ImportFlow login={ws.githubLogin} name={ws.name} isPro={ws.mode === "pro"} initialRepo={typeof sp.repo === "string" ? sp.repo : null} initialTab={tab} />
    </PageContainer>
  );
}
