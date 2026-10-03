"use client";

import { useEffect, useRef, useState } from "react";

/** Unfinished forms belong to this tab, child, and entry, never to care history. */
export function useFormDraft(key: string, enabled: boolean, source = "new") {
  const storageKey = `kiddymeds-draft:${key}`;
  const formRef = useRef<HTMLFormElement>(null);
  const cleared = useRef(false);
  const dirty = useRef(false);
  const [restored] = useState<{
    initial: Record<string, string> | null;
    stale: boolean;
  }>(() => {
    const empty = { initial: null, stale: false };
    if (!enabled) return empty;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return empty;
      const draft = JSON.parse(raw);
      if (
        !draft ||
        typeof draft !== "object" ||
        Array.isArray(draft) ||
        !Object.values(draft).every((value) => typeof value === "string")
      )
        return empty;
      if (draft.__source !== source) return { initial: null, stale: true };
      return { initial: draft, stale: false };
    } catch {
      return empty;
    }
  });

  const { initial, stale } = restored;

  function capture() {
    if (!enabled || cleared.current || !formRef.current) return;
    dirty.current = true;
    const values: Record<string, string> = { __source: source };
    for (const element of Array.from(formRef.current.elements)) {
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        element.name
      )
        values[element.name] =
          element instanceof HTMLInputElement && element.type === "checkbox"
            ? String(element.checked)
            : element.value;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      /* The form remains usable if draft storage is unavailable. */
    }
  }

  useEffect(() => {
    if (!initial || !formRef.current) return;
    for (const element of Array.from(formRef.current.elements)) {
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement) &&
        element.name &&
        initial[element.name] !== undefined
      ) {
        if (element instanceof HTMLInputElement && element.type === "checkbox")
          element.checked = initial[element.name] === "true";
        else element.value = initial[element.name];
      }
    }
  }, [initial]);

  useEffect(() => {
    if (dirty.current) capture();
  });

  function clear() {
    cleared.current = true;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }

  return { formRef, initial, stale, capture, clear };
}
