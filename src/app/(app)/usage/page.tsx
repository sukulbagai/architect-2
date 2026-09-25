import { Gauge } from "lucide-react";
import { requireWorkspace } from "@/lib/session";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer, PageHeader } from "@/components/common/page-header";

export const metadata = { title: "Usage" };

const TILES = [
  { label: "Credits used this month", value: "0", unit: "of 100" },
  { label: "AI turns today", value: "0", unit: "of 15" },
  { label: "Live apps", value: "0", unit: "" },
];

export default async function UsagePage() {
  await requireWorkspace();
  return (
    <PageContainer>
      <PageHeader
        title="Usage"
        description="What each build cost, broken down by project and by step: plan, agents, UI, build and test."
      />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{t.value}</span>
              {t.unit && <span className="text-sm text-muted-foreground">{t.unit}</span>}
            </p>
          </div>
        ))}
      </div>
      <EmptyState
        className="mt-6"
        icon={<Gauge />}
        title="Nothing spent yet"
        description="Every plan, build and edit will show up here with its tokens and cost, so there are no surprise bills."
      />
    </PageContainer>
  );
}
