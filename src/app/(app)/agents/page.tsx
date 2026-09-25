import Link from "next/link";
import { Bot } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { FRAMEWORKS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  await requireWorkspace();
  return (
    <PageContainer>
      <PageHeader
        title="Agents"
        description="Every agent across your projects, plus agents that stand on their own as an API or a chat widget."
      />
      <EmptyState
        className="mt-8"
        icon={<Bot />}
        title="No agents yet"
        description="When a project's plan calls for agents, they appear here. You'll also be able to build one without an app around it."
        action={
          <Button asChild variant="outline">
            <Link href="/home?new=1">Start a project</Link>
          </Button>
        }
      />
      <section className="mt-10">
        <p className="annotation">Build in the framework you already use</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FRAMEWORKS.map((f) => (
            <span key={f} className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
