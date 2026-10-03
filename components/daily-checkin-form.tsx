"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { Check, Utensils, Droplets, Bath } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { BathroomFields } from "./bathroom-fields";
import { localInput, METRICS, OBSERVATION_PERIODS } from "@/lib/care";
import { addDailyCheckIn, buildDailyCheckIn } from "@/lib/daily-checkin";
import { useFormDraft } from "./use-form-draft";
import type { Log } from "@/lib/types";

export function DailyCheckInForm({
  childId,
  onClose,
}: {
  childId: string;
  onClose: () => void;
}) {
  const { db, update, now, demo, saving } = useCare();
  const {
    formRef,
    initial: draftInitial,
    capture: captureDraft,
    clear: clearDraft,
  } = useFormDraft(`${childId}:daily-checkin`, !demo);
  const [time, setTime] = useState(() => draftInitial?.time ?? localInput());
  const [urine, setUrine] = useState(draftInitial?.urine ?? "");
  const [error, setError] = useState("");
  if (!db) return null;
  const child = db.children.find((c) => c.id === childId);
  if (!child)
    return (
      <Modal title="Child profile removed" onClose={onClose}>
        <p>
          This profile was removed in another tab. This check-in cannot be
          saved; its unfinished draft remains in this tab.
        </p>
      </Modal>
    );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim();
    const count = (key: string) =>
      text(key) === "" ? undefined : Number(text(key));
    try {
      const records = buildDailyCheckIn({
        childId,
        timeGiven: new Date(time).getTime(),
        period: text("period") as NonNullable<Log["data"]["observationPeriod"]>,
        notes: text("notes"),
        appetite: text("appetite"),
        fluids: text("fluids"),
        urine,
        wetDiapers: count("urine-wetDiapers"),
        bowelMovements: count("stool-bowelMovements"),
        stoolDiapers: count("stool-stoolDiapers"),
        stoolConsistency: text("stool-stoolConsistency") || undefined,
      });
      let mergeError = "";
      const saved = await update((current) => {
        try {
          return addDailyCheckIn(current, records);
        } catch (err) {
          mergeError =
            err instanceof Error
              ? err.message
              : "This check-in couldn’t be saved.";
          return null;
        }
      }, `Daily check-in saved for ${child!.name}.`);
      if (saved) {
        clearDraft();
        onClose();
      } else
        setError(
          mergeError ||
            "This check-in couldn’t be saved. Your previous records are unchanged.",
        );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Check the details and try again.",
      );
    }
  }
  return (
    <Modal
      title="Daily check-in"
      subtitle={`How is ${child.name}’s day going?`}
      onClose={() => {
        if (!saving) onClose();
      }}
      className="checkin-modal"
    >
      <form
        ref={formRef}
        onChange={captureDraft}
        className="form-stack daily-checkin-form"
        onSubmit={save}
      >
        {draftInitial && (
          <p className="inline-note">
            Your unfinished check-in is restored. Review the time and
            observations before saving.
          </p>
        )}
        <p className="field-hint">
          Fill in what you know and save it all together. Blank sections stay
          unrecorded; no previous answers are carried forward.
        </p>
        <div className="form-grid">
          <label>
            When
            <input
              name="time"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              max={localInput(now + 60000)}
              required
            />
          </label>
          <label>
            Period covered
            <select name="period" defaultValue="today">
              {OBSERVATION_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="field-hint">
          “Today so far” is a snapshot, not a running total. “Since the previous
          check-in” refers to the last entry of each kind.
        </p>
        <div className="daily-checkin-sections">
          {METRICS.map((metric, index) => {
            const Icon = [Utensils, Droplets, Droplets, Bath][index];
            return (
              <fieldset
                key={metric.key}
                className="daily-form-section form-stack"
              >
                <legend>
                  <Icon size={17} aria-hidden="true" /> {metric.name}
                </legend>
                {metric.key !== "stool" && (
                  <label>
                    {metric.question}
                    <select
                      name={metric.key}
                      {...(metric.key === "urine"
                        ? {
                            value: urine,
                            onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                              setUrine(e.target.value),
                          }
                        : { defaultValue: "" })}
                    >
                      <option value="">Not recorded</option>
                      {metric.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                )}
                {(metric.key === "urine" || metric.key === "stool") && (
                  <BathroomFields
                    metricType={metric.key}
                    value={urine}
                    prefix={`${metric.key}-`}
                    showPeriod={false}
                    optional
                  />
                )}
                {metric.key === "fluids" && (
                  <p className="field-hint">
                    Include drinks, breastmilk, and formula. This records intake
                    compared with usual.
                  </p>
                )}
              </fieldset>
            );
          })}
        </div>
        <label>
          Notes <span className="optional">optional</span>
          <textarea
            name="notes"
            rows={2}
            maxLength={5000}
            placeholder="Anything to remember, or the period if you chose another one…"
          />
        </label>
        <p className="field-hint">
          Only answered sections are saved, as separate entries with this time
          and period. Notes accompany each saved section. Mixed diapers may be
          included in both counts; counts aren’t combined.
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
            disabled={saving}
            onClick={() => {
              clearDraft();
              onClose();
            }}
          >
            Cancel
          </button>
          <button type="submit" className="button primary" disabled={saving}>
            <Check size={17} />
            Save check-in
          </button>
        </div>
      </form>
    </Modal>
  );
}
