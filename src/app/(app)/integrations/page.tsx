import { requireWorkspace } from "@/lib/session";
import { INTEGRATIONS } from "@/lib/integrations";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { IntegrationGrid } from "@/components/settings/integration-grid";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  await requireWorkspace();
  return (
    <PageContainer>
      <PageHeader
        title="Integrations"
        description="Connect a service once and every agent in this workspace can use it. Keys stay on the server and never reach the generated app's browser code."
      />
      <IntegrationGrid integrations={INTEGRATIONS} />
    </PageContainer>
  );
}
