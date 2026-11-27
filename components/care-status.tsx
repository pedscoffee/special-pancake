"use client";

import { useState, type FormEvent } from "react";
import { Check, HeartPulse, Pill, Send, Trash2, X } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { HandoffSheet } from "./handoff-sheet";
import {
  formatTime,
  ILLNESS_METRIC,
  ILLNESS_VALUES,
  localInput,
  logTitle,
  MEDICINE_RESPONSES,
  relativeTime,
} from "@/lib/care";
import { saveCareRecord } from "@/lib/record-updates";
import { activeIllness } from "@/lib/visit-summary";
import type { Child, Log, MedicineResponse } from "@/lib/types";

const ASKED_KEY = "kiddymeds-response-later";
function askedLater(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(ASKED_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Overview card: illness start/end, and "Did it help?" after a recent medicine. */
export function CareStatus({ child, logs }: { child: Child; logs: Log[] }) {
  const { db, now, update, saving } = useCare();
  const [marking, setMarking] = useState<null | "start" | "end">(null);
  const [handoff, setHandoff] = useState(false);
  const [later, setLater] = useState<string[]>(askedLater);
  const illness = activeIllness(logs, now);
  // Ask about the latest medicine given 30 minutes to a day ago.
  const ask = logs.find(
    (l) =>
      l.type === "MEDICINE" &&
      !l.data.response &&
      now - l.timeGiven >= 30 * 60000 &&
      now - l.timeGiven <= 86400000 &&
      !later.includes(l.id),
  );
  async function answer(log: Log, response: MedicineResponse) {
    await update(
      (database) =>
        saveCareRecord(
          database,
          { ...log, data: { ...log.data, response } },
          log,
        ),
      "Thanks. It’ll show in the report.",
    );
  }
  function askLater(log: Log) {
    const next = [...later, log.id];
    setLater(next);
    try {
      sessionStorage.setItem(ASKED_KEY, JSON.stringify(next));
    } catch {}
  }
  return (
    <>
      <section className="care-status" aria-label="Illness and follow-up">
        <div className={`illness-bar ${illness ? "sick" : ""}`}>
          <HeartPulse size={18} aria-hidden="true" />
          <span>
            {illness ? (
              <>
                <strong>{illness.label}</strong>
                <small>The report starts from this day.</small>
              </>
            ) : (
              <>
                <strong>Is {child.name} sick?</strong>
                <small>Mark when it started so reports show the onset.</small>
              </>
            )}
          </span>
          <div className="illness-actions">
            {illness && (
              <button
                className="button secondary"
                onClick={() => setHandoff(true)}
              >
                <Send size={16} />
                Hand off
              </button>
            )}
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setMarking(illness ? "end" : "start")}
            >
              {illness ? "Feeling better" : "Got sick"}
            </button>
          </div>
        </div>
        {ask && (
          <div
            className="followup-card"
            role="group"
            aria-labelledby={`ask-${ask.id}`}
          >
            <Pill size={18} aria-hidden="true" />
            <div>
              <strong id={`ask-${ask.id}`}>
                Did the {logTitle(ask)} at{" "}
                {formatTime(ask.timeGiven, db?.settings.timeFormat)} help?
              </strong>
              <small>
                {relativeTime(ask.timeGiven, now)}. Your answer goes in the
                doctor report.
              </small>
              <div className="followup-buttons">
                {MEDICINE_RESPONSES.map((r) => (
                  <button
                    key={r.value}
                    className="button secondary"
                    disabled={saving}
                    onClick={() => answer(ask, r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="Ask me later"
              onClick={() => askLater(ask)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </section>
      {handoff && (
        <HandoffSheet
          child={child}
          logs={logs}
          onClose={() => setHandoff(false)}
        />
      )}
      {marking && (
        <StatusForm
          childId={child.id}
          value={
            marking === "start" ? ILLNESS_VALUES.start : ILLNESS_VALUES.end
          }
          onClose={() => setMarking(null)}
        />
      )}
    </>
  );
}

/** Add or edit an illness marker or a "not seen" check: time and notes only. */
export function StatusForm({
  childId,
  value,
  log,
  onClose,
  onDelete,
}: {
  childId: string;
  value?: string;
  log?: Log;
  onClose: () => void;
  onDelete?: (log: Log) => void;
}) {
  const { db, update, now, saving } = useCare();
  const [time, setTime] = useState(() => localInput(log?.timeGiven));
  const [notes, setNotes] = useState(log?.data.notes || "");
  const [error, setError] = useState("");
  const child = db?.children.find((c) => c.id === childId);
  if (!db || !child) return null;
  const record: Log["data"] = log
    ? log.data
    : { metricType: ILLNESS_METRIC, value };
  const starting =
    record.metricType === ILLNESS_METRIC &&
    record.value === ILLNESS_VALUES.start;
  const title = log
    ? `Edit “${logTitle(log)}”`
    : starting
      ? `When did ${child.name} get sick?`
      : `${child.name} is feeling better`;
  async function save(e: FormEvent) {
    e.preventDefault();
    const timeGiven = new Date(time).getTime();
    if (!Number.isFinite(timeGiven) || timeGiven > Date.now() + 60000) {
      setError("Choose a valid time that isn’t in the future.");
      return;
    }
    const entry: Log = {
      id: log?.id || crypto.randomUUID(),
      childId,
      type: "METRIC",
      timeGiven,
      timestamp: log?.timestamp || Date.now(),
      data: { ...record, notes: notes.trim() },
    };
    if (
      await update(
        (database) => saveCareRecord(database, entry, log),
        log
          ? "Entry updated."
          : starting
            ? "Marked as sick. Reports will start here."
            : "Marked as feeling better.",
      )
    )
      onClose();
  }
  return (
    <Modal
      title={title}
      subtitle={
        starting && !log
          ? "Your best guess is fine. This is the onset the doctor sees."
          : undefined
      }
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="form-stack" onSubmit={save}>
        <label>
          {starting ? "When it started" : "When"}
          <input
            type="datetime-local"
            value={time}
            max={localInput(now + 60000)}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </label>
        <label>
          Notes <span className="optional">optional</span>
          <textarea
            rows={2}
            maxLength={5000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              starting
                ? "e.g. Warm and fussy after daycare"
                : "Anything to remember"
            }
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {log && onDelete && (
            <button
              type="button"
              className="button danger"
              disabled={saving}
              onClick={() => onDelete(log)}
            >
              <Trash2 size={16} />
              Remove
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            <Check size={17} />
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
