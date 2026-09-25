"use client";

import { useMounted } from "@/hooks/use-mounted";

function partOfDay(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const mounted = useMounted();
  const lead = mounted ? partOfDay(new Date().getHours()) : "Welcome back";
  return (
    <span>
      {lead}, {name}
    </span>
  );
}
