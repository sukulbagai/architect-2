import { requireWorkspace } from "@/lib/session";
import { TEMPLATES } from "@/lib/templates";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { TemplateGallery } from "@/components/explore/template-gallery";

export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  await requireWorkspace();
  return (
    <PageContainer>
      <PageHeader
        title="Explore"
        description="Working apps to start from. Each template comes with its agents, pages and data model, and opens straight into a plan you can change."
      />
      <div className="mt-8">
        <TemplateGallery templates={TEMPLATES} />
      </div>
    </PageContainer>
  );
}
