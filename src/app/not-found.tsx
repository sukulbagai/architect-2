import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        className="w-full max-w-lg"
        icon={<Compass />}
        title="That page isn't here"
        description="The link may be out of date, or the page may have moved."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/">Go home</Link>
            </Button>
            <Button asChild>
              <Link href="/projects">Your projects</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
