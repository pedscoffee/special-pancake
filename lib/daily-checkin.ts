import {
  METRICS,
  OBSERVATION_PERIODS,
  parseDatabase,
  validateBathroomData,
} from "./care";
import type { Database, Log } from "./types";

export type DailyDraft = {
  childId: string;
  timeGiven: number;
  period: NonNullable<Log["data"]["observationPeriod"]>;
  notes: string;
  appetite: string;
  fluids: string;
  urine: string;
  wetDiapers?: number;
  bowelMovements?: number;
  stoolDiapers?: number;
  stoolConsistency?: string;
};

export function buildDailyCheckIn(
  draft: DailyDraft,
  now = Date.now(),
  makeId = () => crypto.randomUUID(),
): Log[] {
  if (
    !draft.childId ||
    typeof draft.timeGiven !== "number" ||
    !Number.isFinite(new Date(draft.timeGiven).getTime()) ||
    draft.timeGiven > now + 60000
  )
    throw new Error("Choose a valid time that isn’t in the future.");
  if (!OBSERVATION_PERIODS.some((p) => p.value === draft.period))
    throw new Error("Choose a period for this check-in.");
  if (typeof draft.notes !== "string" || draft.notes.length > 5000)
    throw new Error("Keep notes within 5,000 characters.");
  if (draft.wetDiapers !== undefined && !draft.urine)
    throw new Error("Choose a urine observation for the wet-diaper count.");
  if (
    (draft.stoolDiapers !== undefined || draft.stoolConsistency) &&
    draft.bowelMovements === undefined
  )
    throw new Error("Add the bowel-movement count for these stool details.");
  const logs: Log[] = [];
  for (const metric of METRICS) {
    const value =
      metric.key === "stool"
        ? draft.bowelMovements === undefined
          ? ""
          : `${draft.bowelMovements} bowel movement${draft.bowelMovements === 1 ? "" : "s"}`
        : draft[metric.key as "appetite" | "fluids" | "urine"];
    if (!value) continue;
    if (metric.key !== "stool" && !metric.options.includes(value))
      throw new Error(
        `Choose a supported ${metric.name.toLowerCase()} observation.`,
      );
    const data: Log["data"] = {
      metricType: metric.key,
      value,
      observationPeriod: draft.period,
      notes: draft.notes.trim(),
    };
    if (metric.key === "urine" && draft.wetDiapers !== undefined)
      data.wetDiapers = draft.wetDiapers;
    if (metric.key === "stool")
      Object.assign(data, {
        bowelMovements: draft.bowelMovements,
        ...(draft.stoolDiapers !== undefined
          ? { stoolDiapers: draft.stoolDiapers }
          : {}),
        ...(draft.stoolConsistency
          ? { stoolConsistency: draft.stoolConsistency }
          : {}),
      });
    validateBathroomData(data);
    logs.push({
      id: makeId(),
      childId: draft.childId,
      type: "METRIC",
      timeGiven: draft.timeGiven,
      timestamp: now,
      data,
    });
  }
  if (!logs.length)
    throw new Error("Fill in at least one section to save a check-in.");
  return logs;
}

export function addDailyCheckIn(db: Database, records: Log[]): Database {
  return parseDatabase({ ...db, logs: [...db.logs, ...records] });
}
