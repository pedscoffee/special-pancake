"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  demoDatabase,
  emptyDatabase,
  LEGACY_KEY,
  parseDatabase,
  STORAGE_KEY,
} from "@/lib/care";
import type { Database } from "@/lib/types";
import { withStorageLock } from "@/lib/storage-lock";

type CareContext = {
  db: Database | null;
  ready: boolean;
  now: number;
  online: boolean;
  demo: boolean;
  problem: string;
  toast: string;
  update: (
    fn: (db: Database) => Database | null,
    message?: string,
  ) => Promise<boolean>;
  restore: (db: Database, expectedRevision: string | null) => Promise<boolean>;
  revision: string | null;
  saving: boolean;
  notify: (text: string) => void;
  startDemo: () => void;
  endDemo: () => void;
};
const Context = createContext<CareContext | null>(null);

export function CareProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);
  const [demo, setDemo] = useState(false);
  const [problem, setProblem] = useState("");
  const [toast, setToast] = useState("");
  const current = useRef<Database | null>(null);
  const actual = useRef<Database | null>(null);
  const actualProblem = useRef("");
  const demoRef = useRef(false);
  const protectedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let loaded: Database;
      let error = "";
      let raw: string | null = null;
      try {
        loaded = await withStorageLock(() => {
          const saved = localStorage.getItem(STORAGE_KEY);
          const legacy =
            saved === null ? localStorage.getItem(LEGACY_KEY) : null;
          const serialized = saved ?? legacy;
          const data =
            serialized !== null
              ? parseDatabase(JSON.parse(serialized))
              : emptyDatabase();
          if (saved === null)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          raw = localStorage.getItem(STORAGE_KEY);
          return data;
        });
        if (!mounted) return;
        protectedRef.current = false;
      } catch {
        if (!mounted) return;
        try {
          raw = localStorage.getItem(STORAGE_KEY);
        } catch {}
        loaded = emptyDatabase();
        error =
          "We couldn’t read or save your local records. Your existing data has been left untouched. Restore a valid backup in Settings, or enable browser storage and reload.";
        protectedRef.current = true;
      }
      setRevision(raw);
      actual.current = loaded;
      actualProblem.current = error;
      if (!demoRef.current) {
        current.current = loaded;
        setDb(loaded);
        setProblem(error);
      }
      setReady(true);
    };
    // Browser storage is unavailable during static rendering. Hydrate once on mount.
    queueMicrotask(() => {
      if (!mounted) return;
      load();
      setNow(Date.now());
      setOnline(navigator.onLine);
    });
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 15000);
    const connection = () => setOnline(navigator.onLine);
    const storage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) load();
    };
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", tick);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {
          /* Local tracking still works without offline caching. */
        });
    return () => {
      mounted = false;
      clearInterval(interval);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", tick);
    };
  }, []);

  function commit(next: Database, message?: string) {
    const validated = parseDatabase(next);
    if (!demoRef.current) {
      const serialized = JSON.stringify(validated);
      localStorage.setItem(STORAGE_KEY, serialized);
      setRevision(serialized);
      actual.current = validated;
      protectedRef.current = false;
      actualProblem.current = "";
    }
    current.current = validated;
    setDb(validated);
    setProblem("");
    setNow(Date.now());
    if (message) notify(message);
    return true;
  }

  async function write(action: () => boolean) {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    // Keep demo transitions from changing the destination of a queued save.
    const wasDemo = demoRef.current;
    try {
      if (wasDemo) return action();
      return await withStorageLock(() => {
        if (wasDemo !== demoRef.current) return false;
        return action();
      });
    } catch (error) {
      const text =
        error instanceof Error && error.name !== "QuotaExceededError"
          ? error.message
          : "This change couldn’t be saved. Your browser’s storage may be full or unavailable. Export a backup in Settings and try again.";
      setProblem(text);
      notify(text);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function update(
    fn: (database: Database) => Database | null,
    message?: string,
  ) {
    return write(() => {
      if (!current.current) return false;
      let latest = current.current;
      if (!demoRef.current) {
        if (protectedRef.current)
          throw new Error(
            "Restore a backup in Settings before making changes. Your existing records are protected.",
          );
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === null)
          throw new Error(
            "Records were cleared in another tab. Reload before making changes.",
          );
        try {
          latest = parseDatabase(JSON.parse(saved));
        } catch {
          protectedRef.current = true;
          throw new Error(
            "Your stored records couldn’t be read. They have been left untouched. Restore a valid backup in Settings.",
          );
        }
      }
      const next = fn(latest);
      return next ? commit(next, message) : false;
    });
  }

  async function restore(next: Database, expectedRevision: string | null) {
    return write(() => {
      if (
        !demoRef.current &&
        localStorage.getItem(STORAGE_KEY) !== expectedRevision
      )
        throw new Error(
          "Records changed after you opened this review. Cancel and review again before replacing them.",
        );
      return commit(next, "Backup restored. You’re all set.");
    });
  }
  function startDemo() {
    if (savingRef.current) return;
    const sample = demoDatabase(Date.now());
    demoRef.current = true;
    setDemo(true);
    current.current = sample;
    setDb(sample);
    setProblem("");
    setNow(Date.now());
  }
  function endDemo() {
    if (savingRef.current) return;
    demoRef.current = false;
    setDemo(false);
    current.current = actual.current;
    setDb(actual.current);
    setProblem(actualProblem.current);
    setNow(Date.now());
  }

  return (
    <Context.Provider
      value={{
        db,
        ready,
        now,
        online,
        demo,
        problem,
        toast,
        update,
        restore,
        revision,
        saving,
        notify,
        startDemo,
        endDemo,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCare() {
  const context = useContext(Context);
  if (!context) throw new Error("CareProvider is missing");
  return context;
}
