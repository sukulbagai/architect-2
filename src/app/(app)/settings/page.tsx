import { requireWorkspace } from "@/lib/session";
import { PageContainer, PageHeader } from "@/components/common/page-header";
import { SettingsForms } from "@/components/settings/settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ws = await requireWorkspace();
  return (
    <PageContainer className="max-w-[920px]">
      <PageHeader title="Settings" description="Your profile, how Architect looks, and how much of the machinery you see." />
      <SettingsForms profile={{ name: ws.name, email: ws.email ?? "", role: ws.role }} mode={ws.mode} />
    </PageContainer>
  );
}
