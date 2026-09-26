import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { Onboarding } from "@/components/auth/onboarding";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const ws = await requireWorkspace({ onboarded: false });
  if (ws.onboardedAt) redirect("/home");

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="bg-grid mask-fade-b pointer-events-none absolute inset-x-0 top-0 h-80" />
      <header className="relative px-6 py-6 sm:px-10">
        <Link href="/" className="rounded-md" aria-label="Architect home">
          <Logo />
        </Link>
      </header>
      <main className="relative flex flex-1 justify-center px-6 pt-6 pb-16 sm:pt-12">
        <Onboarding initialName={ws.name} initialRole={ws.role} initialMode={ws.mode} githubLogin={ws.githubLogin} />
      </main>
    </div>
  );
}
