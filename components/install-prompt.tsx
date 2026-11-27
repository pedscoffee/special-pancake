"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "kiddymeds-install-dismissed";
type InstallEvent = Event & { prompt: () => Promise<void> };

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function isIOS() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Suggests adding KiddyMeds to the Home Screen. On iPhone, Safari may clear a
 * site's storage after a stretch without visits; Home Screen apps keep theirs.
 * Home Screen apps also start with separate, empty storage, so a family that
 * already has records is told to move them with a backup first.
 */
export function InstallPrompt({ hasRecords }: { hasRecords: boolean }) {
  const [mode, setMode] = useState<null | "ios" | "android">(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {}
    if (dismissed || isStandalone()) return;
    if (isIOS()) queueMicrotask(() => setMode("ios"));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (!mode) return null;
  function dismiss() {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
  }
  return (
    <section className="install-prompt" aria-labelledby="install-title">
      <div>
        <strong id="install-title">Add KiddyMeds to your Home Screen</strong>
        {mode === "ios" ? (
          <p>
            In Safari, tap <Share size={14} aria-label="Share" /> then{" "}
            <b>Add to Home Screen</b>. Safari can clear records from sites you
            haven’t opened in a while; the Home Screen app keeps them.
          </p>
        ) : (
          <p>Open it like an app, even offline.</p>
        )}
        {mode === "ios" && hasRecords && (
          <p>
            The Home Screen app starts empty. First{" "}
            <Link href="/settings/">export a backup</Link> here, then restore it
            in the new app.
          </p>
        )}
        {mode === "android" && installEvent && (
          <button
            className="button primary"
            onClick={async () => {
              await installEvent.prompt();
              dismiss();
            }}
          >
            Install
          </button>
        )}
      </div>
      <button
        className="icon-button"
        aria-label="Dismiss Home Screen tip"
        onClick={dismiss}
      >
        <X size={16} />
      </button>
    </section>
  );
}
