import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { connections } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { toConnectionView } from "@/lib/agent-store";
import { INTEGRATIONS } from "@/lib/integrations";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { IntegrationGrid } from "@/components/settings/integration-grid";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const ws = await requireWorkspace();
  const db = await getDb();
  const rows = await db.select().from(connections).where(eq(connections.workspaceId, ws.id)).orderBy(desc(connections.createdAt));
  const account = ws.email ?? ws.name;
  return (
    <PageContainer>
      <PageHeader
        title="Integrations"
        description="Connect a service once and every agent in this workspace can use it. Keys stay on the server and never reach the generated app's browser code."
      />
      <IntegrationGrid integrations={INTEGRATIONS} connections={rows.map((r) => toConnectionView(r, account))} account={account} />
    </PageContainer>
  );
}
