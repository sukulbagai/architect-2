import { useSyncExternalStore } from "react";

/* A shared clock for relative times ("synced 2m ago"). It ticks every 30 s while anything listens.
   The server snapshot is null, so time-dependent text renders only after hydration. */

let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => now || (now = Date.now());

/** The current time in ms, refreshed every 30 s; null during the server render and hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
