"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Heart } from "lucide-react";

/** Bump when the wording changes so everyone sees and agrees to it again. */
export const ATTESTATION_VERSION = "2026-11-27";
export const ATTESTATION_KEY = "kiddymeds-attestation";

function hasAttested() {
  try {
    const saved = JSON.parse(localStorage.getItem(ATTESTATION_KEY) || "null");
    return saved?.version === ATTESTATION_VERSION;
  } catch {
    return false;
  }
}

/** Shows the first-run agreement before any part of KiddyMeds, the demo included. */
export function AttestationGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "needed" | "done">(
    "checking",
  );
  useEffect(() => {
    queueMicrotask(() => setState(hasAttested() ? "done" : "needed"));
  }, []);
  if (state === "done") return <>{children}</>;
  if (state === "checking")
    return <div className="attestation-checking" aria-busy="true" />;
  return <Attestation onDone={() => setState("done")} />;
}

function Attestation({ onDone }: { onDone: () => void }) {
  const [care, setCare] = useState(false);
  const [development, setDevelopment] = useState(false);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!care || !development) {
      setError("Please check both boxes to continue.");
      return;
    }
    try {
      localStorage.setItem(
        ATTESTATION_KEY,
        JSON.stringify({
          version: ATTESTATION_VERSION,
          acceptedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Storage unavailable: allow this visit; the question returns next time.
    }
    onDone();
  }
  return (
    <main className="attestation" id="main-content">
      <form
        className="attestation-card"
        onSubmit={submit}
        aria-labelledby="attestation-title"
      >
        <div className="attestation-brand">
          <span className="attestation-logo">
            <Heart size={22} aria-hidden="true" />
          </span>
          KiddyMeds
        </div>
        <h1 id="attestation-title">Before you start</h1>
        <p>
          KiddyMeds helps families keep a private record of a child’s medicines,
          symptoms and daily care. It doesn’t give medical advice, dosing or
          triage.
        </p>
        <fieldset>
          <legend className="sr-only">Agreements</legend>
          <label className="attestation-check">
            <input
              type="checkbox"
              checked={care}
              onChange={(e) => {
                setCare(e.target.checked);
                setError("");
              }}
            />
            <span>
              I will use KiddyMeds only under the care of, and in close
              communication with, my child’s healthcare provider.
            </span>
          </label>
          <label className="attestation-check">
            <input
              type="checkbox"
              checked={development}
              onChange={(e) => {
                setDevelopment(e.target.checked);
                setError("");
              }}
            />
            <span>
              I understand KiddyMeds is in development and not yet ready for
              public use.
            </span>
          </label>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary">
          Continue
        </button>
        <p className="attestation-note">
          In an emergency, call 911 or your local emergency number.
        </p>
      </form>
    </main>
  );
}
