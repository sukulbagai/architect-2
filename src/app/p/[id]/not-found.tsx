import Link from "next/link";
import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        className="w-full max-w-lg"
        icon={<FolderX />}
        title="This project isn't in your workspace"
        description="It may have been deleted, or it belongs to a different workspace."
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Back to projects</Link>
          </Button>
        }
      />
    </div>
  );
}
