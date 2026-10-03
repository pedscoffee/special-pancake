"use client";

import { useState } from "react";
import { OBSERVATION_PERIODS, STOOL_OPTIONS } from "@/lib/care";
import type { Log } from "@/lib/types";

export function BathroomFields({
  metricType,
  value,
  log,
  prefix = "",
  showPeriod = true,
  optional = false,
}: {
  metricType: string;
  value: string;
  log?: Log;
  prefix?: string;
  showPeriod?: boolean;
  optional?: boolean;
}) {
  const data = log?.data.metricType === metricType ? log.data : undefined;
  const [bowelMovements, setBowelMovements] = useState(
    data?.bowelMovements?.toString() || "",
  );
  const noStool = bowelMovements === "0";
  return (
    <>
      {showPeriod && (
        <>
          <label>
            Period covered
            <select
              name="observationPeriod"
              defaultValue={data ? data.observationPeriod || "" : "today"}
            >
              {data && !data.observationPeriod && (
                <option value="">Not specified (previous entry)</option>
              )}
              {OBSERVATION_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p className="field-hint">
            Record observations for this period. “Today so far” is a snapshot;
            repeated check-ins aren’t added together. For “since the previous
            check-in,” use the last {metricType === "urine" ? "urine" : "stool"}{" "}
            entry.
          </p>
        </>
      )}
      {metricType === "urine" ? (
        <>
          <label>
            Wet diapers <span className="optional">optional</span>
            <input
              name={`${prefix}wetDiapers`}
              type="number"
              min="0"
              max="999"
              step="1"
              defaultValue={data?.wetDiapers ?? ""}
              disabled={value === "No urine" || (optional && !value)}
              placeholder="Leave blank if not counting diapers"
              aria-describedby="urine-diaper-hint"
            />
          </label>
          <p className="field-hint" id="urine-diaper-hint">
            {value === "No urine"
              ? "No wet diapers are recorded for a period with no urine."
              : "Count diapers containing urine, including mixed diapers. Leave blank for toilet use or if you haven’t counted."}
          </p>
        </>
      ) : (
        <>
          <div className="form-grid">
            <label>
              Bowel movements
              <input
                name={`${prefix}bowelMovements`}
                type="number"
                required={!optional}
                min="0"
                max="999"
                step="1"
                value={bowelMovements}
                onChange={(e) => setBowelMovements(e.target.value)}
                placeholder="Include 0 if none"
              />
            </label>
            <label>
              Stool diapers <span className="optional">optional</span>
              <input
                name={`${prefix}stoolDiapers`}
                type="number"
                min="0"
                max="999"
                step="1"
                defaultValue={data?.stoolDiapers ?? ""}
                disabled={noStool || (optional && !bowelMovements)}
                placeholder="If using diapers"
                aria-describedby="stool-diaper-hint"
              />
            </label>
          </div>
          <p className="field-hint" id="stool-diaper-hint">
            Count diapers containing stool, including mixed diapers. Diaper
            counts and bowel movements are separate observations; they aren’t
            added together.
          </p>
          <label>
            Stool description <span className="optional">optional</span>
            <select
              name={`${prefix}stoolConsistency`}
              defaultValue={data?.stoolConsistency || ""}
              disabled={noStool || (optional && !bowelMovements)}
              aria-describedby="stool-description-hint"
            >
              <option value="">Not recorded</option>
              {STOOL_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <p className="field-hint" id="stool-description-hint">
            {noStool
              ? "No stool description is needed when there are no bowel movements."
              : "Choose what you observed. Use notes for color, discomfort, or different consistencies during this period."}
          </p>
        </>
      )}
    </>
  );
}
