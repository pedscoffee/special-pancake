"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Upload, ArrowRight } from "lucide-react";
import { logDetail, logTitle } from "@/lib/care";
import {
  mergeCareShare,
  planCareMerge,
  readCareFile,
  recordSignature,
  type CareShare,
  type ConflictChoice,
} from "@/lib/sharing";
import { useCare } from "./care-provider";
import { Modal } from "./ui";

export function ReceiveCare() {
  const { db, update, demo } = useCare();
  const [pending, setPending] = useState<CareShare | null>(null);
  const [target, setTarget] = useState("");
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  if (!db) return null;
  const database = db;

  async function read(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > 20 * 1024 * 1024) {
      setError("Choose a care file smaller than 20 MB.");
      return;
    }
    setReading(true);
    try {
      const share = readCareFile(await file.text());
      setPending(share);
      setTarget(
        database.children.some((c) => c.id === share.child.id)
          ? `existing:${share.child.id}`
          : "",
      );
      setChoices({});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This care file couldn’t be read.",
      );
    } finally {
      setReading(false);
    }
  }

  let plan;
  let planError = "";
  if (pending && target) {
    try {
      plan = planCareMerge(
        db,
        pending,
        target === "new" ? pending.child.id : target.slice(9),
      );
    } catch (err) {
      planError =
        err instanceof Error
          ? err.message
          : "Choose a different child profile.";
    }
  }
  const unresolved = plan?.conflicts.some(
    (c) =>
      !choices[c.local.id] ||
      choices[c.local.id].localSignature !== recordSignature(c.local),
  );
  const incomingCount =
    plan?.conflicts.filter(
      (c) =>
        choices[c.local.id]?.keep === "incoming" &&
        choices[c.local.id]?.localSignature === recordSignature(c.local),
    ).length || 0;
  const changed = !!plan && (plan.added.length > 0 || incomingCount > 0);
  async function merge() {
    if (!pending) return;
    setImporting(true);
    try {
      let mergeError = "";
      const saved = await update((current) => {
        try {
          return mergeCareShare(
            current,
            pending,
            target === "new" ? null : target.slice(9),
            choices,
          );
        } catch (err) {
          mergeError =
            err instanceof Error ? err.message : "Review the care file again.";
          return null;
        }
      }, "Shared care added to this device.");
      if (mergeError) setError(mergeError);
      else if (saved) {
        setPending(null);
        setChoices({});
        setError("");
      } else
        setError(
          "Care couldn’t be saved. Your existing records were left unchanged.",
        );
    } finally {
      setImporting(false);
    }
  }
  return (
    <>
      <button
        className="button secondary"
        disabled={reading}
        onClick={() => {
          setError("");
          input.current?.click();
        }}
      >
        <Upload size={16} />
        {reading ? "Reading care file…" : "Receive care"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose shared care file"
        onChange={read}
      />
      {error && !pending && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <Modal
          title="Receive shared care"
          subtitle={`${pending.child.name} · ${pending.logs.length} shared records`}
          onClose={() => {
            setPending(null);
            setError("");
          }}
        >
          <div className="form-stack">
            <p className="field-hint">
              Shared {new Date(pending.sharedAt).toLocaleString("en-US")}. These
              are parent-recorded observations from{" "}
              {pending.from || "the beginning"} to{" "}
              {pending.to || "the latest included record"}. Receiving adds
              selected records to this device; it doesn’t synchronize devices or
              remove existing records.
            </p>
            {demo && (
              <p className="inline-note">
                These records will be added to the temporary demo only.
              </p>
            )}
            <label>
              Receive for
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setChoices({});
                  setError("");
                }}
                required
              >
                <option value="" disabled>
                  Choose a child profile
                </option>
                {!db.children.some((c) => c.id === pending.child.id) &&
                  db.children.length < 100 && (
                    <option value="new">
                      Add {pending.child.name} as a new child
                    </option>
                  )}
                {db.children.map((c) => (
                  <option key={c.id} value={`existing:${c.id}`}>
                    {c.name} (existing profile)
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              Choose their existing profile if this child is already in your
              app. Names alone aren’t used to match children.
            </p>
            {plan && (
              <>
                <div className="receive-counts" aria-label="Import review">
                  <span>
                    <strong>{plan.added.length}</strong> new
                  </span>
                  <span>
                    <strong>{plan.duplicates.length}</strong> already here
                  </span>
                  <span>
                    <strong>{plan.conflicts.length}</strong> differ
                  </span>
                </div>
                {plan.added.length > 0 && (
                  <details className="receive-details" open>
                    <summary>Review new records</summary>
                    <ul>
                      {plan.added.slice(0, 50).map((log) => (
                        <li key={log.id}>
                          <strong>{logTitle(log)}</strong>
                          <span>
                            {new Date(log.timeGiven).toLocaleString("en-US")} ·{" "}
                            {logDetail(log, db.settings.tempUnit)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {plan.added.length > 50 && (
                      <p className="field-hint">
                        Showing the first 50 of {plan.added.length} new records.
                      </p>
                    )}
                  </details>
                )}
                {plan.conflicts.map((conflict) => {
                  const signature = recordSignature(conflict.local);
                  const selected =
                    choices[conflict.local.id]?.localSignature === signature
                      ? choices[conflict.local.id]?.keep
                      : "";
                  return (
                    <fieldset className="care-conflict" key={conflict.local.id}>
                      <legend>
                        {logTitle(conflict.incoming)} · choose which version to
                        keep
                      </legend>
                      {(["local", "incoming"] as const).map((keep) => {
                        const log =
                          keep === "local" ? conflict.local : conflict.incoming;
                        return (
                          <label className="conflict-option" key={keep}>
                            <input
                              type="radio"
                              name={`conflict-${conflict.local.id}`}
                              checked={selected === keep}
                              onChange={() =>
                                setChoices((current) => ({
                                  ...current,
                                  [conflict.local.id]: {
                                    keep,
                                    localSignature: signature,
                                  },
                                }))
                              }
                            />
                            <span>
                              <strong>
                                {keep === "local"
                                  ? "Keep my version"
                                  : "Use shared version"}
                              </strong>
                              <span>
                                {logTitle(log)} ·{" "}
                                {new Date(log.timeGiven).toLocaleString(
                                  "en-US",
                                )}{" "}
                                · {logDetail(log, db.settings.tempUnit)}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  );
                })}
                {!changed && !unresolved && (
                  <p className="inline-note">
                    These records are already here, or you’ve chosen to keep
                    your versions. Nothing needs to be added.
                  </p>
                )}
              </>
            )}
            {(error || planError) && (
              <p className="form-error" role="alert">
                {error || planError}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setPending(null);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  !plan || !!planError || unresolved || !changed || importing
                }
                onClick={merge}
              >
                <ArrowRight size={16} />
                {importing ? "Adding care…" : "Add shared care"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
