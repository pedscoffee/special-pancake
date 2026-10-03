"use client";

import { useState } from "react";
import { symptomObservation } from "@/lib/symptom-observations";
import { symptomPreset } from "@/lib/symptoms";
import type { Log } from "@/lib/types";

export function SymptomFields({ name, log }: { name: string; log?: Log }) {
  const observation = symptomObservation(name);
  const initial =
    log &&
    symptomPreset(log.data.symptomName)?.name === symptomPreset(name)?.name
      ? log.data
      : undefined;
  const [count, setCount] = useState(initial?.symptomCount?.toString() ?? "");
  if (!observation.fields.length) return null;
  return (
    <fieldset className="observation-fields form-stack">
      <legend>
        A little more detail <span className="optional-inline">optional</span>
      </legend>
      <p className="field-hint">
        Choose what you noticed or what your child told you. Leave anything you
        haven’t observed blank.
      </p>
      {observation.countLabel && (
        <label>
          {observation.countLabel} <span className="optional">optional</span>
          <input
            name="symptomCount"
            type="number"
            min="0"
            max="999"
            step="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Leave blank if not counted"
          />
        </label>
      )}
      {observation.fields.map((field) => (
        <label key={field.key}>
          {field.label}{" "}
          {field.key === "period" && count !== "" ? (
            <span className="optional">required for a count</span>
          ) : (
            <span className="optional">optional</span>
          )}
          {field.options ? (
            <select
              name={`detail:${field.key}`}
              defaultValue={initial?.symptomDetails?.[field.key] || ""}
              required={field.key === "period" && count !== ""}
            >
              <option value="">Not recorded</option>
              {field.options.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          ) : (
            <input
              name={`detail:${field.key}`}
              defaultValue={initial?.symptomDetails?.[field.key] || ""}
              maxLength={200}
              placeholder={field.placeholder}
            />
          )}
        </label>
      ))}
      {observation.countLabel && (
        <p className="field-hint">
          Counts describe the selected period. Repeated snapshots aren’t added
          together. Use notes for another period or extra context.
        </p>
      )}
    </fieldset>
  );
}
