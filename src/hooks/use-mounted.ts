import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration. Use for UI that depends on client-only state such as the theme. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
