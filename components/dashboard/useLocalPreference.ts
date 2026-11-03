"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const memory = new Map<string, string>();
function read(key: string) {
  try { return window.localStorage.getItem(key) ?? memory.get(key) ?? null; }
  catch { return memory.get(key) ?? null; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("workspace-preference", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("workspace-preference", callback);
  };
}
export function useLocalPreference<T>(key: string, fallback: T, validate: (value: unknown) => value is T) {
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => read(key), [key]), () => null);
  const value = useMemo(() => {
    try { const parsed: unknown = snapshot === null ? fallback : JSON.parse(snapshot); return validate(parsed) ? parsed : fallback; }
    catch { return fallback; }
  }, [snapshot, fallback, validate]);
  function setValue(next: T) {
    const serialized = JSON.stringify(next);
    memory.set(key, serialized);
    try { window.localStorage.setItem(key, serialized); } catch { /* Memory fallback for restricted storage. */ }
    window.dispatchEvent(new Event("workspace-preference"));
  }
  return [value, setValue] as const;
}
