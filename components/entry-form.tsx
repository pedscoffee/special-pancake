"use client";

import { useState, type FormEvent } from "react";
import { Clock3, Info, Plus, Trash2, Check } from "lucide-react";
import { useCare } from "./care-provider";
import { Modal } from "./ui";
import { BathroomFields } from "./bathroom-fields";
import {
  childLogs,
  convertTemperature,
  formatTime,
  localInput,
  MEDICINES,
  METRICS,
  relativeTime,
  validateBathroomData,
  SYMPTOMS,
} from "@/lib/care";
import type { Log, LogType } from "@/lib/types";

export function EntryForm({
  kind,
  name = "",
  log,
  childId,
  onClose,
  onDelete,
}: {
  kind: LogType;
  name?: string;
  log?: Log;
  childId: string;
  onClose: () => void;
  onDelete: (log: Log) => void;
}) {
  const { db, update, now } = useCare();
  const [entryName, setEntryName] = useState(
    log
      ? log.data.medicineName ||
          log.data.symptomName ||
          log.data.metricType ||
          ""
      : name,
  );
  const [time, setTime] = useState(() => localInput(log?.timeGiven));
  const [error, setError] = useState("");
  const [metricValue, setMetricValue] = useState(
    log?.data.value && !/^\d+/.test(log.data.value)
      ? log.data.value
      : log?.data.value
        ? "Count"
        : kind === "METRIC" && name === "urine"
          ? ""
          : "Normal",
  );
  if (!db) return null;
  const child = db.children.find((c) => c.id === childId)!;
  const typeName =
    kind === "MEDICINE"
      ? "medicine"
      : kind === "SYMPTOM"
        ? "symptom"
        : "check-in";
  const recent = childLogs(db, childId).find(
    (l) =>
      l.type === "MEDICINE" &&
      l.id !== log?.id &&
      l.data.medicineName?.toLowerCase() === entryName.trim().toLowerCase(),
  );
  const metric = METRICS.find((m) => m.key === entryName) || METRICS[0];
  const tempInitial = log?.data.temp
    ? convertTemperature(
        log.data.temp,
        log.data.tempUnit || db.settings.tempUnit,
        db.settings.tempUnit,
      )
    : "";

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = entryName.trim();
    const timeGiven = new Date(time).getTime();
    if (!title) {
      setError("Add a name for this entry.");
      return;
    }
    if (!Number.isFinite(timeGiven) || timeGiven > Date.now() + 60000) {
      setError("Choose a valid time that isn’t in the future.");
      return;
    }
    const frequency = String(form.get("frequency") || "");
    if (
      frequency &&
      (!Number.isFinite(Number(frequency)) ||
        Number(frequency) <= 0 ||
        Number(frequency) > 8760)
    ) {
      setError("Enter a positive interval in hours, or leave it empty.");
      return;
    }
    const data: Log["data"] = { notes: String(form.get("notes") || "").trim() };
    if (kind === "MEDICINE")
      Object.assign(data, {
        medicineName: title,
        dosage: String(form.get("dosage") || "").trim(),
        frequencyHours: frequency ? Number(frequency) : null,
      });
    if (kind === "SYMPTOM") {
      data.symptomName = title;
      if (title.toLowerCase() === "fever") {
        const temperature = String(form.get("temperature") || "");
        const unchanged = !!log?.data.temp && temperature === tempInitial;
        data.temp = unchanged ? log!.data.temp : temperature;
        data.tempUnit = unchanged
          ? log!.data.tempUnit || db!.settings.tempUnit
          : db!.settings.tempUnit;
      } else data.severity = String(form.get("severity") || "Mild");
    }
    if (kind === "METRIC") {
      data.metricType = title;
      data.value =
        metricValue === "Count" ? `${form.get("count")} times` : metricValue;
      if (title === "urine" || title === "stool") {
        if (title === "urine" && !metricValue) {
          setError("Choose how their peeing compares with usual.");
          return;
        }
        const period = String(form.get("observationPeriod") || "");
        if (period)
          data.observationPeriod = period as Log["data"]["observationPeriod"];
        for (const key of [
          "wetDiapers",
          "bowelMovements",
          "stoolDiapers",
        ] as const) {
          const raw = form.get(key);
          if (raw !== null && String(raw).trim() !== "")
            data[key] = Number(raw);
        }
        if (title === "stool") {
          data.value = `${data.bowelMovements} bowel movement${data.bowelMovements === 1 ? "" : "s"}`;
          const description = String(form.get("stoolConsistency") || "");
          if (description) data.stoolConsistency = description;
        }
        try {
          validateBathroomData(data);
        } catch (problem) {
          setError(
            problem instanceof Error
              ? problem.message
              : "Check your bathroom details.",
          );
          return;
        }
      }
    }
    const entry: Log = {
      id: log?.id || crypto.randomUUID(),
      childId,
      type: kind,
      timeGiven,
      timestamp: log?.timestamp || Date.now(),
      data,
    };
    const saved = update(
      (database) => ({
        ...database,
        logs: log
          ? database.logs.map((l) => (l.id === log.id ? entry : l))
          : [...database.logs, entry],
        customMedicines:
          kind === "MEDICINE" &&
          ![...MEDICINES.map((m) => m.name), ...database.customMedicines].some(
            (m) => m.toLowerCase() === title.toLowerCase(),
          )
            ? [...database.customMedicines, title]
            : database.customMedicines,
      }),
      log
        ? "Entry updated."
        : `${kind === "METRIC" ? metric.name : title} recorded for ${child.name}.`,
    );
    if (saved) onClose();
  }
  return (
    <Modal
      title={`${log ? "Edit" : "Log"} ${typeName}`}
      subtitle={`A little care for ${child.name}.`}
      onClose={onClose}
    >
      <form onSubmit={save} className="form-stack">
        {kind === "METRIC" ? (
          <label>
            Daily check-in
            <select
              value={entryName}
              onChange={(e) => {
                setEntryName(e.target.value);
                setMetricValue(e.target.value === "urine" ? "" : "Normal");
                setError("");
              }}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {kind === "MEDICINE" ? "Medicine name" : "Symptom"}
            <input
              autoFocus
              required
              maxLength={100}
              list={kind === "SYMPTOM" ? "symptom-presets" : undefined}
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              placeholder={kind === "MEDICINE" ? "e.g. Tylenol" : "e.g. Cough"}
            />
          </label>
        )}
        {kind === "SYMPTOM" && (
          <datalist id="symptom-presets">
            {SYMPTOMS.filter((s) => s !== "Other symptom").map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {kind === "MEDICINE" && (
          <>
            {recent && (
              <div className="inline-note">
                <Clock3 size={17} />
                <span>
                  Last recorded:{" "}
                  <strong>{relativeTime(recent.timeGiven, now)}</strong> at{" "}
                  {formatTime(recent.timeGiven, db.settings.timeFormat)}
                  {recent.data.dosage ? ` · ${recent.data.dosage}` : ""}.
                  {recent.data.frequencyHours &&
                  recent.timeGiven + recent.data.frequencyHours * 3600000 > now
                    ? " The previously recorded interval hasn’t passed. Check your care instructions before recording another dose."
                    : ""}
                </span>
              </div>
            )}
            <div className="form-grid">
              <label>
                Dose <span className="optional">optional</span>
                <input
                  name="dosage"
                  defaultValue={log?.data.dosage}
                  maxLength={200}
                  placeholder="As instructed, e.g. 5 mL"
                />
              </label>
              <label>
                Interval in hours <span className="optional">optional</span>
                <input
                  name="frequency"
                  type="number"
                  min="0.01"
                  max="8760"
                  step="any"
                  defaultValue={log?.data.frequencyHours || ""}
                  placeholder="e.g. 6"
                />
              </label>
            </div>
            <p className="field-hint">
              Use the dose and interval in your healthcare provider’s
              instructions. We’ll show a clock for the interval you record.
            </p>
          </>
        )}
        {kind === "SYMPTOM" &&
          (entryName.toLowerCase() === "fever" ? (
            <label>
              Temperature (°{db.settings.tempUnit}){" "}
              <span className="optional">optional</span>
              <input
                name="temperature"
                type="number"
                step="0.1"
                min={db.settings.tempUnit === "F" ? 70 : 20}
                max={db.settings.tempUnit === "F" ? 120 : 50}
                defaultValue={tempInitial}
                placeholder={
                  db.settings.tempUnit === "F" ? "e.g. 100.4" : "e.g. 38.0"
                }
              />
            </label>
          ) : (
            <label>
              Severity
              <select
                name="severity"
                defaultValue={log?.data.severity || "Mild"}
              >
                <option>Mild</option>
                <option>Moderate</option>
                <option>Severe</option>
              </select>
            </label>
          ))}
        {kind === "METRIC" && (
          <>
            {entryName !== "stool" && (
              <label>
                {metric.question}
                <select
                  value={metricValue}
                  required
                  onChange={(e) => setMetricValue(e.target.value)}
                >
                  {entryName === "urine" && (
                    <option value="" disabled>
                      Choose an observation
                    </option>
                  )}
                  {!metric.options.includes(metricValue) && metricValue && (
                    <option>{metricValue}</option>
                  )}
                  {metric.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            {metricValue === "Count" && entryName !== "stool" && (
              <label>
                Number of times
                <input
                  name="count"
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="1"
                  defaultValue={log?.data.value?.split(" ")[0] || ""}
                />
              </label>
            )}
            {(entryName === "urine" || entryName === "stool") && (
              <BathroomFields
                key={entryName}
                metricType={entryName}
                value={metricValue}
                log={log}
              />
            )}
          </>
        )}
        <label>
          When
          <div className="time-shortcuts">
            {[
              { title: "Now", offset: 0 },
              { title: "15 min ago", offset: 15 },
              { title: "30 min ago", offset: 30 },
              { title: "1 hour ago", offset: 60 },
            ].map((s) => (
              <button
                type="button"
                key={s.title}
                onClick={() =>
                  setTime(localInput(Date.now() - s.offset * 60000))
                }
              >
                {s.title}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            max={localInput(now + 60000)}
            required
          />
        </label>
        <label>
          Notes <span className="optional">optional</span>
          <textarea
            name="notes"
            defaultValue={log?.data.notes}
            maxLength={5000}
            rows={3}
            placeholder={
              kind === "SYMPTOM" && entryName.trim().toLowerCase() === "pain"
                ? "Where does it hurt? Anything else you noticed…"
                : "Anything you’d like to remember…"
            }
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {kind === "MEDICINE" && (
          <p className="field-hint note-with-icon">
            <Info size={15} />
            This is a record of care, not a dosage recommendation.
          </p>
        )}
        <div className="modal-actions">
          {log ? (
            <button
              className="button danger-ghost"
              type="button"
              onClick={() => onDelete(log)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          ) : (
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          )}
          <button className="button primary" type="submit">
            {log ? <Check size={17} /> : <Plus size={17} />}
            {log ? "Save changes" : "Save entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
