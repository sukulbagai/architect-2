"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { TemplateCard } from "@/components/home/template-card";
import type { Template } from "@/lib/templates";

export function TemplateGallery({ templates }: { templates: Template[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(templates.map((t) => t.category)))], [templates]);
  const [active, setActive] = useState("All");
  const visible = active === "All" ? templates : templates.filter((t) => t.category === active);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active === c}
            onClick={() => setActive(c)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-sm transition-colors",
              active === c
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
