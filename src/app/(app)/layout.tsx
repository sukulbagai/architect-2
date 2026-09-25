import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/session";
import { RAIL_COOKIE } from "@/lib/constants";
import { AppShell } from "@/components/shell/app-shell";
import { CommandProvider } from "@/components/command/command-provider";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ws = await requireWorkspace();
  const db = await getDb();
  const recent = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(eq(projects.workspaceId, ws.id))
    .orderBy(desc(projects.updatedAt))
    .limit(6);
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "collapsed";

  return (
    <CommandProvider mode={ws.mode}>
      <AppShell
        workspace={{ name: ws.name, email: ws.email, mode: ws.mode, avatarHue: ws.avatarHue }}
        recent={recent}
        initialCollapsed={collapsed}
      >
        {children}
      </AppShell>
    </CommandProvider>
  );
}
