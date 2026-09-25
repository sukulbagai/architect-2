import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { AuthVisual } from "@/components/auth/auth-visual";

export const metadata = { title: "Sign in" };

function safeNext(next: string | string[] | undefined) {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  const ws = await getWorkspace();
  if (ws?.onboardedAt) redirect(next ?? "/home");
  if (ws) redirect("/welcome");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="/" className="self-start rounded-md" aria-label="Architect home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[360px]">
            <LoginForm next={next} />
          </div>
        </div>
        <p className="text-xs text-subtle-foreground">
          By continuing you agree to the Terms and acknowledge the Privacy Policy.
        </p>
      </div>
      <AuthVisual />
    </div>
  );
}
