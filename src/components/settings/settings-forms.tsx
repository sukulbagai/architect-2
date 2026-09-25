"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/constants";
import { deleteWorkspace, updateProfile } from "@/lib/actions/workspace";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { useModeSwitch } from "@/components/shell/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Mode } from "@/db/schema";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-border py-8 first:pt-0 last:border-0 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsForms({
  profile,
  mode: initialMode,
}: {
  profile: { name: string; email: string; role: string | null };
  mode: Mode;
}) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [role, setRole] = useState(profile.role ?? "other");
  const [saving, startSaving] = useTransition();
  const { mode, change } = useModeSwitch(initialMode);
  const dirty = name !== profile.name || email !== profile.email || role !== (profile.role ?? "other");

  function save(e: React.FormEvent) {
    e.preventDefault();
    startSaving(async () => {
      try {
        await updateProfile({ name, email, role });
        toast.success("Profile saved");
      } catch {
        toast.error("Couldn't save", { description: "Check that the email address is valid." });
      }
    });
  }

  return (
    <div className="mt-8">
      <Section title="Profile" description="How you appear to teammates you share projects with.">
        <form onSubmit={save} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Email</Label>
            <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-role">Role</Label>
            <select
              id="s-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save profile
          </Button>
        </form>
      </Section>

      <Section title="Mode" description="Your default depth in every project. Change it here or from a project's top bar.">
        <div role="radiogroup" aria-label="Mode" className="grid max-w-xl gap-3 sm:grid-cols-2">
          {(
            [
              { id: "simple", title: "Simple", body: "The app, the plan and plain-language progress. Code stays one click away." },
              { id: "pro", title: "Pro", body: "Adds the code editor, diffs before changes land, logs and the terminal." },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => change(m.id)}
              className={cn(
                "flex items-start justify-between gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-[border-color,box-shadow]",
                mode === m.id ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-border-strong",
              )}
            >
              <span>
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{m.body}</span>
              </span>
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  mode === m.id ? "border-foreground bg-foreground text-background" : "border-border-strong",
                )}
              >
                {mode === m.id && <Check className="size-3" strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Appearance" description="Light, dark, or follow your system. Separate from Simple and Pro.">
        <ThemeSwitcher size="md" />
      </Section>

      <Section title="Session" description="Sign-in is simulated: this browser holds your workspace in a secure cookie.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete workspace</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  All projects, agents, versions and deployments are removed for good. Connected GitHub repos are not
                  touched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void deleteWorkspace()}>
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  );
}
