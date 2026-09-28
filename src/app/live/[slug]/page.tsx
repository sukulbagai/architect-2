import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deployments, versions } from "@/db/schema";
import { PreviewApp } from "@/components/preview/preview-app";
import type { Plan } from "@/lib/sim/types";

/**
 * The public home of a deployed app. No workspace and no sign-in: anyone with the link sees
 * exactly the version that was live when the deploy ran, which is what makes the URL shareable.
 */
async function liveVersion(slug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ plan: versions.plan, deployedAt: deployments.createdAt })
    .from(deployments)
    .innerJoin(versions, eq(versions.id, deployments.versionId))
    .where(and(eq(deployments.slug, slug), eq(deployments.status, "ready")))
    .orderBy(desc(deployments.createdAt))
    .limit(1);
  return row?.plan ? { plan: row.plan as Plan, deployedAt: row.deployedAt } : null;
}

export async function generateMetadata({ params }: PageProps<"/live/[slug]">) {
  const live = await liveVersion((await params).slug);
  if (!live) return { title: "Nothing deployed here" };
  return { title: { absolute: live.plan.appName }, description: live.plan.tagline };
}

export default async function LivePage({ params }: PageProps<"/live/[slug]">) {
  const { slug } = await params;
  const live = await liveVersion(slug);

  if (!live) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{slug}.architect.app</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nothing&rsquo;s deployed here yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This address is free. Build an app in Architect and deploy it to claim it.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
        >
          Build one
        </Link>
      </main>
    );
  }

  return (
    <>
      <PreviewApp plan={live.plan} />
      <Link
        href="/"
        className="fixed right-4 bottom-4 z-50 inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        Built with Architect
      </Link>
    </>
  );
}
