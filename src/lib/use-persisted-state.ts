"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * False during server render and the hydration pass, true afterwards. Gate any
 * component that reads persisted state on this, otherwise the stored value
 * would differ from the server-rendered HTML and cause a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * useState that survives a page refresh (localStorage). Only call it from a
 * component that mounts after `useHydrated()` is true.
 */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (typeof initial === "object" && initial !== null) {
        return parsed && typeof parsed === "object" ? { ...initial, ...parsed } : initial;
      }
      return typeof parsed === typeof initial ? (parsed as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked or full: the page still works, it just won't persist.
    }
  }, [key, value]);

  return [value, setValue];
}
