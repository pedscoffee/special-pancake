"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { useCare } from "./care-provider";
import { Attestation, hasAttested } from "./attestation-gate";
import { ReceiveReview } from "./receive-care";
import { decodeHandoff } from "@/lib/handoff";
import { formatTime, localDate, responseLabel } from "@/lib/care";
import { buildVisitSummary } from "@/lib/visit-summary";
import type { CareShare } from "@/lib/sharing";

function when(time: number, sentAt: number, timeFormat: "12h" | "24h") {
  const sameDay = localDate(time) === localDate(sentAt);
  return `${sameDay ? "" : `${new Date(time).toLocaleDateString("en-US", { weekday: "short" })} `}${formatTime(time, timeFormat)}`;
}

/**
 * A read-only page for a hand-off link. It works for someone who has never
 * used KiddyMeds: viewing needs no agreement; saving into KiddyMeds does.
 */
export function HandoffView() {
  const { db } = useCare();
  const [share, setShare] = useState<CareShare | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"view" | "agree" | "review" | "saved">(
    "view",
  );
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash;
      if (!hash) {
        setError("This link is missing its care details. Ask for a new one.");
        return;
      }
      decodeHandoff(hash)
        .then((s) => {
          setShare(s);
          setError("");
        })
        .catch((err) =>
          setError(
            err instanceof Error ? err.message : "This link couldn’t be read.",
          ),
        );
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (step === "agree") return <Attestation onDone={() => setStep("review")} />;
  const timeFormat = db?.settings.timeFormat || "12h";
  const settings = db?.settings || {
    timeFormat: "12h" as const,
    tempUnit: "F" as const,
  };
  const summary = share
    ? buildVisitSummary(share.logs, share.logs, settings, share.sharedAt)
    : null;
  const medicines = share
    ? [
        ...new Map(
          [...share.logs]
            .filter((l) => l.type === "MEDICINE")
            // Oldest first, so each medicine keeps its latest entry.
            .sort((a, b) => a.timeGiven - b.timeGiven)
            .map((l) => [l.data.medicineName!.trim().toLowerCase(), l]),
        ).values(),
      ].sort((a, b) => b.timeGiven - a.timeGiven)
    : [];
  return (
    <main className="handoff-page" id="main-content">
      <div className="handoff-brand">
        <span className="attestation-logo" aria-hidden="true">
          <Heart size={18} />
        </span>
        KiddyMeds
      </div>
      {error && (
        <section className="card">
          <h1>This link couldn’t be opened</h1>
          <p className="form-error" role="alert">
            {error}
          </p>
        </section>
      )}
      {!error && !share && (
        <p className="field-hint" aria-live="polite">
          Opening care update…
        </p>
      )}
      {share && summary && (
        <>
          <div className="handoff-title">
            <span className="eyebrow">CARE UPDATE</span>
            <h1>{share.child.name}</h1>
            <p>
              Sent{" "}
              {new Date(share.sharedAt).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · a snapshot that won’t update
            </p>
          </div>
          <div className="handoff-warning" role="note">
            <strong>Private.</strong>{" "}
            <span>
              Anyone with this link can see this. Please don’t forward it.
            </span>
          </div>
          {medicines.length > 0 && (
            <section aria-labelledby="last-given">
              <h2 className="visit-subhead" id="last-given">
                LAST GIVEN
              </h2>
              <ul className="visit-tried">
                {medicines.map((log) => (
                  <li key={log.id}>
                    <span>
                      <strong>{log.data.medicineName}</strong>
                      <small>
                        {[
                          log.data.frequencyHours &&
                            `Recorded interval: ${log.data.frequencyHours} hours`,
                          responseLabel(log.data.response),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Medicine"}
                      </small>
                    </span>
                    <strong className="handoff-time">
                      {when(log.timeGiven, share.sharedAt, timeFormat)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(summary.rows.length > 0 || summary.others.length > 0) && (
            <section aria-labelledby="handoff-summary">
              <h2 className="visit-subhead" id="handoff-summary">
                {summary.onset
                  ? summary.onset.label.toUpperCase()
                  : "WHAT WAS NOTICED"}
              </h2>
              <dl className="visit-rows">
                {summary.rows.map((row) => (
                  <div key={row.key} className={`visit-row ${row.status}`}>
                    <dt>{row.label}</dt>
                    <dd>
                      <strong>{row.primary}</strong>
                      {row.secondary && <span>{row.secondary}</span>}
                    </dd>
                  </div>
                ))}
                {summary.others.length > 0 && (
                  <div className="visit-row noticed">
                    <dt>Also noted</dt>
                    <dd>
                      <strong>{summary.others.join("; ")}</strong>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
          <section className="card handoff-save">
            {step === "saved" ? (
              <>
                <h2>Saved to KiddyMeds on this phone</h2>
                <p>
                  Add what you give or notice, then hand it back the same way.
                </p>
                <Link className="button primary" href="/">
                  Open KiddyMeds <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <h2>Helping care for {share.child.name}?</h2>
                <p>
                  Save these entries into KiddyMeds on this phone so you can add
                  what you give and send it back.
                </p>
                <button
                  className="button primary"
                  onClick={() => setStep(hasAttested() ? "review" : "agree")}
                >
                  Save to my KiddyMeds
                </button>
                <small>
                  Saving asks you to agree to how KiddyMeds is meant to be used
                  first.
                </small>
              </>
            )}
          </section>
          <section className="handoff-about">
            <h2>What’s KiddyMeds?</h2>
            <p>
              A private record of your child’s medicines and symptoms, kept on
              your phone, with a summary to show your doctor. No account.
            </p>
            <Link href="/">
              Learn more about KiddyMeds <ArrowRight size={14} />
            </Link>
          </section>
          <p className="visit-disclaimer">
            Parent-recorded observations. Not medical advice. Questions about
            care go to the child’s healthcare provider.
          </p>
          {step === "review" && (
            <ReceiveReview
              share={share}
              onClose={() => setStep("view")}
              onDone={() => setStep("saved")}
            />
          )}
        </>
      )}
    </main>
  );
}
