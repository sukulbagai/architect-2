import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agents } from "@/db/schema";
import { EmbedChat } from "@/components/agents/embed-chat";

/**
 * The embeddable chat widget. Public (it's framed on other people's sites), so it stays out of the
 * proxy matcher and shows nothing but the chat: no config, no workspace data.
 */

async function load(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return row && !row.projectId ? row : null;
}

export async function generateMetadata({ params }: PageProps<"/embed/agent/[id]">) {
  const { id } = await params;
  const row = await load(id);
  return { title: row?.published ? row.name : "Assistant", robots: { index: false } };
}

export default async function EmbedAgentPage({ params }: PageProps<"/embed/agent/[id]">) {
  const { id } = await params;
  const row = await load(id);
  if (!row || !row.published) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white p-6 text-center text-[#17160f]">
        <div>
          <p className="text-sm font-semibold">This assistant isn&apos;t available right now</p>
          <p className="mt-1 text-xs text-[#6b6a62]">{row ? "Its owner hasn't published it yet." : "The link may be out of date."}</p>
        </div>
      </main>
    );
  }
  const widget = row.widget ?? { color: "#cf4318", greeting: `Hi! I'm ${row.name}. How can I help?`, position: "bottom-right" as const };
  return (
    <main className="h-dvh">
      <EmbedChat id={row.id} name={row.name} greeting={widget.greeting} color={widget.color} />
    </main>
  );
}
