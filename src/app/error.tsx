"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        className="w-full max-w-lg"
        icon={<TriangleAlert />}
        title="Something went wrong on this page"
        description="The rest of the app is fine. Try again, and if it keeps happening go back to your projects."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
            <Button asChild>
              <Link href="/projects">Go to projects</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
