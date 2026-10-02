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

type CareContext = {
  db: Database | null;
  ready: boolean;
  now: number;
  online: boolean;
  demo: boolean;
  problem: string;
  toast: string;
  update: (fn: (db: Database) => Database | null, message?: string) => boolean;
  restore: (db: Database) => boolean;
  notify: (text: string) => void;
  startDemo: () => void;
  endDemo: () => void;
};
const Context = createContext<CareContext | null>(null);

export function CareProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [ready, setReady] = useState(false);
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
    const load = () => {
      let loaded: Database;
      let error = "";
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const legacy = saved === null ? localStorage.getItem(LEGACY_KEY) : null;
        const serialized = saved ?? legacy;
        loaded =
          serialized !== null
            ? parseDatabase(JSON.parse(serialized))
            : emptyDatabase();
        if (saved === null)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
        protectedRef.current = false;
      } catch {
        loaded = emptyDatabase();
        error =
          "We couldn’t read or save your local records. Your existing data has been left untouched. Restore a valid backup in Settings, or enable browser storage and reload.";
        protectedRef.current = true;
      }
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

  function commit(next: Database, message?: string, restoring = false) {
    if (!demoRef.current) {
      if (protectedRef.current && !restoring) {
        notify(
          "Restore a backup in Settings before making changes. Your existing records are protected.",
        );
        return false;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        setProblem(
          "This change couldn’t be saved. Your browser’s storage may be full or unavailable. Export a backup in Settings and try again.",
        );
        notify(
          "Couldn’t save this change. Your previous records are unchanged.",
        );
        return false;
      }
      actual.current = next;
      protectedRef.current = false;
      setProblem("");
      actualProblem.current = "";
    }
    current.current = next;
    setDb(next);
    setNow(Date.now());
    if (message) notify(message);
    return true;
  }
  function update(
    fn: (database: Database) => Database | null,
    message?: string,
  ) {
    const next = current.current ? fn(current.current) : null;
    return next ? commit(next, message) : false;
  }
  function restore(next: Database) {
    return commit(next, "Backup restored. You’re all set.", true);
  }
  function startDemo() {
    const sample = demoDatabase(Date.now());
    demoRef.current = true;
    setDemo(true);
    current.current = sample;
    setDb(sample);
    setProblem("");
    setNow(Date.now());
  }
  function endDemo() {
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
