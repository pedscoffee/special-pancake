"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, ClipboardPaste, Download, Upload } from "lucide-react";
import { readPastedCare } from "@/lib/handoff";
import { logDetail, logTitle } from "@/lib/care";
import {
  mergeCareShare,
  onlyPlaceholderChild,
  planCareMerge,
  readCareFile,
  recordSignature,
  type CareShare,
  type ConflictChoice,
} from "@/lib/sharing";
import { useCare } from "./care-provider";
import { Modal } from "./ui";

/** History's button: opens the receive dialog. */
export function ReceiveCare() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Download size={16} />
        Receive care
      </button>
      {open && <ReceiveDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Receive care by pasting a hand-off link or choosing a care file. Pasting
 * matters for Home Screen apps: a tapped link opens the browser, not the app.
 */
export function ReceiveDialog({ onClose }: { onClose: () => void }) {
  const { db } = useCare();
  const [pending, setPending] = useState<CareShare | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canPaste =
    typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  if (!db) return null;

  async function open(value: string) {
    setError("");
    setReading(true);
    try {
      setPending(await readPastedCare(value));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This link couldn’t be read.",
      );
    } finally {
      setReading(false);
    }
  }
  async function pasteFromClipboard() {
    setError("");
    try {
      const value = await navigator.clipboard.readText();
      setText(value);
      if (value.trim()) await open(value);
      else setError("Your clipboard is empty. Copy the link first.");
    } catch {
      setError("Paste the link into the box below instead.");
    }
  }
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
      setPending(readCareFile(await file.text()));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This care file couldn’t be read.",
      );
    } finally {
      setReading(false);
    }
  }
  if (pending)
    return (
      <ReceiveReview key={pending.sharedAt} share={pending} onClose={onClose} />
    );
  return (
    <Modal
      title="Receive care"
      subtitle="Add care someone shared with you to this device."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          open(text);
        }}
      >
        {canPaste && (
          <button
            type="button"
            className="button primary"
            disabled={reading}
            onClick={pasteFromClipboard}
          >
            <ClipboardPaste size={16} />
            Paste hand-off link
          </button>
        )}
        <label>
          {canPaste ? "Or paste it here" : "Hand-off link"}
          <textarea
            rows={3}
            value={text}
            maxLength={200000}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://…/handoff/#c1…"
          />
        </label>
        <p className="field-hint">
          Using KiddyMeds from your Home Screen? Tapping a link opens your
          browser instead. Copy the link from the message and paste it here.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={reading}
            onClick={() => {
              setError("");
              input.current?.click();
            }}
          >
            <Upload size={16} />
            Choose a care file
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={reading || !text.trim()}
          >
            <ArrowRight size={16} />
            {reading ? "Opening…" : "Open link"}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose shared care file"
          onChange={read}
        />
      </form>
    </Modal>
  );
}

/** Review and merge shared care, from a care file or a hand-off link. */
export function ReceiveReview({
  share,
  onClose,
  onDone,
}: {
  share: CareShare;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { db, update, demo } = useCare();
  const pending = share;
  const [target, setTarget] = useState(() =>
    db?.children.some((c) => c.id === share.child.id)
      ? `existing:${share.child.id}`
      : db && onlyPlaceholderChild(db)
        ? "new"
        : "",
  );
  const placeholder = !!db && onlyPlaceholderChild(db);
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  if (!db) return null;
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
        setChoices({});
        setError("");
        (onDone || onClose)();
      } else
        setError(
          "Care couldn’t be saved. Your existing records were left unchanged.",
        );
    } finally {
      setImporting(false);
    }
  }
  return (
    <Modal
      title="Receive shared care"
      subtitle={`${pending.child.name} · ${pending.logs.length} shared records`}
      onClose={onClose}
    >
      <div className="form-stack">
        <p className="field-hint">
          Shared {new Date(pending.sharedAt).toLocaleString("en-US")}.
          {pending.notesOmitted &&
            " Notes aren’t included in hand-off links, and notes already on this device are kept."}{" "}
          These are parent-recorded observations from{" "}
          {pending.from || "the beginning"} to{" "}
          {pending.to || "the latest included record"}. Receiving adds selected
          records to this device; it doesn’t synchronize devices or remove
          existing records.
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
            {!placeholder &&
              db.children.map((c) => (
                <option key={c.id} value={`existing:${c.id}`}>
                  {c.name} (existing profile)
                </option>
              ))}
          </select>
        </label>
        {!placeholder && (
          <p className="field-hint">
            Choose their existing profile if this child is already in your app.
            Names alone aren’t used to match children.
          </p>
        )}
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
                    {logTitle(conflict.incoming)} · choose which version to keep
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
                            {new Date(log.timeGiven).toLocaleString("en-US")} ·{" "}
                            {logDetail(log, db.settings.tempUnit)}
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
                These records are already here, or you’ve chosen to keep your
                versions. Nothing needs to be added.
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
          <button className="button secondary" onClick={onClose}>
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
  );
}
