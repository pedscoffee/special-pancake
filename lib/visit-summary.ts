import {
  convertTemperature,
  formatTime,
  ILLNESS_METRIC,
  ILLNESS_VALUES,
  localDate,
  METRICS,
  NOT_SEEN_METRIC,
  responseLabel,
} from "./care";
import { symptomPreset } from "./symptoms";
import { symptomDetailText } from "./symptom-observations";
import type { Child, Database, Log, MedicineResponse, Unit } from "./types";

/**
 * A sick-visit summary: what a parent can hold up for a doctor or triage
 * nurse. It restates what caregivers recorded, grouped by day. It never
 * interprets observations, applies clinical thresholds, or mentions doses.
 */
export type RowStatus = "noticed" | "none" | "usual" | "not-recorded";
export type SummaryRow = {
  key: string;
  label: string;
  status: RowStatus;
  primary: string;
  secondary?: string;
};
export type TriedRow = {
  name: string;
  days: string;
  response: string;
  responseKind: MedicineResponse | "unanswered" | "mixed";
};
export type Onset = {
  start: number;
  end?: number;
  /** e.g. "Sick since Mon, Nov 23 · day 4" */
  label: string;
};
export type VisitSummary = {
  onset: Onset | null;
  rows: SummaryRow[];
  others: string[];
  tried: TriedRow[];
};

const DAY = 86400000;
type SymptomKey = "Fever" | "Cough" | "Vomiting" | "Diarrhea" | "Rash";
const SYMPTOM_ROWS: SymptomKey[] = [
  "Fever",
  "Cough",
  "Vomiting",
  "Diarrhea",
  "Rash",
];
const INTAKE_ROWS = [
  { key: "appetite", label: "Eating" },
  { key: "fluids", label: "Drinking" },
  { key: "urine", label: "Urine" },
] as const;

function noon(day: string) {
  return new Date(`${day}T12:00:00`).getTime();
}
function daysBetween(a: string, b: string) {
  return Math.round((noon(b) - noon(a)) / DAY);
}
/** "today", a weekday within the last week, else "Nov 23". */
export function dayLabel(day: string, now: number) {
  const today = localDate(now);
  if (day === today) return "today";
  const ago = daysBetween(day, today);
  return new Date(noon(day)).toLocaleDateString(
    "en-US",
    ago > 0 && ago < 7
      ? { weekday: "short" }
      : { month: "short", day: "numeric" },
  );
}
function longDay(time: number) {
  return new Date(time).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
/** Collapse days into ranges: "Mon – Wed, Fri". */
export function dayRanges(days: Iterable<string>, now: number) {
  const sorted = [...new Set(days)].sort();
  const runs: string[][] = [];
  for (const day of sorted) {
    const run = runs[runs.length - 1];
    if (run && daysBetween(run[run.length - 1], day) === 1) run.push(day);
    else runs.push([day]);
  }
  return runs
    .map((run) =>
      run.length === 1
        ? dayLabel(run[0], now)
        : `${dayLabel(run[0], now)} – ${dayLabel(run[run.length - 1], now)}`,
    )
    .join(", ");
}
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function symptomKey(log: Log): string {
  return symptomPreset(log.data.symptomName)?.name || log.data.symptomName!;
}

/** The illness that contains `at`: its latest start, and the first "better" after it. */
export function findOnset(logs: Log[], at: number, now: number): Onset | null {
  const markers = logs
    .filter((l) => l.type === "METRIC" && l.data.metricType === ILLNESS_METRIC)
    .sort((a, b) => a.timeGiven - b.timeGiven);
  const start = markers
    .filter((l) => l.data.value === ILLNESS_VALUES.start && l.timeGiven <= at)
    .pop();
  if (!start) return null;
  const end = markers.find(
    (l) =>
      l.data.value === ILLNESS_VALUES.end && l.timeGiven >= start.timeGiven,
  );
  const last = localDate(end ? end.timeGiven : now);
  const day = daysBetween(localDate(start.timeGiven), last) + 1;
  return {
    start: start.timeGiven,
    end: end?.timeGiven,
    label: end
      ? `Sick ${longDay(start.timeGiven)} – ${longDay(end.timeGiven)} · ${day} day${day === 1 ? "" : "s"}`
      : `Sick since ${longDay(start.timeGiven)} · day ${day}`,
  };
}
export function activeIllness(logs: Log[], now: number) {
  const onset = findOnset(logs, now, now);
  return onset && !onset.end ? onset : null;
}

function symptomRow(
  key: SymptomKey,
  entries: Log[],
  checks: Log[],
  now: number,
  unit: Unit,
  timeFormat: "12h" | "24h",
): SummaryRow {
  const seenDays = new Set(entries.map((l) => localDate(l.timeGiven)));
  const checkedDays = [
    ...new Set(checks.map((l) => localDate(l.timeGiven))),
  ].filter((d) => !seenDays.has(d));
  if (!entries.length)
    return checkedDays.length
      ? {
          key,
          label: key,
          status: "none",
          primary: "None",
          secondary: `Checked ${dayRanges(checkedDays, now)}`,
        }
      : {
          key,
          label: key,
          status: "not-recorded",
          primary: "Not recorded",
        };
  const latest = [...entries].sort((a, b) => b.timeGiven - a.timeGiven)[0];
  const secondary: string[] = [];
  if (key === "Fever") {
    const readings = entries.filter((l) => l.data.temp);
    if (readings.length) {
      const highest = readings
        .map((l) => ({
          log: l,
          value: Number(
            convertTemperature(l.data.temp!, l.data.tempUnit || unit, unit),
          ),
        }))
        .sort((a, b) => b.value - a.value)[0];
      secondary.push(
        `Highest ${highest.value.toFixed(1)}°${unit} ${dayLabel(localDate(highest.log.timeGiven), now)}`,
      );
    }
    secondary.push(
      `last noted ${dayLabel(localDate(latest.timeGiven), now)} ${formatTime(latest.timeGiven, timeFormat)}`,
    );
  } else {
    // The most recent entry that describes the symptom.
    const described = [...entries]
      .sort((a, b) => b.timeGiven - a.timeGiven)
      .map((l) =>
        [l.data.severity, ...symptomDetailText(l.data)].filter(
          (v): v is string => !!v,
        ),
      )
      .find((parts) => parts.length);
    if (described) secondary.push(...described);
  }
  if (checkedDays.length)
    secondary.push(`checked, not seen ${dayRanges(checkedDays, now)}`);
  return {
    key,
    label: key,
    status: "noticed",
    primary: capitalize(dayRanges(seenDays, now)),
    secondary: secondary.length ? capitalize(secondary.join(" · ")) : undefined,
  };
}

function intakeRow(
  key: (typeof INTAKE_ROWS)[number]["key"],
  label: string,
  entries: Log[],
  now: number,
): SummaryRow {
  const options = METRICS.find((m) => m.key === key)!.options;
  // Each day's least-reassuring observation; options are ordered from more to less.
  const byDay = new Map<string, Log>();
  for (const log of entries) {
    const day = localDate(log.timeGiven);
    const current = byDay.get(day);
    if (
      !current ||
      rank(options, log.data.value!) > rank(options, current.data.value!)
    )
      byDay.set(day, log);
  }
  if (!byDay.size)
    return { key, label, status: "not-recorded", primary: "Not recorded" };
  const below = new Map<string, string[]>();
  const usual: string[] = [];
  for (const [day, log] of byDay) {
    if (isUsual(options, log.data.value!)) usual.push(day);
    else {
      const extra =
        key === "urine" && log.data.wetDiapers !== undefined
          ? ` (${log.data.wetDiapers} wet diaper${log.data.wetDiapers === 1 ? "" : "s"})`
          : "";
      const text = `${log.data.value}${extra}`;
      below.set(text, [...(below.get(text) || []), day]);
    }
  }
  if (!below.size)
    return {
      key,
      label,
      status: "usual",
      primary: "Usual",
      secondary: capitalize(dayRanges(usual, now)),
    };
  return {
    key,
    label,
    status: "noticed",
    primary: [...below]
      .sort(([, a], [, b]) => a[0].localeCompare(b[0]))
      .map(([text, days]) => `${text} ${dayRanges(days, now)}`)
      .join("; "),
    secondary: usual.length ? `Usual ${dayRanges(usual, now)}` : undefined,
  };
}

/**
 * Options are ordered from more to less, so the first two are "more than
 * usual" and "usual". Older records hold free text such as "Normal" or
 * "Less than normal"; only wording about less or none is flagged.
 */
function isUsual(options: string[], value: string) {
  const index = options.indexOf(value);
  if (index >= 0) return index < 2;
  return !/\b(less|small|sips|no|none|little)\b/i.test(value);
}

function rank(options: string[], value: string) {
  const index = options.indexOf(value);
  return index >= 0 ? index : isUsual(options, value) ? 1 : 2;
}

function triedRows(entries: Log[], now: number): TriedRow[] {
  const groups = new Map<string, Log[]>();
  for (const log of entries) {
    const key = log.data.medicineName!.trim().toLocaleLowerCase();
    groups.set(key, [...(groups.get(key) || []), log]);
  }
  return [...groups.values()]
    .map((logs) => {
      const sorted = [...logs].sort((a, b) => a.timeGiven - b.timeGiven);
      const answers = new Map<MedicineResponse, number>();
      for (const l of sorted)
        if (l.data.response)
          answers.set(l.data.response, (answers.get(l.data.response) || 0) + 1);
      const kinds = [...answers.keys()];
      return {
        first: sorted[0].timeGiven,
        row: {
          name: sorted[sorted.length - 1].data.medicineName!.trim(),
          days: capitalize(
            dayRanges(
              sorted.map((l) => localDate(l.timeGiven)),
              now,
            ),
          ),
          response: !kinds.length
            ? "Not answered"
            : kinds.length === 1
              ? responseLabel(kinds[0])!
              : [...answers]
                  .map(([k, n]) => `${responseLabel(k)} ${n}×`)
                  .join(" · "),
          responseKind: (!kinds.length
            ? "unanswered"
            : kinds.length === 1
              ? kinds[0]
              : "mixed") as TriedRow["responseKind"],
        },
      };
    })
    .sort((a, b) => a.first - b.first)
    .map((g) => g.row);
}

/**
 * `logs` are one child's records within the chosen dates. `allLogs` are all of
 * that child's records, so an illness that started before the dates still
 * gives the onset.
 */
export function buildVisitSummary(
  logs: Log[],
  allLogs: Log[],
  settings: Database["settings"],
  now: number,
  rangeEnd = now,
): VisitSummary {
  const unit = settings.tempUnit;
  const symptoms = logs.filter((l) => l.type === "SYMPTOM");
  const checks = logs.filter(
    (l) => l.type === "METRIC" && l.data.metricType === NOT_SEEN_METRIC,
  );
  const rows: SummaryRow[] = [];
  const order = [
    "Fever",
    "appetite",
    "fluids",
    "urine",
    "Cough",
    "Vomiting",
    "Diarrhea",
    "Rash",
  ];
  for (const key of order) {
    const intake = INTAKE_ROWS.find((r) => r.key === key);
    if (intake)
      rows.push(
        intakeRow(
          intake.key,
          intake.label,
          logs.filter(
            (l) => l.type === "METRIC" && l.data.metricType === intake.key,
          ),
          now,
        ),
      );
    else
      rows.push(
        symptomRow(
          key as SymptomKey,
          symptoms.filter((l) => symptomKey(l) === key),
          checks.filter((l) => l.data.value === key),
          now,
          unit,
          settings.timeFormat,
        ),
      );
  }
  const otherNames = new Map<string, string[]>();
  for (const log of symptoms) {
    const key = symptomKey(log);
    if ((SYMPTOM_ROWS as string[]).includes(key)) continue;
    otherNames.set(key, [
      ...(otherNames.get(key) || []),
      localDate(log.timeGiven),
    ]);
  }
  return {
    onset: findOnset(allLogs, Math.min(rangeEnd, now), now),
    // Only what caregivers recorded, including "checked, not seen".
    rows: rows.filter((r) => r.status !== "not-recorded"),
    others: [...otherNames].map(
      ([name, days]) => `${name} ${dayRanges(days, now)}`,
    ),
    tried: triedRows(
      logs.filter((l) => l.type === "MEDICINE"),
      now,
    ),
  };
}

export function childAge(child: Child, now: number) {
  if (!child.birthday) return null;
  const birthday = new Date(`${child.birthday}T12:00:00`);
  const today = new Date(now);
  let months =
    (today.getFullYear() - birthday.getFullYear()) * 12 +
    today.getMonth() -
    birthday.getMonth() -
    (today.getDate() < birthday.getDate() ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}

/** Plain-text version for Copy and Download, placed above the full log. */
export function visitSummaryText(
  child: Child,
  summary: VisitSummary,
  now: number,
) {
  const age = childAge(child, now);
  const lines = [
    `SICK-VISIT SUMMARY — ${child.name}${age ? `, ${age}` : ""}`,
    summary.onset ? summary.onset.label : "Illness start not marked",
    "",
    ...(summary.rows.length ? [] : ["Nothing recorded in these dates."]),
    ...summary.rows.map(
      (r) =>
        `${r.label}: ${r.primary}${r.secondary ? ` (${r.secondary})` : ""}`,
    ),
    ...(summary.others.length
      ? [`Also noted: ${summary.others.join("; ")}`]
      : []),
    "",
    "What we tried:",
    ...(summary.tried.length
      ? summary.tried.map((t) => `- ${t.name}, ${t.days}: ${t.response}`)
      : ["- Nothing recorded"]),
  ];
  if (child.visitQuestions?.trim())
    lines.push("", "Our questions:", child.visitQuestions.trim());
  return lines.join("\n");
}
