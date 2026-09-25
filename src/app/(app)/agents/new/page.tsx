import { requireWorkspace } from "@/lib/session";
import { PageContainer } from "@/components/common/page-header";
import { NewAgentWizard } from "@/components/agents/new-agent-wizard";

export const metadata = { title: "New agent" };

export default async function NewAgentPage() {
  const ws = await requireWorkspace();
  return (
    <PageContainer>
      <NewAgentWizard isPro={ws.mode === "pro"} />
    </PageContainer>
  );
}
