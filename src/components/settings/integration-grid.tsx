"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Integration, IntegrationCategory } from "@/lib/integrations";

const ORDER: IntegrationCategory[] = ["Code & deploy", "Communication", "Workspace", "CRM & data", "Custom"];

export function IntegrationGrid({ integrations }: { integrations: Integration[] }) {
  return (
    <div className="mt-8 space-y-10">
      {ORDER.map((cat) => {
        const items = integrations.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="annotation mb-3">
              {cat}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <div key={i.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold text-white"
                    style={{ background: i.tint }}
                    aria-hidden="true"
                  >
                    {i.mono}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast(`${i.name} connections arrive in a later milestone`, {
                        description:
                          i.id === "github"
                            ? "The GitHub connect flow arrives in the GitHub milestone."
                            : "The catalog is in place so you can see where connections live.",
                      })
                    }
                  >
                    {i.category === "Custom" ? "Add" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
